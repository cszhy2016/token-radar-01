// Token launch radar, model radar-3 (Node 22, standard library only).
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) plus every other pre-token protocol the house watchlist rule keeps
// as a plausible launch candidate: the early rows the radar exists to find.
// Wrapped / staked / bridged products and exchanges are left out by that
// rule, not by name: the same function scores every row.
//
// Implied value is computed from the snapshot's own figures only - no protocol
// name is ever special-cased. The base multiple blends two comparables
// estimates, both fitted on the snapshot's live-token protocols:
//
//   power law    log10(mcap) = a + b*log10(TVL), OLS on live protocols
//   cat median   median mcap/TVL of live protocols in the same category
//                (n >= 3; else the overall median), clamped to [0.02, 2.0]
//   base         10^(0.75*log10(power-law pred) + 0.25*log10(cat-median pred))
//                (effective multiple clamped to [0.02, 2.0])
//   implied      = max(1, round(TVL x base x growthMult x maturityMult x chainMult))
//
// Backtest (leave-one-out, 128 live-token protocols with positive mcap and
// TVL; 144 carry an mcap field, 15 are zero/negative dead tokens, 1 more has
// a negative ratio): median |log10 error| / RMS log10 / within 2x / within 10x:
//   radar-2 category median  0.743 / 1.059 / 21.1% / 68.0%
//   starter flat 0.25xTVL    0.691 / 0.990 / 30.5% / 75.0%
//   power law alone          0.531 / 0.915 / 32.0% / 78.1%
//   radar-3 blend (75/25)    0.566 / 0.925 / 27.3% / 80.5%
// The blend keeps the category signal the pure power law drops (its marginal
// gain over the blend is small: median 0.531 vs 0.566) and has the best
// within-10x rate; full sweep in PLAN.md. Live-token protocols are never
// ranked: they are shown apart in the dashboard's Live view at their market
// values (mcap), for comparison.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export const MODEL_VERSION = 'radar-3';
export const POWER_LAW_WEIGHT = 0.75;
export const GROWTH_FLOOR = -60;
export const GROWTH_CAP = 120;
export const GROWTH_WEIGHT = 0.5;
export const MATURITY_FLOOR = 0.6;
export const MATURITY_RANGE = 0.4;
export const MATURITY_DAYS = 1095;
export const UNKNOWN_AGE_DAYS = 365;
export const MULTIPLE_FLOOR = 0.02;
export const MULTIPLE_CAP = 2.0;
export const MULTIPLE_MIN_N = 3;

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple: number;
    multiple_n: number;
    multiple_source: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  multiple_source: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  fdv_tvl: number | null;
}

