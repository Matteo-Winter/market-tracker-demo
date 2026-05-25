import { prisma } from "../prisma";
import { parse } from "csv-parse/sync";

const REVIEW_RATING_EPS = 0.05;
const REVIEW_COUNT_REL_TOL = 0.03;
const PARENT_TOL = 0.07;
const PARENT_STRONG_TOL = 0.09;
const PRICE_TOL = 0.25;
const PRICE_SOFT_TOL = 0.45;
const TITLE_SIM_STRONG = 0.72;
const TITLE_SIM_MIN = 0.45;
const TITLE_SIM_SOFT = 0.18;
const AMBIGUITY_GAP = 1.5;
const ANCHOR_ATTACH_SCORE = 7.5;
const RESIDUAL_MERGE_SCORE = 8;
const MAX_RESIDUAL_MERGE_PASSES = 2;

const within = (a?: number | null, b?: number | null, tol = PARENT_TOL) => {
  if (a == null || b == null) return false;
  if (a === 0 || b === 0) return a === b;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tol;
};

const DEBUG = process.env.DEBUG_IMPORT === "1";
const dlog = (...args: any[]) => DEBUG && console.log(...args);

function norm(s: string) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function cleanNA(s: any): string | null {
  const v = (s ?? "").toString().trim();
  if (!v || v === "N/A" || v === "n/a") return null;
  return v;
}

function parseNumberDE(s: any): number | null {
  const v0 = cleanNA(s);
  if (!v0) return null;
  let v = v0.replace(/\s/g, "").replace(/€/g, "");

  if (v.includes(".") && v.includes(",")) {
    if (v.lastIndexOf(",") > v.lastIndexOf(".")) {
      v = v.replace(/\./g, "").replace(",", ".");
    } else {
      v = v.replace(/,/g, "");
    }
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseIntDE(s: any): number | null {
  const n = parseNumberDE(s);
  if (n === null) return null;
  return Math.round(n);
}

function normalizeImageUrl(url: string | null) {
  if (!url) return null;
  let u = url.trim();
  u = u.replace(/\._[A-Z0-9,]+_\./g, ".");
  return u;
}

function normalizeCode(code: string | null) {
  const c = cleanNA(code);
  return c ? c.replace(/[^0-9A-Za-z]/g, "") : null;
}

const TITLE_STOPWORDS = new Set([
  "der", "die", "das", "und", "mit", "fuer", "für", "set", "pack", "stueck", "stück", "farbe",
  "inkl", "inklusive", "von", "im", "am", "an", "aus", "ein", "eine", "kg", "g", "ml", "l",
]);

function titleTokens(title: string | null) {
  const s = norm(title ?? "");
  if (!s) return [] as string[];
  return s
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
}

function titleFingerprint(title: string | null) {
  const toks = [...new Set(titleTokens(title))].sort();
  return toks.slice(0, 8).join("|");
}

function titleSimilarity(a: string | null, b: string | null) {
  const sa = new Set(titleTokens(a));
  const sb = new Set(titleTokens(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / new Set([...sa, ...sb]).size;
}

function tokenSimilarity(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / new Set([...sa, ...sb]).size;
}

function buildGroupTokenBag(titles: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const tok of titleTokens(title)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tok]) => tok);
}

const FAMILY_IGNORE_TOKENS = new Set([
  "original", "premium", "comfort", "classic", "plus", "set", "komplett",
  "system", "city", "gardening", "ideal", "ideales", "optimales", "stabiler",
  "praktischer", "manueller", "manuell", "einfaches", "automatische", "automatischer",
  "automatisch", "flexible", "robusten", "hochleistungs", "hochbelastische",
  "arbeitsbreite", "qualitaetsschlauch", "qualitaet", "schwenkbare", "inkl", "passend",
  "integrierter", "integrierte", "verriegelungsfunktion", "schultergurt",
  "duesenschutz", "dosiersystem", "verwendbar", "lanze", "trittflaeche", "messingduese"
]);

const FAMILY_BRIDGE_BROAD_TOKENS = new Set([
  "schlauch", "gartenschlauch", "bewaesserung", "bewaesserungs", "automatik", "automatic",
  "geraet", "zubehoer", "systemteilen", "systemteile", "system", "combisystem",
  "set", "komplett", "flex", "classic", "comfort", "premium", "city", "gardening",
  "rasen", "garten", "haus", "wege", "terrasse", "balkon", "wasser", "gartenzubehoer"
]);

function familyTokens(title: string | null) {
  return titleTokens(title).filter((tok) => {
    if (tok.length < 6) return false;
    if (FAMILY_IGNORE_TOKENS.has(tok)) return false;
    if (/^\d+$/.test(tok)) return false;
    if (/^\d+(?:[.,]\d+)?(?:mm|cm|m|ml|l|kg|g|v|w|ah)$/.test(tok)) return false;
    return true;
  });
}

function strongFamilyBridgeTokens(tokens: string[]) {
  return tokens.filter((tok) => tok.length >= 8 && !FAMILY_BRIDGE_BROAD_TOKENS.has(tok));
}

function buildGroupFamilyTokens(titles: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const tok of familyTokens(title)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([tok]) => tok);
}

function buildGroupSpecTokens(titles: (string | null)[]) {
  const specs = new Map<string, number>();
  for (const title of titles) {
    const s = (title ?? "").toLowerCase().replace(/,/g, ".");
    const matches = s.match(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|ml|l|kg|g|v|w|ah)\b/g) ?? [];
    for (const m of matches) {
      const key = m.replace(/\s+/g, "");
      specs.set(key, (specs.get(key) ?? 0) + 1);
    }
  }
  return [...specs.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tok]) => tok);
}

