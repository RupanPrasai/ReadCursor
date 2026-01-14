var l;
(function(e) {
  e.Local = "local", e.Sync = "sync", e.Managed = "managed", e.Session = "session";
})(l || (l = {}));
var g;
(function(e) {
  e.ExtensionPagesOnly = "TRUSTED_CONTEXTS", e.ExtensionPagesAndContentScripts = "TRUSTED_AND_UNTRUSTED_CONTEXTS";
})(g || (g = {}));
const n = globalThis.chrome, E = async (e, r) => {
  const s = (i) => typeof i == "function", a = (i) => (
    // Use ReturnType to infer the return type of the function and check if it's a Promise
    i instanceof Promise
  );
  return s(e) ? (a(e), e(r)) : e;
};
let L = !1;
const C = (e) => {
  if (n && !n.storage[e])
    throw new Error(`"storage" permission in manifest.ts: "storage ${e}" isn't defined`);
}, f = (e, r, s) => {
  var S, T;
  let a = null, i = !1, c = [];
  const o = (s == null ? void 0 : s.storageEnum) ?? l.Local, w = ((S = s == null ? void 0 : s.serialization) == null ? void 0 : S.serialize) ?? ((t) => t), m = ((T = s == null ? void 0 : s.serialization) == null ? void 0 : T.deserialize) ?? ((t) => t);
  L === !1 && o === l.Session && (s == null ? void 0 : s.sessionAccessForContentScripts) === !0 && (C(o), n == null || n.storage[o].setAccessLevel({
    accessLevel: g.ExtensionPagesAndContentScripts
  }).catch((t) => {
    console.error(t), console.error("Please call .setAccessLevel() into different context, like a background script.");
  }), L = !0);
  const u = async () => {
    C(o);
    const t = await (n == null ? void 0 : n.storage[o].get([e]));
    return t ? m(t[e]) ?? r : r;
  }, x = async (t) => {
    i || (a = await u()), a = await E(t, a), await (n == null ? void 0 : n.storage[o].set({ [e]: w(a) })), h();
  }, p = (t) => (c = [...c, t], () => {
    c = c.filter((d) => d !== t);
  }), y = () => a, h = () => {
    c.forEach((t) => t());
  }, A = async (t) => {
    if (t[e] === void 0)
      return;
    const d = m(t[e].newValue);
    a !== d && (a = await E(d, a), h());
  };
  return u().then((t) => {
    a = t, i = !0, h();
  }), n == null || n.storage[o].onChanged.addListener(A), {
    get: u,
    set: x,
    getSnapshot: y,
    subscribe: p
  };
}, _ = f("theme-storage-key", {
  theme: "light",
  isLight: !0
}, {
  storageEnum: l.Local
}), P = {
  ..._,
  toggle: async () => {
    await _.set((e) => {
      const r = e.theme === "light" ? "dark" : "light";
      return {
        theme: r,
        isLight: r === "light"
      };
    });
  }
};
P.get().then((e) => {
  console.log("theme", e);
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "readcursor_start_here",
    title: "Start reading from here",
    contexts: ["selection", "page"]
  });
});
chrome.contextMenus.onClicked.addListener(async (e, r) => {
  e.menuItemId === "readcursor_start_here" && r != null && r.id && chrome.tabs.sendMessage(r.id, {
    type: "START_FROM_SELECTION",
    ts: Date.now()
  });
});
console.log("Background loaded");
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
