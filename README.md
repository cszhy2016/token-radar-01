# Token Launch Radar — radar-3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/cszhy2016/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/cszhy2016/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Build the best token launch radar. Read a sealed snapshot of every protocol DefiLlama tracks, work out which ones still record no token and are not a wrapped or staked product of one that trades, and rank them by what their launch would be worth; then hand in a web dashboard that shows the board, a detail view for each protocol and the steps to farm it. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## The model (radar-3)

Implied value = TVL × blended multiple × growth × maturity × chain reach. Every input comes from the sealed snapshot (2026-11-14, 758 protocols, 40 on the watchlist). No protocol name is special-cased. Blended multiple = 10^(0.75·log10(power-law prediction) + 0.25·log10(category-median prediction)), where the power law log10(mcap) = 3.025 + 0.522·log10(TVL) is fitted by OLS on the snapshot's 128 live-token protocols and the category median is the median mcap/TVL of live protocols in the same category (n ≥ 3, else the overall median); effective multiple clamped to 0.02–2.00. Leave-one-out backtest on those 128 protocols: median |log10 error| 0.566, vs 0.743 for the category median alone and 0.691 for a flat 0.25×TVL (see PLAN.md for the full sweep).

- **Blended multiple:** 75% power-law fit + 25% category median (see above); top of the board is Steakhouse Financial at $125.1M implied.
- **Growth:** 7-day TVL change clamped to −60%…+120%, weight 0.5.
- **Maturity:** 0.60 + min(age, 1095 days) / 1095 × 0.40; unknown age counts as 365 days.
- **Chain reach:** 1 + 0.02 per extra chain, capped at 1.10.
- **Board:** 198 rows — the whole 40-protocol watchlist plus every other pre-token protocol the house watchlist rule keeps as a plausible launch (wrapped / staked / bridged products and exchanges are left out by that rule, not by name). Live-token protocols are shown apart at their market values, never ranked. Dossier: 294,513 bytes (screenshots quantized to 256 colours; see PLAN.md).

An implied value is this entry's own claim about what a token would be worth if the protocol's record stayed as it is. It does not predict whether or when a token is issued.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22+, standard library only, no network. Reads the snapshot, writes `board.json` (198 rows, each with an implied value and a 5-step farm plan), `data.js`, copies `dashboard/` and `screenshots/` to the output, and writes `dossier.json` with the vendored make.fun library.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board, a detail view for every protocol (model breakdown + farm plan with cost and time), a live-token comparison view, and the model explained with its category multiples table.

## Screenshots

`screenshots/` holds the three required views, taken at 1440×900 with headless Chromium: `1-board.png` (the board), `2-detail.png` (a protocol's detail view), `3-filtered.png` (a filtered view).

---

<sub>Entered on [make.fun](https://make.fun/?ref=sage-quasar-59&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