function titleFamilyBridge(a: string[], b: string[]) {
  const aa = strongFamilyBridgeTokens(a);
  const bb = strongFamilyBridgeTokens(b);

  const exact = new Set(aa.filter((tok) => bb.includes(tok)));
  if (exact.size > 0) {
    return { exact: exact.size, contains: 0, bridged: true, hasStrongTokens: aa.length > 0 && bb.length > 0 };
  }

  let contains = 0;
  for (const ta of aa) {
    for (const tb of bb) {
      if (ta === tb) continue;
      const shorter = ta.length < tb.length ? ta : tb;
      const longer = ta.length < tb.length ? tb : ta;
      if (shorter.length < 10) continue;
      if (longer.includes(shorter)) contains += 1;
    }
  }
  return {
    exact: 0,
    contains,
    bridged: contains > 0,
    hasStrongTokens: aa.length > 0 && bb.length > 0,
  };
}

function hasConflictingStrongFamilyTokens(a: string[], b: string[]) {
  const aa = strongFamilyBridgeTokens(a);
  const bb = strongFamilyBridgeTokens(b);
  if (aa.length === 0 || bb.length === 0) return false;
  const bridge = titleFamilyBridge(a, b);
  return !bridge.bridged;
}

function sharedSpecTokenCount(a: string[], b: string[]) {
  const sb = new Set(b);
  let count = 0;
  for (const tok of a) if (sb.has(tok)) count += 1;
  return count;
}

