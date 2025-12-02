import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

interface Article {
  title: string | null;
  content: string;
  textContent: string;
  length: number;
  excerpt: string | null;
  byline: string | null;
  dir: string | null;
  siteName: string | null;
  lang: string | null;
  publishedTime: string | null;
}

/*
 function a(r, c = 20, O = 4) {
        if (!r) return !0;
        let T = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
            acceptNode: oe => oe.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }).nextNode();
        if (!T) return !0;
        let U = T.nodeValue,
            S = U.trim().split(/\s+/).slice(0, O).join(" ");
        if (!S) return !0;
        let Z = U.indexOf(S);
        if (Z === -1) return !0;
        let ce = document.createRange();
        ce.setStart(T, Z), ce.setEnd(T, Z + S.length);
        let R = ce.getBoundingClientRect();
        if (R.bottom <= 0 || R.top >= window.innerHeight || R.right <= 0 || R.left >= window.innerWidth) return !0;
        let Oe = [{
                x: R.left + R.width * .25,
                y: R.top + R.height * .5
            }, {
                x: R.left + R.width * .5,
                y: R.top + R.height * .5
            }, {
                x: R.left + R.width * .75,
                y: R.top + R.height * .5
            }],
            be = 0;
        for (let oe of Oe) {
            let de = document.elementFromPoint(oe.x, oe.y),
                fe = !1,
                ne = de;
            for (; ne && !fe;) {
                if (ne === r) {
                    fe = !0;
                    break
                }
                ne = ne.parentElement
            }
            let ue = de ? window.getComputedStyle(de) : null,
                Ct = ue?.pointerEvents === "none" || ue?.visibility === "hidden" || parseFloat(ue?.opacity || "1") < .1;
            !fe && !Ct && be++
        }
        return be / Oe.length * 100 >= c
    }

*/

