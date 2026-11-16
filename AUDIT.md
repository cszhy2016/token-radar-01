# Audit — token-radar-01 scaffold (read-only, 2026-11-16)

Kit: `~/workspace/makefun/kit/token-radar-01-kit/` (RULES.txt 87,258 B).
Scaffold: `~/workspace/makefun/token-radar-01/`, model radar-3. No push, no submit.

## 0. Baseline numbers (snapshot, exact)

- Snapshot: 758 protocols, `as_of` 2026-11-14, floor $50,000,000, watchlist 40.
- Two different "pre-token" counts — do not conflate:
  - `mcap_usd` null: 614. `mcap_usd` not null: 144.
  - `gecko_id` AND `symbol` null (RULES watchlist definition, model `isPreToken`): 342.
  - 272 protocols record a token but have `mcap_usd` null (dead/unpriced); 0 with mcap
    not null lack gecko/symbol.
- Board: 198 rows. Dossier: 294,513 B (NOT 705,786 — that was pre-quantization).

## 1. Watchlist coverage — PASS, 1.0

- All 40 watchlist slugs present in `out/board.json`; missing: none.
  armitage-by-wintermute, axis, b14g, bittensor-dtao, clearstar, curvance, doppler-finance, ember, firelight, galaxy-curation, gami-labs, gauntlet, hive-protocol, hyperithm, infinifi, k3-capital, keyrock, lagoon, lightning-network, lofty, mezo-earn, noble, nonce-capital, onre, opentrade, plume-vaults, r25, reti-pooling, rockawayx, saturn, steakhouse-financial, symbiotic, tori-finance, tulipa-capital, tydro, upshift, usdd, valos, veda, yuzu-money.
- 40 watchlist + 158 non-watchlist = 198. The 158 are NOT a TVL-ranked subset:
  `buildBoard` takes every protocol passing `isLaunchCandidate` (house rule,
  checkable part: pre-token, category not in {Bridge, Canonical Bridge, Liquid
  Staking, Liquid Restaking, Restaked BTC, CEX}, name not version-marked /
  wrapped/staked/staking, not exchange-prefixed). Recomputed independently:
  exactly 198 candidates, board == candidate set, diff empty both ways.
  Non-watchlist TVL $5,007,171–$2,757,585,593. (Starter instead took 40 + 160
  below-floor = 200 rows; ours takes all eligible.)
- Caveat: `parentProtocol` is not a snapshot field, so that part of the house rule cannot be checked in code (same as starter).

## 2. Comparables mapping — category is right; "93 token families" is vacuous here

- Verified in `lib/model.ts`: comparables = live protocols with `mcap_usd` and
  TVL > 0 and ratio > 0; power-law OLS on log10(TVL)→log10(mcap) + category
  median mcap/TVL (n ≥ 3 else overall median). No token-family merging anywhere.
- The 144 mcap-carrying protocols have 144 distinct `gecko_id` and 144 distinct `symbol`; the 128 comparables used (144 − 15 dead − 1 negative ratio) are 128 distinct gecko_ids, one protocol each.
  Grouping by token identity therefore changes nothing — there is nothing to
  merge. The "93 families" in gentle-badger-68's title is not reproducible from
  `gecko_id`/`symbol` in this snapshot; it must be that entrant's own filter.
- Category pooling is the only grouping with n ≥ 3 per bucket: Lending 15, Dexs 11, Liquid Staking 9, Yield 9, CEX 9, RWA 9, Canonical Bridge 8, Basis Trading 7, Bridge 6, rest ≤ 4. Verdict: keep category + power-law blend; do not chase a family merge. (CEX/Bridge/Liquid-Staking live protocols are in the comparables pool though excluded from the board — a sensitivity check excluding them is cheap if time allows.)

## 3. Dossier generation — 294,513 B; the user's suggested savings mostly do NOT apply

- `vendor/makefun-board.ts` `buildDossier` writes canonical JSON (sorted keys,
  no whitespace) = {schema, cover: 0, text, images[]}. `main.ts` passes
  `text_max_bytes: 65536`, screenshots max 4 × 512 KiB, dashboard max 400 files /
  4 MiB. Dossier cap 1.5 MiB; ours is 19.6% of it.
- Breakdown (exact): text 13,814 B (4.7%) + images base64 279,784 B (95.0%) +
  ~915 B JSON/sha256 overhead = 294,513 B.
  - Images: 1-board.png 73,855 B → base64 98,476; 2-detail.png 74,817 → 99,756; 3-filtered.png 61,162 → 81,552. (base64 = ×4/3.)
  - Text: dashboard source only — app.css 2,561 + app.js 7,290 + index.html
    3,743 = 13,594 B, all three shown whole, no cut line. Text cap 65,536 is
    78% unused.
