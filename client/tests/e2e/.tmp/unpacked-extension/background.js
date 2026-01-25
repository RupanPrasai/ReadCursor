var f;
(function(e) {
  e.Local = "local", e.Sync = "sync", e.Managed = "managed", e.Session = "session";
})(f || (f = {}));
var b;
(function(e) {
  e.ExtensionPagesOnly = "TRUSTED_CONTEXTS", e.ExtensionPagesAndContentScripts = "TRUSTED_AND_UNTRUSTED_CONTEXTS";
})(b || (b = {}));
const a = globalThis.chrome, I = (e) => {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}, N = async (e, t) => ((s) => typeof s == "function")(e) ? await e(t) : e;
let x = !1;
const z = (e) => {
  var t;
  if (a && !((t = a.storage) != null && t[e]))
    throw new Error(`"storage" permission in manifest.ts: "storage ${e}" isn't defined`);
}, K = (e, t, r) => {
  var L, M, F, S, P, T, v, W;
  let s = null, d = !1, i = [];
  const l = (r == null ? void 0 : r.storageEnum) ?? f.Local, X = ((L = r == null ? void 0 : r.serialization) == null ? void 0 : L.serialize) ?? ((n) => n), _ = ((M = r == null ? void 0 : r.serialization) == null ? void 0 : M.deserialize) ?? ((n) => n);
  let p = null;
  x === !1 && l === f.Session && (r == null ? void 0 : r.sessionAccessForContentScripts) === !0 && (z(l), (T = (P = (S = (F = a == null ? void 0 : a.storage) == null ? void 0 : F[l]) == null ? void 0 : S.setAccessLevel) == null ? void 0 : P.call(S, {
    accessLevel: b.ExtensionPagesAndContentScripts
  })) == null || T.catch((n) => {
    console.error(n), console.error("Please call .setAccessLevel() into different context, like a background script.");
  }), x = !0);
  const w = async () => {
    var o, c, u;
    z(l);
    const n = await ((u = (c = (o = a == null ? void 0 : a.storage) == null ? void 0 : o[l]) == null ? void 0 : c.get) == null ? void 0 : u.call(c, [e]));
    return n ? _(n[e]) ?? t : t;
  }, j = async (n) => {
    var c, u, A;
    d || (s = await w()), s = await N(n, s);
    const o = X(s);
    p = I(o), await ((A = (u = (c = a == null ? void 0 : a.storage) == null ? void 0 : c[l]) == null ? void 0 : u.set) == null ? void 0 : A.call(u, { [e]: o })), C();
  }, k = (n) => (i = [...i, n], () => {
    i = i.filter((o) => o !== n);
  }), H = () => s, C = () => {
    i.forEach((n) => n());
  }, q = async (n) => {
    const o = n[e];
    if (o === void 0)
      return;
    const c = o == null ? void 0 : o.newValue;
    if (p != null && I(c) === p)
      return;
    const u = c === void 0 ? t : _(c) ?? t;
    s !== u && (s = await N(u, s), C());
  };
  return w().then((n) => {
    s = n, d = !0, C();
  }), (W = (v = a == null ? void 0 : a.storage) == null ? void 0 : v.onChanged) != null && W.addListener && a.storage.onChanged.addListener((n, o) => {
    o === l && q(n);
  }), {
    get: w,
    set: j,
    getSnapshot: H,
    subscribe: k
  };
}, R = 50, D = 350;
function O(e, t, r) {
  const s = typeof e == "number" && Number.isFinite(e) ? Math.trunc(e) : t;
  return Math.max(t, Math.min(r, s));
}
function G(e, t) {
  if (typeof e != "string")
    return t;
  const r = e.trim(), s = r.startsWith("#") ? r : `#${r}`;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : t;
}
const h = {
  schemaVersion: 1,
  defaultWpm: 150,
  rememberLastWpm: !0,
  lastWpm: 150,
  highlightColor: "#f59e0b",
  autoScrollEnabled: !0,
  startFromSelectionEnabled: !0,
  rememberPanelState: !0
};
function Q(e) {
  const t = O(e.defaultWpm, R, D), r = O(e.lastWpm, R, D);
  return {
    schemaVersion: 1,
    defaultWpm: t,
    rememberLastWpm: !!e.rememberLastWpm,
    lastWpm: r,
    highlightColor: G(e.highlightColor, h.highlightColor),
    autoScrollEnabled: !!e.autoScrollEnabled,
    startFromSelectionEnabled: !!e.startFromSelectionEnabled,
    rememberPanelState: !!e.rememberPanelState
  };
}
const y = K("readcursor:prefs", h, {
  storageEnum: f.Sync
}), B = {
  ...y,
  defaults: h,
  setPartial: async (e) => {
    await y.set((t) => Q({ ...t ?? h, ...e }));
  },
  reset: async () => {
    await y.set(h);
  }
}, E = "readcursor_start_here";
function U() {
  chrome.runtime.lastError;
}
function J(e) {
  return new Promise((t) => {
    chrome.contextMenus.remove(e, () => {
      U(), t();
    });
  });
}
function Y() {
  return new Promise((e) => {
    chrome.contextMenus.create(
      {
        id: E,
        title: "Start reading from here",
        contexts: ["selection", "page"]
      },
      () => {
        U(), e();
      }
    );
  });
}
let m = null;
async function g() {
  return m || (m = (async () => {
    let e = !0;
    try {
      e = !!(await B.get()).startFromSelectionEnabled;
    } catch {
      e = !0;
    }
    e ? (await J(E), await Y()) : await J(E);
  })().finally(() => {
    m = null;
  }), m);
}
chrome.runtime.onInstalled.addListener(() => {
  g();
});
var V;
(V = chrome.runtime.onStartup) == null || V.addListener(() => {
  g();
});
g();
chrome.storage.onChanged.addListener((e, t) => {
  t !== "sync" && t !== "local" || g();
});
chrome.contextMenus.onClicked.addListener(async (e, t) => {
  if (e.menuItemId === E && t != null && t.id) {
    try {
      if (!(await B.get()).startFromSelectionEnabled) return;
    } catch {
    }
    chrome.tabs.sendMessage(t.id, {
      type: "START_FROM_SELECTION",
      ts: Date.now()
    });
  }
});
const Z = () => (chrome.runtime.getManifest().version_name ?? "").includes("-e2e");
chrome.runtime.onMessage.addListener((e, t, r) => {
  if ((e == null ? void 0 : e.type) !== "RC_E2E_INJECT") return;
  if (!Z()) {
    r({ ok: !1, error: "RC_E2E_INJECT rejected: not an E2E build" });
    return;
  }
  const { urlPrefix: s } = e;
  return (async () => {
    const i = (await chrome.tabs.query({})).find((l) => typeof l.url == "string" && l.url.startsWith(s));
    if (!(i != null && i.id))
      throw new Error(`RC_E2E_INJECT: no tab found with urlPrefix="${s}"`);
    await chrome.scripting.executeScript({
      target: { tabId: i.id },
      files: ["content-runtime/readerApp.iife.js"]
    }), r({ ok: !0, tabId: i.id });
  })().catch((d) => {
    r({ ok: !1, error: (d == null ? void 0 : d.message) ?? String(d) });
  }), !0;
});
console.log("Background loaded");
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