/*
Se = {
  getAllReadableNodes: (e) => wx(e),

  getAllClusters: (e, t) => vx(e, t),

  getCriticalClustersAlgorithmic: (e, t) => {
    let n = rm(e);
    let r = {};

    // Initialize metric ranges
    for (let c of Object.keys(n)) {
      r[c] = {
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      };
    }

    // Compute raw metrics for each cluster and track min/max ranges
    return t
      .map((c) => {
        let f = Object.entries(n).reduce((d, [m, y]) => {
          d[m] = y(c);
          r[m].min = Math.min(r[m].min, d[m]);
          r[m].max = Math.max(r[m].max, d[m]);
          return d;
        }, {});

        return {
          cluster: c,
          metrics: f,
        };
      })

      // Normalize metrics (except totalTextLength)
      .map((c) => {
        let f = Object.entries(c.metrics).reduce((d, [m, y]) => {
          if (m === "totalTextLength") {
            d[m] = y;
            return d;
          }

          let { min: E, max: T } = r[m];
          let b = (y - E) / (T - E);

          d[m] = Number.isNaN(b) ? 0 : b;
          return d;
        }, {});

        return {
          ...c,
          metrics: f,
        };
      })

      // Compute final score for each cluster
      .map((c) => {
        let f = c.metrics;

        let d = 1 - f.linkDensity;
        let m = 1 - f.clusterCentrality;
        let y =
          f.averageFontSize >= 0.5
            ? f.averageFontSize
            : 1 - Math.abs(f.averageFontSize - 0.5) / 0.5;

        let E = {
          invertedCentrality: 0.4,
          invertedLinkDensity: 0.3,
          textDensity: 0.2,
          isInsideASemanticTag: 0.2,
          percentageTextShare: 0.3,
          fontSizeScore: 0.1,
        };

        let T =
          E.invertedCentrality * m +
          E.invertedLinkDensity * d +
          E.textDensity * f.textDensity +
          E.isInsideASemanticTag * f.isInsideASemanticTag +
          E.percentageTextShare * f.percentageTextShare +
          E.fontSizeScore * y;

        return {
          ...c,
          score: T,
        };
      })

      // Filter out tiny / low-score / off-screen clusters
      .filter((c) => {
        if (c.metrics.isInsideASemanticTag === 0 && c.metrics.totalTextLength < 30) {
          return false;
        }

        let f = Ce(c.cluster, e);

        if (f.width < 16 || f.height < 16) return false;
        if (f.width > window.innerWidth * 0.75) return false;
        if (c.score <= 0.7) return false;

        return true;
      });
  },

  getCriticalClustersModel: async (e, t) => {
    let n = sa(e, t);

    let r = t.map((s) => ({
      features: n.extract(s),
    }));

    let o = await Zs({
      clusters: r,
      ...ia(),
    });

    if (o.length === 0) return [];

    return Tx(t, e).filter((s, a) => o[a].label);
  },

  getPredictionsForClusters: async (e, t) => {
    let n = sa(e, t);

    let r = t.map((i) => ({
      features: n.extract(i),
    }));

    let o = await Zs({
      clusters: r,
      ...ia(),
    });

    if (o.length === 0) return [];

    return t.map((i, s) => ({
      cluster: t[s],
      isReadable: o[s].label,
      probability: o[s].probability,
    }));
  },

  getCriticalClusters: async (e, t) => {
    let n = await Yt("spatialParsingV4");

    if (n && n === "model") {
      let o = await Se.getCriticalClustersModel(e, t);
      if (o.length > 0) return o;
    }

    return Se.getCriticalClustersAlgorithmic(e, t);
  },

  getIsPageReadable: async (e = true, t = true) => {
    if (t) {
      await Gf(500, 1000);
    }

    let n = Ip("getIsPageReadable");

    let r = Se.getAllReadableNodes(e).filter(
      (I) => I.rect.y < 10 * window.innerHeight,
    );

    let o = await Yt("spatialParsingV4");
    Js("spatialParsingV4", o);

    let i = o && o === "model";

    let s = Se.getAllClusters(r, e);
    let a = await Se.getCriticalClusters(r, s);

    if (i) {
      // Drop table-only clusters when using the model
      a = a.filter((I) =>
        !I.cluster.every(
          (B) => r[B].node.nodeName.toLowerCase() === "table",
        ),
      );
    }

    let c = a.reduce((I, S) => I + S.metrics.totalTextLength, 0);
    let f = a.reduce(
      (I, S) =>
        S.metrics.totalTextLength > I.metrics.totalTextLength ? S : I,
      a[0],
    );

    if (!f) {
      return false;
    }

    // Author pages heuristic
    if (la().author && f.metrics.totalTextLength / c > 0.5) {
      n();
      return i ? f.metrics.totalTextLength > 600 : true;
    }

    // Column-based heuristic
    let d = 16;
    let m = new Map();

    for (let I of a) {
      let S = Ce(I.cluster, r);
      let B = Math.floor(S.x / d);

      if (!m.has(B)) m.set(B, []);
      m.get(B)?.push(I);
    }

    let { column: y } = Array.from(m.keys()).reduce(
      (I, S) => {
        let q = (m.get(S) ?? []).reduce((_, N) => {
          if (N.metrics.totalTextLength < 100) return _;
          return _ + N.metrics.totalTextLength;
        }, 0);

        return q > I.totalTextLength
          ? { column: S, totalTextLength: q }
          : I;
      },
      {
        column: -1,
        totalTextLength: 0,
      },
    );

    let T = (m.get(y) ?? []).reduce(
      (I, S) => I + S.metrics.totalTextLength,
      0,
    );

    let C =
      a
        .filter((I) => Ce(I.cluster, r).y < window.innerHeight * 2)
        .reduce((I, S) => I + S.metrics.totalTextLength, 0) /
        c >
      (window.innerHeight / document.documentElement.scrollHeight) * 0.75;

    let w = T / c > 0.5;
    let P = T > 1500;
    let L = y <= Math.ceil((0.65 * window.innerWidth) / d);

    let A = w && P && L;

    if (i) {
      A = w && P && L && C;
    }

    n();
    return A;
  },

  getMetadata: la,

  showDetectedClusters: async () => {
    let e = Se.getAllReadableNodes(true);
    let t = Se.getAllClusters(e, false);
    let n = await Se.getCriticalClusters(e, t);

    tm(n, e);
  },

  getParsedElements: async ({
    useHybridParsingMode: e,
    invalidateCache: t,
    shouldParseShadowRoot: n,
    startingNodeElement: r,
  }) => {
    let o = rn({
      ignoreCache: t,
      startingNode: r,
      shouldParseShadowRoot: n,
    });

    let i = Se.getAllReadableNodes(t ?? false);

    if (!(i.length < 2000 && e)) {
      return o;
    }

    let c = Se.getAllClusters(i, t ?? false);
    let f = await Se.getPredictionsForClusters(i, c);

    if (f.length === 0) {
      return o;
    }

    let d = o.filter((b) => i.some((x) => x.node.contains(b)));

    let m = o.length >= 5 ? 0.85 : 0.5;

    let y = f
      .filter((b) => !b.isReadable && b.probability[0] > m)
      .flatMap((b) => b.cluster.map((x) => i[x].node));

    let E = f
      .filter((b) => b.isReadable && b.probability[1] > m)
      .flatMap((b) => b.cluster.map((x) => i[x].node));

    return Ax(d, y, E);
  },

  printDebugInformation: () => {
    let e = Se.getAllReadableNodes(true);
    let t = Se.getAllClusters(e, false);

    let r = {
      clusters: Se.getCriticalClusters(e, t),
      metadata: la(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    let o = Qs(r);

    console.log(
      Array.from(o)
        .map((i) => i.toString(16).padStart(2, "0"))
        .join(""),
    );
  },
};

*/

