var l;
(function(e) {
  e.Local = "local", e.Sync = "sync", e.Managed = "managed", e.Session = "session";
})(l || (l = {}));
var E;
(function(e) {
  e.ExtensionPagesOnly = "TRUSTED_CONTEXTS", e.ExtensionPagesAndContentScripts = "TRUSTED_AND_UNTRUSTED_CONTEXTS";
})(E || (E = {}));
const a = globalThis.chrome, S = async (e, n) => {
  const s = (o) => typeof o == "function", r = (o) => (
    // Use ReturnType to infer the return type of the function and check if it's a Promise
    o instanceof Promise
  );
  return s(e) ? (r(e), e(n)) : e;
};
let _ = !1;
const T = (e) => {
  if (a && !a.storage[e])
    throw new Error(`"storage" permission in manifest.ts: "storage ${e}" isn't defined`);
}, A = (e, n, s) => {
  var m, f;
  let r = null, o = !1, i = [];
  const c = (s == null ? void 0 : s.storageEnum) ?? l.Local, w = ((m = s == null ? void 0 : s.serialization) == null ? void 0 : m.serialize) ?? ((t) => t), g = ((f = s == null ? void 0 : s.serialization) == null ? void 0 : f.deserialize) ?? ((t) => t);
  _ === !1 && c === l.Session && (s == null ? void 0 : s.sessionAccessForContentScripts) === !0 && (T(c), a == null || a.storage[c].setAccessLevel({
    accessLevel: E.ExtensionPagesAndContentScripts
  }).catch((t) => {
    console.error(t), console.error("Please call .setAccessLevel() into different context, like a background script.");
  }), _ = !0);
  const d = async () => {
    T(c);
    const t = await (a == null ? void 0 : a.storage[c].get([e]));
    return t ? g(t[e]) ?? n : n;
  }, L = async (t) => {
    o || (r = await d()), r = await S(t, r), await (a == null ? void 0 : a.storage[c].set({ [e]: w(r) })), h();
  }, p = (t) => (i = [...i, t], () => {
    i = i.filter((u) => u !== t);
  }), x = () => r, h = () => {
    i.forEach((t) => t());
  }, y = async (t) => {
    if (t[e] === void 0)
      return;
    const u = g(t[e].newValue);
    r !== u && (r = await S(u, r), h());
  };
  return d().then((t) => {
    r = t, o = !0, h();
  }), a == null || a.storage[c].onChanged.addListener(y), {
    get: d,
    set: L,
    getSnapshot: x,
    subscribe: p
  };
}, C = A("theme-storage-key", {
  theme: "light",
  isLight: !0
}, {
  storageEnum: l.Local
}), I = {
  ...C,
  toggle: async () => {
    await C.set((e) => {
      const n = e.theme === "light" ? "dark" : "light";
      return {
        theme: n,
        isLight: n === "light"
      };
    });
  }
};
I.get().then((e) => {
  console.log("theme", e);
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "readcursor_start_here",
    title: "Start reading from here",
    contexts: ["selection", "page"]
  });
});
chrome.contextMenus.onClicked.addListener(async (e, n) => {
  e.menuItemId === "readcursor_start_here" && n != null && n.id && chrome.tabs.sendMessage(n.id, {
    type: "START_FROM_SELECTION",
    ts: Date.now()
  });
});
const P = () => (chrome.runtime.getManifest().version_name ?? "").includes("-e2e");
chrome.runtime.onMessage.addListener((e, n, s) => {
  if ((e == null ? void 0 : e.type) !== "RC_E2E_INJECT") return;
  if (!P()) {
    s({ ok: !1, error: "RC_E2E_INJECT rejected: not an E2E build" });
    return;
  }
  const { urlPrefix: r } = e;
  return (async () => {
    const i = (await chrome.tabs.query({})).find((c) => typeof c.url == "string" && c.url.startsWith(r));
    if (!(i != null && i.id))
      throw new Error(`RC_E2E_INJECT: no tab found with urlPrefix="${r}"`);
    await chrome.scripting.executeScript({
      target: { tabId: i.id },
      files: ["content-runtime/readerApp.iife.js"]
    }), s({ ok: !0, tabId: i.id });
  })().catch((o) => {
    s({ ok: !1, error: (o == null ? void 0 : o.message) ?? String(o) });
  }), !0;
});
console.log("Background loaded");
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