function median(nums: number[]): number | null {
  const a = nums.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function medianFloat(nums: (number | null | undefined)[]) {
  return median(nums.filter((x): x is number => typeof x === "number"));
}

function medianInt(nums: (number | null | undefined)[]) {
  const m = median(nums.filter((x): x is number => typeof x === "number"));
  return m == null ? null : Math.round(m);
}

function relativeCountClose(a?: number | null, b?: number | null) {
  if (a == null || b == null) return false;
  if (a === 0 || b === 0) return a === b;
  return Math.abs(a - b) / Math.max(a, b) <= REVIEW_COUNT_REL_TOL;
}

function ratingKey(v?: number | null) {
  return typeof v === "number" ? v.toFixed(2) : null;
}

function exactMoneyKey(v?: number | null) {
  return typeof v === "number" ? v.toFixed(2) : null;
}

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

type CategoryNodeLite = { id: string; name: string; path: string; isLeaf: boolean };

type PreparedRow = {
  asin: string;
  title: string | null;
  brand: string | null;
  brandNorm: string | null;
  imageUrl: string | null;
  leafString: string | null;
  price: number | null;
  parentRevenue: number | null;
  parentSales: number | null;
  asinRevenue: number | null;
  asinSales: number | null;
  reviewsCount: number | null;
  rating: number | null;
  ean: string | null;
  gtin: string | null;
  upc: string | null;
  isbn: string | null;
  url: string | null;
  bsr: number | null;
  subcatBsr: number | null;
};

type GroupProfile = {
  root: number;
  idxs: number[];
  repIdx: number;
  title: string | null;
  titles: (string | null)[];
  titleBag: string[];
  familyTokens: string[];
  specTokens: string[];
  brandNorm: string | null;
  leafKey: string | null;
  titleFp: string;
  priceMedian: number | null;
  parentRevenue: number | null;
  parentSales: number | null;
  reviewsCount: number | null;
  rating: number | null;
  imageUrl: string | null;
  codeSet: Set<string>;
  exactParentDupKey: string | null;
  exactReviewDupKey: string | null;
  exactRevenueDupKey: string | null;
  duplicatedImage: boolean;
};

function buildGroups(prepared: PreparedRow[], dsu: DSU) {
  const groups = new Map<number, number[]>();
  for (let i = 0; i < prepared.length; i++) {
    const root = dsu.find(i);
    const arr = groups.get(root) ?? [];
    arr.push(i);
    groups.set(root, arr);
  }
  return groups;
}

function duplicateKey(idxs: number[], getKey: (row: PreparedRow) => string | null, prepared: PreparedRow[]) {
  const freq = new Map<string, number>();
  for (const i of idxs) {
    const k = getKey(prepared[i]);
    if (!k) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const dup = [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return dup;
}

function buildProfiles(prepared: PreparedRow[], groups: Map<number, number[]>) {
  const profiles = new Map<number, GroupProfile>();

  for (const [root, idxs] of groups.entries()) {
    let repIdx = idxs[0];
    for (const j of idxs) {
      const a = prepared[j].asinRevenue ?? -1;
      const b = prepared[repIdx].asinRevenue ?? -1;
      if (a > b) repIdx = j;
    }

    const rep = prepared[repIdx];
    const titles = idxs.map((i) => prepared[i].title);
    const titleBag = buildGroupTokenBag(titles);
    const familyTokensBag = buildGroupFamilyTokens(titles);
    const specTokensBag = buildGroupSpecTokens(titles);

    const leafCounts = new Map<string, number>();
    for (const j of idxs) {
      const ls = prepared[j].leafString ? norm(prepared[j].leafString!) : null;
      if (!ls) continue;
      leafCounts.set(ls, (leafCounts.get(ls) ?? 0) + 1);
    }
    const leafKey = [...leafCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const codeSet = new Set<string>();
    for (const j of idxs) {
      for (const c of [prepared[j].ean, prepared[j].gtin, prepared[j].upc, prepared[j].isbn]) {
        if (c) codeSet.add(c);
      }
    }

    const exactParentDupKey = duplicateKey(
      idxs,
      (row) => row.parentRevenue != null && row.parentSales != null ? `${row.parentRevenue.toFixed(2)}|${row.parentSales}` : null,
      prepared,
    );
    const exactReviewDupKey = duplicateKey(
      idxs,
      (row) => row.reviewsCount != null && row.rating != null ? `${row.reviewsCount}|${row.rating.toFixed(2)}` : null,
      prepared,
    );
    const exactRevenueDupKey = duplicateKey(
      idxs,
      (row) => exactMoneyKey(row.parentRevenue),
      prepared,
    );
    const duplicatedImage = duplicateKey(idxs, (row) => row.imageUrl, prepared) != null;

    profiles.set(root, {
      root,
      idxs,
      repIdx,
      title: rep.title,
      titles,
      titleBag,
      familyTokens: familyTokensBag,
      specTokens: specTokensBag,
      brandNorm: rep.brandNorm,
      leafKey,
      titleFp: titleFingerprint(rep.title),
      priceMedian: medianFloat(idxs.map((i) => prepared[i].price)),
      parentRevenue: medianFloat(idxs.map((i) => prepared[i].parentRevenue)),
      parentSales: medianInt(idxs.map((i) => prepared[i].parentSales)),
      reviewsCount: medianInt(idxs.map((i) => prepared[i].reviewsCount)),
      rating: medianFloat(idxs.map((i) => prepared[i].rating)),
      imageUrl: rep.imageUrl,
      codeSet,
      exactParentDupKey,
      exactReviewDupKey,
      exactRevenueDupKey,
      duplicatedImage,
    });
  }

  return profiles;
}

function sameBrandCompatible(a: GroupProfile, b: GroupProfile) {
  if (!a.brandNorm || !b.brandNorm) return true;
  return a.brandNorm === b.brandNorm;
}

function sameLeafCompatible(a: GroupProfile, b: GroupProfile) {
  if (!a.leafKey || !b.leafKey) return true;
  return a.leafKey === b.leafKey;
}

function sharedCodeCount(a: GroupProfile, b: GroupProfile) {
  let count = 0;
  for (const c of a.codeSet) if (b.codeSet.has(c)) count += 1;
  return count;
}

function exactParentMatch(a: GroupProfile, b: GroupProfile) {
  return a.parentRevenue != null && b.parentRevenue != null && a.parentSales != null && b.parentSales != null &&
    a.parentRevenue.toFixed(2) === b.parentRevenue.toFixed(2) && a.parentSales === b.parentSales;
}

function exactRevenueMatch(a: GroupProfile, b: GroupProfile) {
  const ak = exactMoneyKey(a.parentRevenue);
  const bk = exactMoneyKey(b.parentRevenue);
  return !!ak && ak === bk;
}

function familyStrongMatch(a: GroupProfile, b: GroupProfile) {
  const sameLeaf = !!a.leafKey && !!b.leafKey && a.leafKey === b.leafKey;
  const exactReviews = a.reviewsCount != null && b.reviewsCount != null && a.reviewsCount === b.reviewsCount;
  const sameRating = a.rating != null && b.rating != null && Math.abs(a.rating - b.rating) <= REVIEW_RATING_EPS;
  const revStrongNear = within(a.parentRevenue, b.parentRevenue, PARENT_STRONG_TOL);
  const salesStrongNear = within(a.parentSales, b.parentSales, PARENT_STRONG_TOL);
  return sameBrandCompatible(a, b) && sameLeaf && exactReviews && sameRating && revStrongNear && salesStrongNear;
}

function deterministicStrongMerge(prepared: PreparedRow[], dsu: DSU) {
  let changed = false;
  const groups = buildGroups(prepared, dsu);
  const profiles = [...buildProfiles(prepared, groups).values()];

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      if (familyStrongMatch(a, b)) {
        if (dsu.find(a.root) !== dsu.find(b.root)) {
          dlog("strong-family-merge", a.root, b.root);
          dsu.union(a.root, b.root);
          changed = true;
        }
      }
    }
  }

  return changed;
}

function isAnchorGroup(profile: GroupProfile) {
  if (profile.idxs.length < 2) return false;
  if (profile.exactParentDupKey) return true;
  if (profile.exactReviewDupKey) return true;
  if (profile.exactRevenueDupKey) return true;
  if (profile.duplicatedImage) return true;
  if (profile.codeSet.size > 0 && profile.idxs.length >= 2) return true;
  return false;
}

function titleScore(a: GroupProfile, b: GroupProfile) {
  return Math.max(tokenSimilarity(a.titleBag, b.titleBag), titleSimilarity(a.title, b.title));
}

function titleFamilyScore(a: GroupProfile, b: GroupProfile) {
  const bridge = titleFamilyBridge(a.familyTokens, b.familyTokens);
  const specShared = sharedSpecTokenCount(a.specTokens, b.specTokens);
  const conflictingStrongFamily = hasConflictingStrongFamilyTokens(a.familyTokens, b.familyTokens);
  return {
    bridged: bridge.bridged,
    exactFamily: bridge.exact,
    containsFamily: bridge.contains,
    hasStrongTokens: bridge.hasStrongTokens,
    conflictingStrongFamily,
    specShared,
  };
}

function hardAnchorLink(a: GroupProfile, b: GroupProfile) {
  const sameExactRevenue = exactRevenueMatch(a, b);
  const family = titleFamilyScore(a, b);

  if (!sameBrandCompatible(a, b)) return false;
  if (family.conflictingStrongFamily && !sameExactRevenue) return false;
  if (!sameLeafCompatible(a, b) && !sameExactRevenue && !family.bridged) return false;

  if (a.exactRevenueDupKey && b.exactRevenueDupKey && a.exactRevenueDupKey !== b.exactRevenueDupKey) {
    return false;
  }

  if (a.exactReviewDupKey && b.exactReviewDupKey && a.exactReviewDupKey !== b.exactReviewDupKey && !sameExactRevenue) {
    return false;
  }

  if (sameExactRevenue && !family.conflictingStrongFamily) return true;

  const sharedCodes = sharedCodeCount(a, b);
  if (sharedCodes > 0) return true;
  if (a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl) return true;

  const sameExactParentFamily = !!a.exactParentDupKey && !!b.exactParentDupKey && a.exactParentDupKey === b.exactParentDupKey;
  const sameExactReviewFamily = !!a.exactReviewDupKey && !!b.exactReviewDupKey && a.exactReviewDupKey === b.exactReviewDupKey;

  if (sameExactParentFamily) {
    return true;
  }

  if (sameExactReviewFamily && (sameLeafCompatible(a, b) || titleScore(a, b) >= TITLE_SIM_MIN || family.bridged)) {
    return true;
  }

  if (
    family.bridged &&
    !family.conflictingStrongFamily &&
    (family.specShared > 0 || titleScore(a, b) >= TITLE_SIM_MIN) &&
    (within(a.parentRevenue, b.parentRevenue, PARENT_TOL) || within(a.parentSales, b.parentSales, PARENT_TOL))
  ) {
    return true;
  }

  return false;
}

function mergeAnchorsHardOnly(prepared: PreparedRow[], dsu: DSU) {
  let changed = false;
  const groups = buildGroups(prepared, dsu);
  const profiles = [...buildProfiles(prepared, groups).values()].filter(isAnchorGroup);

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      if (!hardAnchorLink(a, b)) continue;
      if (dsu.find(a.root) !== dsu.find(b.root)) {
        dlog("anchor-hard-merge", a.root, b.root);
        dsu.union(a.root, b.root);
        changed = true;
      }
    }
  }

  return changed;
}