export interface CategoryMultiple {
  category: string;
  multiple: number;
  n: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  rows: RadarRow[];
  live: LiveRow[];
  multiples: CategoryMultiple[];
  overall_multiple: number;
  power_law: { intercept: number; slope: number; n: number; weight: number } | null;
  watchlist_count: number;
  watchlist: string[];
  pre_token_count: number;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (!listedAt) return null;
  const ms = Date.parse(asOf) - Date.parse(listedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

const EXCLUDED_CATEGORIES = new Set([
  'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX',
]);
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * The house watchlist rule (RULES.txt, "The snapshot"), applied to every
 * pre-token protocol, not just those above the floor: a plausible token
 * launch is not a wrapped / staked / bridged product of a token that already
 * trades. Excluded: the six categories above, a name ending in a version
 * marker (V2, v2, 2.0 …), a name carrying a whole word wrapped / staked /
 * staking, or a name beginning with an exchange's name. (DefiLlama's
 * parentProtocol is not one of the snapshot's ten fields, so it cannot be
 * checked here; the category/name rules are the checkable part.)
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (/\s(v\d+|\d+\.\d+)\s*$/i.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function clampMultiple(x: number): number {
  return Math.min(MULTIPLE_CAP, Math.max(MULTIPLE_FLOOR, x));
}

/** Category comparables: median live FDV/TVL per category, from this snapshot. */
export interface PowerLawFit { intercept: number; slope: number; n: number }
export interface Multiples {
  byCategory: Map<string, CategoryMultiple>;
  overall: number;
  powerLaw: PowerLawFit | null;
}

/** Category comparables: median live mcap/TVL per category, from this snapshot. */
export function categoryMultiples(snapshot: Snapshot): Multiples {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  const logPts: Array<[number, number]> = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || !p.mcap_usd || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(r) || r <= 0) continue;
    all.push(r);
    logPts.push([Math.log10(p.tvl_usd), Math.log10(p.mcap_usd)]);
    const key = p.category ?? 'Unknown';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(r);
  }
  const overall = clampMultiple(median(all));
  const byCategory = new Map<string, CategoryMultiple>();
  for (const [cat, vals] of byCat) {
    if (vals.length >= MULTIPLE_MIN_N) {
      byCategory.set(cat, { category: cat, multiple: clampMultiple(median(vals)), n: vals.length });
    }
  }
  // Power-law fit log10(mcap) = a + b*log10(TVL), OLS on the same live set.
  let powerLaw: PowerLawFit | null = null;
  if (logPts.length >= 10) {
    const mx = logPts.reduce((n, q) => n + q[0], 0) / logPts.length;
    const my = logPts.reduce((n, q) => n + q[1], 0) / logPts.length;
    const den = logPts.reduce((n, q) => n + (q[0] - mx) ** 2, 0);
    if (den > 0) {
      const b = logPts.reduce((n, q) => n + (q[0] - mx) * (q[1] - my), 0) / den;
      const a = my - b * mx;
      if (Number.isFinite(a) && Number.isFinite(b)) powerLaw = { intercept: a, slope: b, n: logPts.length };
    }
  }
  return { byCategory, overall, powerLaw };
}

export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  multiples: Multiples,
): { implied: number; multiple: number; multiple_n: number; multiple_source: string; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const cat = multiples.byCategory.get(p.category ?? 'Unknown');
  const catMultiple = cat ? cat.multiple : multiples.overall;
  const multiple_n = cat ? cat.n : 0;
  const medianPred = p.tvl_usd * catMultiple;
  // Blend in log space: 75% power-law fit, 25% category-median comparables.
  // Falls back to the median alone when no fit exists.
  let multiple = catMultiple;
  let multiple_source = cat ? `category median (${p.category ?? 'Unknown'}, n=${cat.n})` : 'overall median';
  if (multiples.powerLaw) {
    const plPred = 10 ** (multiples.powerLaw.intercept + multiples.powerLaw.slope * Math.log10(p.tvl_usd));
    if (Number.isFinite(plPred) && plPred > 0 && medianPred > 0) {
      const blended = 10 ** (POWER_LAW_WEIGHT * Math.log10(plPred) + (1 - POWER_LAW_WEIGHT) * Math.log10(medianPred));
      multiple = clampMultiple(blended / p.tvl_usd);
      multiple_source = cat
        ? `power-law 75% + category median 25% (${p.category ?? 'Unknown'}, n=${cat.n})`
        : 'power-law 75% + overall median 25%';
    }
  }
  const growthPct = Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * GROWTH_WEIGHT;
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const maturityMult = MATURITY_FLOOR + (Math.min(ageForModel, MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
  const chainMult = 1 + Math.min(Math.max(p.chains.length - 1, 0), 5) * 0.02;
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthMult * maturityMult * chainMult));
  return { implied, multiple, multiple_n, multiple_source, growthPct, growthMult, maturityMult, chainMult, age };
}

const CATEGORY_ACTIONS: Record<string, string> = {
  Lending: 'Supply collateral and borrow against it in one loop, keeping health factor above 1.5',
  Dexs: 'Provide liquidity to the deepest pool and hold the LP position through at least one fee cycle',
  Yield: 'Deposit into the highest-TVL vault and auto-compound rewards weekly',
  'Liquid Staking': 'Stake the native asset and use the liquid token in a lending market',
  RWA: 'Hold a tokenised real-world position and keep it through the next reporting cycle',
  Bridge: 'Bridge a small amount each week on the primary route and keep the receipts',
  Derivatives: 'Open a small hedged perpetual position and close it after the funding cycle',
  Restaking: 'Restake the liquid token and delegate to two independent operators',
  'Yield Aggregator': 'Deposit into the flagship auto-compounding vault and leave it for a full epoch',
  CDP: 'Mint the stablecoin against collateral at under 50% loan-to-value and repay before expiry',
};

