// Local preview helper only (not part of the entry): builds data.js from the
// sealed kit snapshot so the dashboard can be opened and screenshotted.
// The entry's main.ts does the same build inside the grader.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildRadar, dataScript, parseSnapshot } from '../lib/model.ts';
const snapshot = parseSnapshot(readFileSync(process.argv[2], 'utf8'));
const { board, radar } = buildRadar(snapshot);
writeFileSync(new URL('../data.js', import.meta.url), dataScript(radar));
console.log(`preview data: ${board.length} rows, top ${board[0].name} ${board[0].implied_value_usd}, watchlist ${snapshot.watchlist.length}`);