function scoreAttachToAnchor(anchor: GroupProfile, candidate: GroupProfile) {
  const sameExactRevenue = exactMoneyKey(anchor.parentRevenue) != null &&
    exactMoneyKey(anchor.parentRevenue) === exactMoneyKey(candidate.parentRevenue);
  const family = titleFamilyScore(anchor, candidate);

  if (!sameBrandCompatible(anchor, candidate)) return null;
  if (family.conflictingStrongFamily && !sameExactRevenue) return null;
  if (!sameLeafCompatible(anchor, candidate) && !sameExactRevenue && !family.bridged) return null;

  if (anchor.exactRevenueDupKey && exactMoneyKey(candidate.parentRevenue) && anchor.exactRevenueDupKey !== exactMoneyKey(candidate.parentRevenue) && !family.bridged) {
    return null;
  }

  const reasons: string[] = [];
  let score = 0;

  const sharedCodes = sharedCodeCount(anchor, candidate);
  if (sharedCodes > 0) {
    score += 5;
    reasons.push("shared-code");
  }

  if (anchor.imageUrl && candidate.imageUrl && anchor.imageUrl === candidate.imageUrl) {
    score += 5;
    reasons.push("same-image");
  }

  if (exactParentMatch(anchor, candidate)) {
    score += 5;
    reasons.push("same-parent-metrics-exact");
  }

  if (sameExactRevenue) {
    score += 6;
    reasons.push("same-parent-revenue-exact");
  }

  const revStrongNear = within(anchor.parentRevenue, candidate.parentRevenue, PARENT_STRONG_TOL);
  const salesStrongNear = within(anchor.parentSales, candidate.parentSales, PARENT_STRONG_TOL);
  const revNear = within(anchor.parentRevenue, candidate.parentRevenue, PARENT_TOL);
  const salesNear = within(anchor.parentSales, candidate.parentSales, PARENT_TOL);
  if (!sameExactRevenue && revStrongNear) { score += 2; reasons.push("strong-parent-revenue"); }
  else if (!sameExactRevenue && revNear) { score += 1; reasons.push("near-parent-revenue"); }
  if (salesStrongNear) { score += 2; reasons.push("strong-parent-sales"); }
  else if (salesNear) { score += 1; reasons.push("near-parent-sales"); }

  const exactReviews = anchor.reviewsCount != null && candidate.reviewsCount != null && anchor.reviewsCount === candidate.reviewsCount;
  const nearReviews = relativeCountClose(anchor.reviewsCount, candidate.reviewsCount);
  if (exactReviews) { score += 2; reasons.push("same-reviews"); }
  else if (nearReviews) { score += 1; reasons.push("near-reviews"); }

  const ratingDiff = anchor.rating != null && candidate.rating != null ? Math.abs(anchor.rating - candidate.rating) : null;
  if (ratingDiff != null && ratingDiff <= REVIEW_RATING_EPS) { score += 2; reasons.push("same-rating"); }
  else if (ratingDiff != null && ratingDiff <= 0.1) { score += 0.5; reasons.push("near-rating"); }
  else if (family.bridged && family.specShared > 0 && ratingDiff != null && ratingDiff <= 0.25) { score += 0.5; reasons.push("family-rating-extended"); }

  const ts = titleScore(anchor, candidate);
  if (ts >= TITLE_SIM_STRONG) { score += 4; reasons.push("title-strong"); }
  else if (ts >= TITLE_SIM_MIN) { score += 3; reasons.push("title-near"); }
  else if (ts >= TITLE_SIM_SOFT) { score += 1; reasons.push("title-soft"); }

  if (family.bridged && !family.conflictingStrongFamily) {
    score += family.exactFamily > 0 ? 3 : 2;
    reasons.push("title-family-bridge");
  }
  if (family.specShared > 0) {
    score += 1.5;
    reasons.push("shared-spec-token");
  }

  if (within(anchor.priceMedian, candidate.priceMedian, PRICE_TOL)) { score += 1; reasons.push("near-price"); }
  else if (within(anchor.priceMedian, candidate.priceMedian, PRICE_SOFT_TOL)) { score += 0.5; reasons.push("soft-price"); }

  if (anchor.brandNorm && candidate.brandNorm && anchor.brandNorm === candidate.brandNorm) {
    score += 1;
    reasons.push("same-brand");
  }
  if (anchor.leafKey && candidate.leafKey && anchor.leafKey === candidate.leafKey) {
    score += 1;
    reasons.push("same-leaf");
  }

  const strongEvidence =
    (sameExactRevenue && !family.conflictingStrongFamily) ||
    sharedCodes > 0 ||
    (anchor.imageUrl && candidate.imageUrl && anchor.imageUrl === candidate.imageUrl) ||
    exactParentMatch(anchor, candidate) ||
    familyStrongMatch(anchor, candidate) ||
    (family.bridged && !family.conflictingStrongFamily && ((family.specShared > 0 && (revNear || salesNear || ts >= TITLE_SIM_MIN)) || ts >= TITLE_SIM_STRONG));

  if (!strongEvidence) return null;
  return { score, reasons };
}

