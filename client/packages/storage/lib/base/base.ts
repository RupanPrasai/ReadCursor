import { SessionAccessLevelEnum, StorageEnum } from './enums.js';
import type { BaseStorageType, StorageConfigType, ValueOrUpdateType } from './types.js';

/**
 * Chrome reference error while running `processTailwindFeatures` in tailwindcss.
 * To avoid this, we need to check if globalThis.chrome is available and add fallback logic.
 */
const chrome = globalThis.chrome as any;

/**
 * Best-effort stable stringification for Chrome-storage-safe values (JSON-serializable).
 * Used to suppress "echo" updates from chrome.storage.onChanged after our own .set().
 */
const stableStringify = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/**
 * Sets or updates an arbitrary cache with a new value or the result of an update function.
 */
const updateCache = async <D>(valueOrUpdate: ValueOrUpdateType<D>, cache: D | null): Promise<D> => {
  const isFunction = (value: ValueOrUpdateType<D>): value is (prev: D) => D | Promise<D> => typeof value === 'function';

  if (isFunction(valueOrUpdate)) {
    return await valueOrUpdate(cache as D);
  }

  return valueOrUpdate;
};

/**
 * If one session storage needs access from content scripts, we need to enable it globally.
 * @default false
 */
let globalSessionAccessLevelFlag: StorageConfigType['sessionAccessForContentScripts'] = false;

/**
 * Checks if the storage permission is granted in the manifest.json.
 */
const checkStoragePermission = (storageEnum: StorageEnum): void => {
  if (!chrome) return;

  if (!chrome.storage?.[storageEnum]) {
    throw new Error(`"storage" permission in manifest.ts: "storage ${storageEnum}" isn't defined`);
  }
};

/**
 * Creates a storage area for persisting and exchanging data.
 */
export const createStorage = <D = string>(
  key: string,
  fallback: D,
  config?: StorageConfigType<D>,
): BaseStorageType<D> => {
  let cache: D | null = null;
  let initialCache = false;
  let listeners: Array<() => void> = [];

  const storageEnum = config?.storageEnum ?? StorageEnum.Local;
  const liveUpdate = config?.liveUpdate ?? false;

  const serialize = config?.serialization?.serialize ?? ((v: D) => v);
  const deserialize = config?.serialization?.deserialize ?? (v => v as D);

  // Used to suppress storage.onChanged echo from our own set().
  let lastWrittenStable: string | null = null;

  // Set global session storage access level for StorageEnum.Session, only when not already done but needed.
  if (
    globalSessionAccessLevelFlag === false &&
    storageEnum === StorageEnum.Session &&
    config?.sessionAccessForContentScripts === true
  ) {
    checkStoragePermission(storageEnum);

    chrome?.storage?.[storageEnum]
      ?.setAccessLevel?.({
        accessLevel: SessionAccessLevelEnum.ExtensionPagesAndContentScripts,
      })
      ?.catch((error: unknown) => {
        console.error(error);
        console.error('Please call .setAccessLevel() into different context, like a background script.');
      });

    globalSessionAccessLevelFlag = true;
  }

  // Register life cycle methods
  const get = async (): Promise<D> => {
    checkStoragePermission(storageEnum);

    const value = await chrome?.storage?.[storageEnum]?.get?.([key]);
    if (!value) return fallback;

    return (deserialize(value[key]) ?? fallback) as D;
  };

  const set = async (valueOrUpdate: ValueOrUpdateType<D>) => {
    if (!initialCache) {
      cache = await get();
    }

    cache = await updateCache(valueOrUpdate, cache);

    const serialized = serialize(cache);

    // Suppress the onChanged echo of our own write (best effort).
    lastWrittenStable = stableStringify(serialized);

    await chrome?.storage?.[storageEnum]?.set?.({ [key]: serialized });

    // Local subscribers should update immediately.
    _emitChange();
  };

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];

    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  const getSnapshot = () => cache;

  const _emitChange = () => {
    listeners.forEach(listener => listener());
  };

  // Listener for live updates from the browser (cross-context sync)
  const _updateFromStorageOnChanged = async (changes: { [k: string]: any }) => {
    const change = changes[key];
    if (change === undefined) return;

    // chrome.storage.onChanged emits { oldValue, newValue }
    const rawNew = change?.newValue;

    // Ignore echo events from our own set() when possible.
    if (lastWrittenStable != null && stableStringify(rawNew) === lastWrittenStable) {
      return;
    }

    // If key was removed, treat as fallback.
    const nextValue: D = rawNew === undefined ? fallback : ((deserialize(rawNew) as D) ?? fallback);

    if (cache === nextValue) return;

    cache = await updateCache(nextValue, cache);
    _emitChange();
  };

  // Initialize cache
  get().then(data => {
    cache = data;
    initialCache = true;
    _emitChange();
  });

  // Register listener for live updates for our storage area
  if (liveUpdate && chrome?.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (areaName !== storageEnum) return;
      void _updateFromStorageOnChanged(changes);
    });
  }

  return {
    get,
    set,
    getSnapshot,
    subscribe,
  };
};