function chainOf(p: SnapshotProtocol): string {
  return p.chains[0] ?? 'its home chain';
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

/** Five concrete farm steps, each with cost and time, tailored to category + chain. */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const action = CATEGORY_ACTIONS[p.category ?? ''] ?? 'Use the protocol weekly on its main product and keep a record of every transaction';
  const tvl = fmtUsd(p.tvl_usd);
  const holdDays = age !== null && age > 365 ? 90 : 30;
  return [
    `Fund a fresh wallet on ${chain} with about $200 in the chain gas token plus $50 in a stablecoin for fees, and record the wallet address; cost about $5 in bridge fees, takes 20 minutes.`,
    `${action} with the $200 position (TVL is ${tvl}, so a $200 position is small enough to exit cleanly); cost about $3 in gas and 0.5% in pool fees, takes 1 hour.`,
    `Repeat the core interaction once a week for ${holdDays} days, varying the amount slightly each time so the activity reads as real usage, not a script; cost about $2 per week in gas, takes 15 minutes a week.`,
    `Track the protocol's points or eligibility page weekly and screenshot your position each time; if a points program opens, complete every listed task within 7 days; cost nothing but time, takes 10 minutes a week.`,
    `Plan the exit before any token launches: unstake or withdraw in two tranches over 48 hours, keep 10% of the position for 30 more days in case of a second snapshot, and never pay more than $10 in gas per exit; cost about $8 in gas, takes 1 hour.`,
  ];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      fdv_tvl: p.tvl_usd > 0 ? p.mcap_usd! / p.tvl_usd : null,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    multiple: row.model.multiple,
    multiple_source: row.model.multiple_source,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const multiples = categoryMultiples(snapshot);
  const rows = snapshot.protocols
    .filter(isLaunchCandidate)
    .map((p) => {
      const v = impliedValue(p, snapshot.as_of, multiples);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        mcap_usd: p.mcap_usd,
        listed_at: p.listed_at,
        gecko_id: p.gecko_id,
        symbol: p.symbol,
        token_status: 'pre-token' as const,
        age_days: v.age,
        implied_value_usd: v.implied,
        model: {
          multiple: v.multiple,
          multiple_n: v.multiple_n,
          multiple_source: v.multiple_source,
          growth_pct: v.growthPct,
          growth_multiplier: v.growthMult,
          maturity_multiplier: v.maturityMult,
          chain_multiplier: v.chainMult,
          age_days: v.age,
        },
        farm_steps: farmSteps(p, v.age),
      };
    })
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const multiples = categoryMultiples(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    rows: board.map(radarRow),
    live: liveRows(snapshot),
    multiples: [...multiples.byCategory.values()].sort((a, b) => b.n - a.n),
    overall_multiple: multiples.overall,
    power_law: multiples.powerLaw
      ? { intercept: multiples.powerLaw.intercept, slope: multiples.powerLaw.slope, n: multiples.powerLaw.n, weight: POWER_LAW_WEIGHT }
      : null,
    watchlist_count: snapshot.watchlist.length,
    watchlist: [...snapshot.watchlist],
    pre_token_count: board.length,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new Error('snapshot is not a token-radar snapshot: protocols/watchlist missing');
  }
  return data;
}

/** Gate-shaped self-check, mirroring RULES.txt: null means the board passes. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, need 100-4000`;
  const seen = new Set<string>();
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  for (const [i, r] of board.entries()) {
    if (!slugs.has(r.slug)) return `row ${i + 1} names unknown slug ${r.slug}`;
    if (seen.has(r.slug)) return `duplicate slug ${r.slug}`;
    seen.add(r.slug);
    if (r.rank !== i + 1) return `row ${i + 1} has rank ${r.rank}, need ${i + 1}`;
    if (i > 0 && board[i - 1]!.implied_value_usd < r.implied_value_usd) return 'implied value rises with rank';
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `row ${r.slug} has bad implied value`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `row ${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${r.slug} has a farm step of ${t.length} chars`;
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} missing from board`;
  }
  if (board.length >= 2 && board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) {
    return 'all implied values are equal: not a ranking';
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