function attachNonAnchorsToAnchors(prepared: PreparedRow[], dsu: DSU) {
  let changed = false;
  const groups = buildGroups(prepared, dsu);
  const profiles = [...buildProfiles(prepared, groups).values()];
  const anchors = profiles.filter(isAnchorGroup);
  const nonAnchors = profiles.filter((p) => !isAnchorGroup(p));

  for (const candidate of nonAnchors) {
    const candidates: { root: number; score: number; reasons: string[] }[] = [];
    for (const anchor of anchors) {
      const scored = scoreAttachToAnchor(anchor, candidate);
      if (!scored) continue;
      candidates.push({ root: anchor.root, score: scored.score, reasons: scored.reasons });
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];
    if (!best) continue;
    if (best.score < ANCHOR_ATTACH_SCORE) continue;
    if (second && best.score - second.score < AMBIGUITY_GAP) continue;
    if (dsu.find(candidate.root) !== dsu.find(best.root)) {
      dlog("attach-to-anchor", candidate.root, "->", best.root, best.score, best.reasons);
      dsu.union(candidate.root, best.root);
      changed = true;
    }
  }

  return changed;
}

function scoreResidualPair(a: GroupProfile, b: GroupProfile) {
  const sameExactRevenue = exactRevenueMatch(a, b);
  const family = titleFamilyScore(a, b);

  if (!sameBrandCompatible(a, b)) return null;
  if (family.conflictingStrongFamily && !sameExactRevenue) return null;
  if (!sameLeafCompatible(a, b) && !sameExactRevenue && !family.bridged) return null;

  if (a.exactRevenueDupKey && b.exactRevenueDupKey && a.exactRevenueDupKey !== b.exactRevenueDupKey && !family.bridged) {
    return null;
  }

  if (a.exactReviewDupKey && b.exactReviewDupKey && a.exactReviewDupKey !== b.exactReviewDupKey && !sameExactRevenue && !family.bridged) {
    return null;
  }

  const reasons: string[] = [];
  let score = 0;

  const sharedCodes = sharedCodeCount(a, b);
  if (sharedCodes > 0) {
    score += 5;
    reasons.push("shared-code");
  }

  if (a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl) {
    score += 5;
    reasons.push("same-image");
  }

  const exactParent = exactParentMatch(a, b);
  if (exactParent) {
    score += 4;
    reasons.push("same-parent-metrics-exact");
  }

  if (sameExactRevenue) {
    score += 6;
    reasons.push("same-parent-revenue-exact");
  }

  const revNear = within(a.parentRevenue, b.parentRevenue, PARENT_TOL);
  const salesNear = within(a.parentSales, b.parentSales, PARENT_TOL);
  if (!sameExactRevenue && revNear) { score += 2; reasons.push("near-parent-revenue"); }
  if (salesNear) { score += 2; reasons.push("near-parent-sales"); }

  const exactReviews = a.reviewsCount != null && b.reviewsCount != null && a.reviewsCount === b.reviewsCount;
  const nearReviews = relativeCountClose(a.reviewsCount, b.reviewsCount);
  if (exactReviews) { score += 2; reasons.push("same-reviews"); }
  else if (nearReviews) { score += 1; reasons.push("near-reviews"); }

  const ratingDiff = a.rating != null && b.rating != null ? Math.abs(a.rating - b.rating) : null;
  if (ratingDiff != null && ratingDiff <= REVIEW_RATING_EPS) { score += 2; reasons.push("same-rating"); }
  else if (ratingDiff != null && ratingDiff <= 0.1) { score += 0.5; reasons.push("near-rating"); }
  else if (family.bridged && family.specShared > 0 && ratingDiff != null && ratingDiff <= 0.25) { score += 0.5; reasons.push("family-rating-extended"); }

  const ts = titleScore(a, b);
  if (ts >= TITLE_SIM_STRONG) { score += 4; reasons.push("title-strong"); }
  else if (ts >= TITLE_SIM_MIN) { score += 2.5; reasons.push("title-near"); }
  else if (ts >= TITLE_SIM_SOFT) { score += 1; reasons.push("title-soft"); }

  if (family.bridged && !family.conflictingStrongFamily) {
    score += family.exactFamily > 0 ? 3 : 2;
    reasons.push("title-family-bridge");
  }
  if (family.specShared > 0) {
    score += 1.5;
    reasons.push("shared-spec-token");
  }

  if (within(a.priceMedian, b.priceMedian, PRICE_TOL)) { score += 1; reasons.push("near-price"); }

  const strongEvidence =
    (sameExactRevenue && !family.conflictingStrongFamily) ||
    sharedCodes > 0 ||
    (a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl) ||
    exactParent ||
    familyStrongMatch(a, b) ||
    (family.bridged && !family.conflictingStrongFamily && ((family.specShared > 0 && (revNear || salesNear || ts >= TITLE_SIM_MIN)) || ts >= TITLE_SIM_STRONG));

  if (!strongEvidence) return null;
  return { score, reasons };
}

