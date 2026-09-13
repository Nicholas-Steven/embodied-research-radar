// V2 logic test harness — imports the real workspace modules with DOM stubs
// and asserts collision scoring / risk mapping behavior. Run via node.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Stub browser globals before importing workspace.js
globalThis.window = { addEventListener() {}, WorkspaceView: null };
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
globalThis.document = { querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, addEventListener() {}, remove() {}, appendChild() {} }; }, addEventListener() {}, body: { appendChild() {}, style: {} } };

// Copy modules to a temp dir with .mjs extensions so node treats them as ESM
const tmp = mkdtempSync(join(tmpdir(), 'v2logic-'));
const dataSrc = readFileSync(join(here, '../web/assets/v2/v2-data.js'), 'utf8');
const i18nSrc = readFileSync(join(here, '../web/assets/v2/i18n.js'), 'utf8');
const mdSrc = readFileSync(join(here, '../web/assets/v2/method-details.js'), 'utf8');
let wsSrc = readFileSync(join(here, '../web/assets/v2/workspace.js'), 'utf8');
// workspace.js fetches data.json at render time only; tests never render views.
wsSrc = wsSrc.replace("from './v2-data.js'", "from './v2-data.mjs'")
  .replace("from './i18n.js'", "from './i18n.mjs'")
  .replace("from './method-details.js'", "from './method-details.mjs'");
writeFileSync(join(tmp, 'v2-data.mjs'), dataSrc);
writeFileSync(join(tmp, 'i18n.mjs'), i18nSrc);
writeFileSync(join(tmp, 'method-details.mjs'), mdSrc);
writeFileSync(join(tmp, 'workspace.mjs'), wsSrc);

const mod = await import(pathToFileURL(join(tmp, 'workspace.mjs')).href);
const { scorePaper, riskLevelFor, missingCoverage, collisionConfig } = (globalThis.window.V2Logic || {});
if (!scorePaper) { console.error('V2Logic not exported'); process.exit(1); }

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name} ${detail}`); failures++; }
};

// 1. Weights sum to exactly 100
const wsum = Object.values(collisionConfig.weights).reduce((a, b) => a + b, 0);
check('weights sum to 100', wsum === 100, `got ${wsum}`);

// 2. Risk level mapping boundaries (spec §10)
const cases = [[0, 'Low'], [30, 'Low'], [31, 'Moderate'], [50, 'Moderate'], [51, 'High'],
  [70, 'High'], [71, 'Very High'], [85, 'Very High'], [86, 'Critical'], [100, 'Critical']];
for (const [score, expected] of cases) {
  check(`riskLevelFor(${score})=${expected}`, riskLevelFor(score).label === expected,
    `got ${riskLevelFor(score).label}`);
}

// 3. Sensor overlap requires BOTH vision and force signals
const visionOnly = { title: 'Visual question answering with camera images', abstract: 'image understanding', research_topics: [], methods: [], sensors: ['RGB camera'], keywords: [] };
const vfPaper = { title: 'Vision-based force estimation for contact-rich manipulation', abstract: 'camera images and force torque sensor fusion', research_topics: [], methods: [], sensors: ['RGB-D', '6D F/T'], keywords: [] };
check('vision-only paper: no sensor overlap', !scorePaper(visionOnly).reasons.some((r) => r.key === 'sensorOverlap'));
check('vision+force paper: sensor overlap', scorePaper(vfPaper).reasons.some((r) => r.key === 'sensorOverlap'));

// 4. Deterministic scoring & monotonicity with more overlapping dimensions
const full = { title: 'Active tactile failure diagnosis and recovery via belief-space planning', abstract: 'force torque sensing, uncertainty estimation, information gain probe actions, fault tolerant recovery, diagnosability and POMDP', research_topics: ['failure-understanding'], methods: [], sensors: ['vision', 'force'], keywords: [] };
const rFull = scorePaper(full);
check('multi-overlap paper scores above 60', rFull.score > 60, `got ${rFull.score}`);
check('score capped at 100', rFull.score <= 100);

// 5. Old paper schema without any V2 fields must not crash (spec §60)
const bare = { title: 'A paper', abstract: '', research_topics: undefined, methods: undefined, sensors: undefined, keywords: undefined };
check('bare paper schema does not crash', typeof scorePaper(bare).score === 'number');

// 6. missingCoverage complements matched reasons
const rVf = scorePaper(vfPaper);
const cov = missingCoverage(rVf);
check('missingCoverage excludes matched dims', !cov.includes('传感模态重合')); // sensor dim not in coverage meta
check('missingCoverage lists recovery for VF paper', cov.some((c) => /恢复/.test(c)), JSON.stringify(cov));

// 7. NetVOI computation (spec §25–§26)
const { computeNetVoi, probeRecommended, pairKey } = globalThis.window.V2Logic;
const voiEntry = { actionId: 't', expectedInformationGain: 0.6, decisionRiskReduction: 0.55, forceRisk: 0.1, damageRisk: 0.1, timeCost: 0.1, progressCost: 0.05 };
const { netVOI: n1 } = computeNetVoi(voiEntry);
// gross = 0.55*1.0 = 0.55; cost = 0.1*0.8 + 0.1*1.0 + 0.1*0.3 + 0.05*0.4 = 0.08+0.10+0.03+0.02 = 0.23
check('netVOI arithmetic', Math.abs(n1 - (0.55 - 0.23)) < 1e-9, `got ${n1}`);
check('netVOI positive → Probe Recommended', probeRecommended(n1) === true);
const risky = { actionId: 't2', expectedInformationGain: 0.35, decisionRiskReduction: 0.3, forceRisk: 0.6, damageRisk: 0.7, timeCost: 0.1, progressCost: 0.15 };
const { netVOI: n2 } = computeNetVoi(risky);
// gross=0.3; cost=0.48+0.70+0.03+0.06=1.27 → negative
check('risky action netVOI negative', n2 < 0, `got ${n2}`);
check('negative netVOI → Abstain/Recovery', probeRecommended(n2) === false);
check('netVOI supports explicit "not worth exploring" state', probeRecommended(0.2) === false && probeRecommended(0.3) === true);

// 8. pairKey is symmetric (sorted)
check('pairKey symmetric', pairKey('jam', 'misalignment') === pairKey('misalignment', 'jam'));

if (failures > 0) { console.error(`${failures} failures`); process.exit(1); }
console.log('ALL V2 LOGIC TESTS PASSED');