/*

Sx = () => {
  // Reset global collections
  ua.length = 0;
  fa.length = 0;
  da.length = 0;
  ca.length = 0;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  const candidates = [];

  // Walk the DOM
  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (ea(node)) {
      // Directly readable node
      if (ur(node) && _p(node)) {
        candidates.push(node);
      }

      const tagName = node.nodeName.toLowerCase();

      if (Mp.has(tagName)) {
        ca.push(node);
      } else if (tagName === "table") {
        fa.push(node);
      } else if (tagName === "ul" || tagName === "ol") {
        da.push(node);
      } else if (["pre", "code"].includes(tagName)) {
        ua.push(node);
      }
    } else {
      // Fallback: try to find a surface node related to this one
      if (!Bp(node)) continue;

      const surface = Cx(node);

      if (
        !surface ||
        surface.closest('*[class*="speechify"]') ||
        !ea(surface) ||
        ca.some((c) => c.contains(surface))
      ) {
        continue;
      }

      const rect = surface.getBoundingClientRect();

      if (Wp(rect) || !qp(surface, rect) || Gp(surface)) {
        continue;
      }

      candidates.push(surface);
    }
  }

  // Post-process candidates
  const uniqueNodes = Array.from(new Set(Fp(candidates)));
  const mapper = Lp();

  return uniqueNodes.map(mapper);
};

*/

//======================================================

/*

Sx = () => {
        ua.length = 0, fa.length = 0, da.length = 0, ca.length = 0;
        let e = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT),
            t = [];
        for (; e.nextNode();) {
            let i = e.currentNode;
            if (ea(i)) ur(i) && _p(i) && t.push(i), Mp.has(i.nodeName.toLowerCase()) ? ca.push(i) : i.nodeName.toLowerCase() === "table" ? fa.push(i) : i.nodeName.toLowerCase() === "ul" || i.nodeName.toLowerCase() === "ol" ? da.push(i) : ["pre", "code"].includes(i.nodeName.toLowerCase()) && ua.push(i);
            else {
                if (!Bp(i)) continue;
                let s = Cx(i);
                if (s.closest('*[class*="speechify"]') || !s || !ea(s) || ca.some(c => c.contains(s))) continue;
                let a = s.getBoundingClientRect();
                if (Wp(a) || !qp(s, a) || Gp(s)) continue;
                t.push(s)
            }
        }
        let n = Array.from(new Set(Fp(t))),
            r = Lp();
        return n.map(r)
    }

*/
export function annotateWords() {
  const articleContainer = document.getElementById('content') ?? document.body;
  let wordIdCounter = 1;

  const walker = document.createTreeWalker(articleContainer, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (!node.textContent || node.textContent.trim() === '') {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentNode as Element;
      if (parent?.matches('script, style') || parent?.hasAttribute('data-word-id')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!(parent instanceof Element)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (parent.closest('script, style')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode: Text | null;

  const regex = /(\w+['-]?\w*|\W+)/g;

  while ((currentNode = walker.nextNode() as Text | null)) {
    const textContent = currentNode.nodeValue;
    if (!textContent) continue;

    const parts = textContent.match(regex);

    if (!parts?.length) continue;

    const fragment = document.createDocumentFragment();

    for (const part of parts) {
      if (/\w/.test(part)) {
        const span = document.createElement('span');
        span.setAttribute('data-word-id', String(wordIdCounter++));
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    }

    const parentNode = currentNode.parentNode;
    if (parentNode) {
      parentNode.replaceChild(fragment, currentNode);
      walker.currentNode = parentNode;
    }
  }

  return wordIdCounter;
}