function mergeResidualNonAnchors(prepared: PreparedRow[], dsu: DSU) {
  let changedAny = false;
  let pass = 0;

  while (pass < MAX_RESIDUAL_MERGE_PASSES) {
    const groups = buildGroups(prepared, dsu);
    const profiles = [...buildProfiles(prepared, groups).values()].filter((p) => !isAnchorGroup(p));
    let changed = false;

    for (const a of profiles) {
      const candidates: { root: number; score: number; reasons: string[] }[] = [];
      for (const b of profiles) {
        if (a.root === b.root) continue;
        const scored = scoreResidualPair(a, b);
        if (!scored) continue;
        candidates.push({ root: b.root, score: scored.score, reasons: scored.reasons });
      }
      candidates.sort((x, y) => y.score - x.score);
      const best = candidates[0];
      const second = candidates[1];
      if (!best) continue;
      if (best.score < RESIDUAL_MERGE_SCORE) continue;
      if (second && best.score - second.score < AMBIGUITY_GAP) continue;
      if (dsu.find(a.root) !== dsu.find(best.root)) {
        dlog("residual-merge", a.root, "->", best.root, best.score, best.reasons);
        dsu.union(a.root, best.root);
        changed = true;
      }
    }

    if (!changed) break;
    changedAny = true;
    pass += 1;
  }

  return changedAny;
}


function canProfilesShareResolvedParent(a: GroupProfile, b: GroupProfile) {
  if (!sameBrandCompatible(a, b)) return false;

  const family = titleFamilyScore(a, b);
  if (family.conflictingStrongFamily && !exactRevenueMatch(a, b)) return false;

  if (a.exactParentDupKey && b.exactParentDupKey) {
    return a.exactParentDupKey === b.exactParentDupKey;
  }

  if (a.exactRevenueDupKey && b.exactRevenueDupKey && a.exactRevenueDupKey !== b.exactRevenueDupKey) {
    return false;
  }

  if (
    a.exactReviewDupKey &&
    b.exactReviewDupKey &&
    a.exactReviewDupKey !== b.exactReviewDupKey &&
    !exactRevenueMatch(a, b)
  ) {
    return false;
  }

  if (exactRevenueMatch(a, b) && !family.conflictingStrongFamily) return true;
  if (hardAnchorLink(a, b)) return true;
  if (familyStrongMatch(a, b)) return true;

  return false;
}

function canReuseParentIdWithinBatch(
  parentProductId: string,
  profile: GroupProfile,
  assignedProfilesByParent: Map<string, GroupProfile[]>,
) {
  const owners = assignedProfilesByParent.get(parentProductId) ?? [];
  if (owners.length === 0) return true;
  return owners.every((owner) => canProfilesShareResolvedParent(owner, profile));
}