- Corrections to the proposed "lossless slimming":
  - JSON pretty-printing: dossier is already canonical/compact. No saving.
  - Float truncation: `board.json` (325,685 B, multiples at 17 decimals, `null`
    for pre-token mcap) and `data.js` (303,337 B) are NOT in the dossier — the
    dossier text is dashboard source only. Truncating them saves 0 dossier
    bytes. (They still matter for the gate's board.json ≤ 8 MiB check — plenty
    of headroom — and for the judge only via the screenshots.)
  - Redundant/null fields: same — not in the dossier. No saving.
  - Text minification: app.js/css/html minified might save ~2–4 KB of the
    13.8 KB text (~1% of dossier). Negligible; risks hurting the judge's
    source read.
  - Screenshots: already 256-colour PNG. Tested JPEG q80/q70 on copies in
    /tmp: 114–155 KB each — WORSE than PNG (flat dark UI). PNG re-save identical.
    Remaining lever is only fewer colours / smaller area, both legibility risks.
    Verdict: dossier is effectively at its floor; 294,513 B already beats the
    live tie-group leader sudhan (472,918 B). Do not spend more time shrinking;
    spend it on win rate.
- Judge visibility: the judge reads dossier screenshots first, then dashboard source. It never sees `board.json`/`data.js` directly — numbers reach it only through screenshots. Screenshot legibility is the highest-leverage dossier property, not bytes.

## 4. Scoring rubric (RULES.txt, verbatim order)

Judge criteria (most important first): 1) working radar — full watchlist cover,
ranked pre-token by stated implied value, screenshots and code agree; 2) value
model — implied value from snapshot figures (TVL, 7d growth, age with no
token), not hardcoded names; separates live-token from pre-token; 3) farm plans
— concrete steps with cost and time; 4) dashboard — sortable/filterable,
readable, detail view per protocol; 5) looks made — palette, spacing, type.
Pairwise, no ties, margin 1–5; two calls per game (both slot orders).

7 gate checks (all must pass, else Valid 0, no rate, no reward):
dashboard_files, board_file (100–4,000 rows, ≤ 8 MiB), sorted_by_value
(ranks 1..N, implied value non-rising), coverage (watchlist 1.0), farm_steps
(3–12 strings, 20–600 chars), screenshots (3–4, ≤ 512 KiB, long ≤ 1440,
short ≥ 800), dossier_matches (byte-identical rebuild, ≤ 1.5 MiB).

Process: dev heats vs 4 fixed house dashboards + 3 reference rungs (12 games,
+8 if rate reaches money line); provisional rate = Bradley-Terry expected win
rate vs fixed dashboards, 90% interval, never shown tied. Final: screen at
place 40 (max(4×10 paid, 32)), 3 Swiss rounds, racing at prize boundaries
(48–96 games), top-12 playoff (every pair once + 3 extra top-two games).
Score = final win rate. Tie order: playoff head-to-head → smaller dossier.json
→ earlier receipt. Payout: 1st $1,000, 2nd–5th $50, 6th–10th $25. House bot in
a paid place holds it; prize not awarded, no move-up. Deadline 2026-12-14
10:00 UTC; result ~2026-12-28.

Transcript gate (Muse-specific): 9 pass/fail checks; required from
2026-11-17 00:00 UTC, run record (`transcripts_run_record`) required from then.
Sessions must start after competition open 2026-11-14T10:00Z and lie inside the
window (±60 s skew); ≥30% of counted lines reproduced, entrypoint ≥1 authored
line; ≥5 assistant turns with text/thinking; ≥2 writes to some file; usage
priced — Muse app sessions carry no usage in the file, so attach ≥1 usage row
via `bundle --muse-usage <file>` (min_muse_app_usage_rows 1); self-reported
sessions need usage on ≥50% of assistant messages, ≤500 tok/s. `handed_over_places:
none` — a handed-over session ranks but takes NO paid place. Never fabricate /
edit / borrow transcripts; upload top-level + all subagent sessions whole via
`bundle`; `thinking_fresh` needs the kit anchor line before first counted write.
Instruction files/system prompt only need a run-record statement (collected /
none / withheld + reason). Quota (live API): 5/day, 10 total, hard limit 20,
0 made, can_submit true.

## 5. Minor findings

- `main.ts` header comment still says "model radar-2" — stale, cosmetic only.
- Kit `makefun check` was not run in this audit (needs transcripts bundle;
  parent-only before submit). Local 7-gate self-check (`boardIssue`) passes.
- `out/` is a build artifact regenerated by `main.ts`; `data.js` at repo root
  duplicates `out/data.js` — harmless.