export async function processBatch(batchId: string) {
  if (!batchId) throw new Error("batchId fehlt.");

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { files: true, category2: { include: { mainCategory: true } } },
  });
  if (!batch) throw new Error("Batch nicht gefunden.");
  if (!batch.month || !/^\d{4}-\d{2}$/.test(batch.month)) {
    throw new Error(`Batch.month ist ungültig ("${batch.month}"). Bitte neu hochladen mit Month im Format YYYY-MM (z.B. 2026-02).`);
  }

  const file = batch.files[0];
  const csvText = file?.contentText ?? "";
  if (!csvText) throw new Error("Keine CSV im Batch.");

  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  const required = ["ASIN", "Kategorie", "Unterkategorie", "Preis", "Umsatz auf übergeordneter Ebene", "Verkäufe auf übergeordneter Ebene"];
  const header = Object.keys(records[0] ?? {});
  for (const r of required) {
    if (!header.includes(r)) throw new Error(`Pflichtspalte fehlt: ${r}`);
  }

  const allNodes = await prisma.categoryNode.findMany({
    where: { category2Id: batch.category2Id },
    select: { id: true, name: true, path: true, isLeaf: true },
  });
  const typedAllNodes = allNodes as CategoryNodeLite[];
  const leafNodes = typedAllNodes.filter((n) => n.isLeaf);
  const anyByName = new Map<string, CategoryNodeLite>(typedAllNodes.map((n) => [norm(n.name), n]));
  const leafByName = new Map<string, CategoryNodeLite>(leafNodes.map((n) => [norm(n.name), n]));

  await prisma.productClassification.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });
  await prisma.productRow.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });
  await prisma.childToParentMap.deleteMany({ where: { month: batch.month, category2Id: batch.category2Id } });

  const byAsin = new Map<string, Record<string, string>>();
  let duplicates = 0;
  for (const r of records) {
    const asin = (r["ASIN"] ?? "").toString().trim();
    if (!asin) continue;
    if (byAsin.has(asin)) {
      duplicates += 1;
      continue;
    }
    byAsin.set(asin, r);
  }
  const rows = Array.from(byAsin.values());

  const prepared: PreparedRow[] = rows.map((r) => {
    const asin = (r["ASIN"] ?? "").toString().trim();
    const title = cleanNA(r["Titel"]);
    const brand = cleanNA(r["Marke"]);
    const brandNorm = brand ? norm(brand) : null;

    const imageUrl = normalizeImageUrl(cleanNA(r["Bild-URL"]));
    const leafString = cleanNA(r["Unterkategorie"]);
    const price = parseNumberDE(r["Preis"]);
    const parentRevenue = parseNumberDE(r["Umsatz auf übergeordneter Ebene"]);
    const parentSales = parseIntDE(r["Verkäufe auf übergeordneter Ebene"]);

    const asinRevenue = parseNumberDE(r["ASIN-Umsatz"]);
    const asinSales = parseIntDE(r["ASIN-Verkäufe"]);
    const reviewsCount = parseIntDE(r["Bewertungsanzahl"]);
    const rating = parseNumberDE(r["Bewertungen Bewertung"]);

    const ean = normalizeCode(r["EAN"]);
    const gtin = normalizeCode(r["GTIN"]);
    const upc = normalizeCode(r["UPC"]);
    const isbn = normalizeCode(r["ISBN"]);
    const bsr = parseIntDE(r["BSR"]);
    const subcatBsr = parseIntDE(r["Unterkategorie BSR"]);
    const url = cleanNA(r["URL"]);

    return {
      asin, title, brand, brandNorm, imageUrl, leafString,
      price, parentRevenue, parentSales,
      asinRevenue, asinSales,
      reviewsCount, rating,
      ean, gtin, upc, isbn,
      url,
      bsr,
      subcatBsr,
    };
  });

  await prisma.productRow.createMany({
    data: prepared.map((p) => ({
      batchId: batch.id,
      category2Id: batch.category2Id,
      month: batch.month!,
      asin: p.asin,
      title: p.title,
      brand: p.brand,
      brandNorm: p.brandNorm,
      imageUrl: p.imageUrl,
      leafString: p.leafString,
      price: p.price,
      parentRevenue: p.parentRevenue,
      parentSales: p.parentSales,
      asinRevenue: p.asinRevenue,
      asinSales: p.asinSales,
      reviewsCount: p.reviewsCount,
      rating: p.rating,
      ean: p.ean,
      gtin: p.gtin,
      upc: p.upc,
      isbn: p.isbn,
      bsr: p.bsr,
      subcatBsr: p.subcatBsr,
    })),
    skipDuplicates: false,
  });

  const dsu = new DSU(prepared.length);
  const codeMap = new Map<string, number>();
  const imgMap = new Map<string, number>();
  const revSalesMap = new Map<string, number>();

  function addKey(map: Map<string, number>, key: string, idx: number) {
    const prev = map.get(key);
    if (prev === undefined) map.set(key, idx);
    else dsu.union(prev, idx);
  }

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];

    for (const code of [p.ean, p.gtin, p.upc, p.isbn]) {
      if (code) addKey(codeMap, `code:${code}`, i);
    }

    if (p.imageUrl) addKey(imgMap, `img:${p.imageUrl}`, i);

    if (p.parentRevenue != null && p.parentSales != null) {
      const k = `prs:${p.parentRevenue.toFixed(2)}|${p.parentSales}`;
      addKey(revSalesMap, k, i);
    }
  }

  let deterministicPass = 0;
  while (deterministicPass < 3) {
    const changed = deterministicStrongMerge(prepared, dsu);
    if (!changed) break;
    deterministicPass += 1;
  }

  let anchorPass = 0;
  while (anchorPass < 3) {
    const changedHard = mergeAnchorsHardOnly(prepared, dsu);
    const changedAttach = attachNonAnchorsToAnchors(prepared, dsu);
    if (!changedHard && !changedAttach) break;
    anchorPass += 1;
  }

  mergeResidualNonAnchors(prepared, dsu);


const groups = buildGroups(prepared, dsu);
const groupProfiles = buildProfiles(prepared, groups);

let createdParents = 0;
let mappedParents = 0;
let unmappedParents = 0;

const existingParents = await prisma.parentProduct.findMany({
  where: { category2Id: batch.category2Id },
  select: { id: true, brandNorm: true, titleNorm: true },
});
const parentByTitleKey = new Map<string, string[]>();
for (const p of existingParents) {
  const fp = titleFingerprint(p.titleNorm);
  if (!fp) continue;
  const key = `${p.brandNorm ?? "__no_brand__"}|${fp}`;
  const arr = parentByTitleKey.get(key) ?? [];
  arr.push(p.id);
  parentByTitleKey.set(key, arr);
}

type ClassAcc = { leafRev: Map<string, number>; leafCnt: Map<string, number>; groups: number };
const classAccByParent = new Map<string, ClassAcc>();
const assignedProfilesByParent = new Map<string, GroupProfile[]>();
let parentIdCollisions = 0;

for (const [root, idxs] of groups.entries()) {
  const profile = groupProfiles.get(root);
  if (!profile) continue;

  const rep = prepared[profile.repIdx];
  const childAsins = idxs.map((j) => prepared[j].asin);

  const existing = await prisma.childToParentMap.findFirst({
    where: { category2Id: batch.category2Id, childAsin: { in: childAsins } },
    orderBy: { createdAt: "desc" },
    select: { parentProductId: true },
  });

  const titleNorm = rep.title ? norm(rep.title) : null;
  const titleFp = titleFingerprint(titleNorm);
  const titleKey = `${rep.brandNorm ?? "__no_brand__"}|${titleFp}`;
  const knownByTitle = titleFp ? parentByTitleKey.get(titleKey) ?? [] : [];

  let parentProductId: string | null = null;

  if (
    existing?.parentProductId &&
    canReuseParentIdWithinBatch(existing.parentProductId, profile, assignedProfilesByParent)
  ) {
    parentProductId = existing.parentProductId;
  }

  if (!parentProductId) {
    const titleReuseAllowed =
      !isAnchorGroup(profile) &&
      knownByTitle.length === 1 &&
      canReuseParentIdWithinBatch(knownByTitle[0], profile, assignedProfilesByParent);

    if (titleReuseAllowed) {
      parentProductId = knownByTitle[0];
    } else {
      const parent = await prisma.parentProduct.create({
        data: {
          category2Id: batch.category2Id,
          representativeAsin: rep.asin,
          representativeUrl: rep.url,
          brandNorm: rep.brandNorm,
          titleNorm,
        },
        select: { id: true },
      });
      parentProductId = parent.id;
      createdParents += 1;
      if (titleFp) {
        const arr = parentByTitleKey.get(titleKey) ?? [];
        arr.push(parent.id);
        parentByTitleKey.set(titleKey, arr);
      }
    }
  }

  await prisma.childToParentMap.createMany({
    data: childAsins.map((child) => ({
      month: batch.month!,
      category2Id: batch.category2Id,
      childAsin: child,
      parentProductId: parentProductId!,
      representativeAsin: rep.asin,
      method: "union-find-v9-title-family-tight",
    })),
    skipDuplicates: true,
  });

  const owners = assignedProfilesByParent.get(parentProductId!) ?? [];
  if (owners.length > 0) {
    parentIdCollisions += 1;
  }
  owners.push(profile);
  assignedProfilesByParent.set(parentProductId!, owners);

  let acc = classAccByParent.get(parentProductId!);
  if (!acc) {
    acc = { leafRev: new Map(), leafCnt: new Map(), groups: 0 };
    classAccByParent.set(parentProductId!, acc);
  }
  acc.groups += 1;

  for (const j of idxs) {
    const ls = prepared[j].leafString;
    if (!ls) continue;
    acc.leafCnt.set(ls, (acc.leafCnt.get(ls) ?? 0) + 1);
    const rev = typeof prepared[j].asinRevenue === "number" ? prepared[j].asinRevenue : 0;
    acc.leafRev.set(ls, (acc.leafRev.get(ls) ?? 0) + rev);
  }
}

const order3IdByPath = new Map<string, string>();
  for (const n of typedAllNodes) {
    const parts = n.path.split(".");
    if (parts.length === 2) order3IdByPath.set(n.path, n.id);
  }

  const classificationRows: {
    month: string;
    category2Id: string;
    parentProductId: string;
    leafString: string | null;
    leafNodeId: string | null;
    order3NodeId: string | null;
    isUnmapped: boolean;
  }[] = [];

  for (const [parentProductId, acc] of classAccByParent.entries()) {
    let leafString: string | null = null;
    if (acc.leafRev.size) {
      leafString = [...acc.leafRev.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    } else if (acc.leafCnt.size) {
      leafString = [...acc.leafCnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }

    let leafNodeId: string | null = null;
    let order3NodeId: string | null = null;
    let isUnmapped = true;

    if (leafString) {
      const key = norm(leafString);
      const matchedNode = leafByName.get(key) ?? anyByName.get(key);
      if (matchedNode) {
        isUnmapped = false;
        leafNodeId = matchedNode.isLeaf ? matchedNode.id : null;
        const parts = matchedNode.path.split(".");
        const order3Path = parts.length >= 2 ? parts.slice(0, 2).join(".") : matchedNode.path;
        order3NodeId = order3IdByPath.get(order3Path) ?? matchedNode.id;
      }
    }

    classificationRows.push({
      month: batch.month!,
      category2Id: batch.category2Id,
      parentProductId,
      leafString,
      leafNodeId,
      order3NodeId,
      isUnmapped,
    });
  }

  await prisma.productClassification.createMany({ data: classificationRows, skipDuplicates: true });
  mappedParents = classificationRows.filter((r) => !r.isUnmapped).length;
  unmappedParents = classificationRows.filter((r) => r.isUnmapped).length;

  console.log("✅ Verarbeitung fertig");
  console.log("Month:", batch.month);
  console.log("Rows (unique ASIN):", prepared.length, "| duplicate ASINs skipped:", duplicates);
  console.log("Parent groups:", groups.size, "| new ParentProduct created:", createdParents);
  console.log("Mapped parents:", mappedParents, "| Unmapped parents:", unmappedParents);
  console.log("Distinct parents (after merge):", classAccByParent.size);
  console.log("Parent collisions merged:", parentIdCollisions);
}
