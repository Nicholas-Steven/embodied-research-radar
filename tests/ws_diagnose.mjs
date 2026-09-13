// Diagnostic harness: execute the experiments view with DOM stubs to find
// the real root cause of the blank page (reproducible, not guesswork).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const noop = () => {};
const mkEl = () => {
  const el = {
    style: {}, dataset: {}, textContent: '', innerHTML: '', value: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, click: noop,
  };
  return el;
};

let bodyEl = null;
globalThis.window = { addEventListener: noop, WorkspaceView: null };
globalThis.localStorage = {
  _s: {},
  getItem(k) { return this._s[k] ?? null; },
  setItem(k, v) { this._s[k] = String(v); },
};
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: mkEl,
  addEventListener: noop,
  getElementById: () => null,
  body: { appendChild: noop, style: {} },
};
// Minimal fetch stub returning empty data (tests empty/legacy data path too)
globalThis.fetch = async () => ({ json: async () => ({ papers: [] }) });
globalThis.CustomEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
globalThis.URL = URL;
// history stub: capture pushState calls
globalThis.history = { pushState: noop };
globalThis.location = { search: '', pathname: '/', href: 'http://127.0.0.1:8010/' };

// Load modules
const tmp = mkdtempSync(join(tmpdir(), 'wsdiag-'));
const dataSrc = readFileSync(join(here, '../web/assets/v2/v2-data.js'), 'utf8');
const i18nSrc = readFileSync(join(here, '../web/assets/v2/i18n.js'), 'utf8');
let wsSrc = readFileSync(join(here, '../web/assets/v2/workspace.js'), 'utf8');
wsSrc = wsSrc.replace("from './v2-data.js'", "from './v2-data.mjs'")
  .replace("from './i18n.js'", "from './i18n.mjs'");
writeFileSync(join(tmp, 'v2-data.mjs'), dataSrc);
writeFileSync(join(tmp, 'i18n.mjs'), i18nSrc);
writeFileSync(join(tmp, 'workspace.mjs'), wsSrc);

const mod = await import(pathToFileURL(join(tmp, 'workspace.mjs')).href);
const V2Logic = globalThis.window.V2Logic || {};
const registry = mod && mod.__views ? mod.__views : null;

// section stub for #workspace-section (render() uses getElementById)
const sectionEl = mkEl();
let renderedHTML = '';
sectionEl.querySelector = (sel) => {
  if (sel === '#ws-body') {
    const b = mkEl();
    // body.querySelector(...) inside views must return a stub element (like a real DOM)
    b.querySelector = () => mkEl();
    b.querySelectorAll = () => [];
    Object.defineProperty(b, 'innerHTML', {
      set(v) { renderedHTML = v; },
      get() { return renderedHTML; },
    });
    return b;
  }
  return mkEl();
};
globalThis.document.getElementById = (id) => (id === 'workspace-section' ? sectionEl : null);
globalThis.document.querySelector = () => null;

const VIEW_KEYS = ['dashboard', 'thesis', 'collision', 'red-team', 'failure-lab',
  'experiments', 'decisions', 'gaps', 'methods', 'fusion', 'expansion'];

async function renderView(ws) {
  globalThis.location = { search: `?view=workspace&ws=${ws}`, pathname: '/', href: `http://127.0.0.1:8010/?view=workspace&ws=${ws}` };
  renderedHTML = '';
  await globalThis.window.WorkspaceView.render();
  return renderedHTML;
}

const report = {};
for (const ws of VIEW_KEYS) {
  try {
    const html = await renderView(ws);
    report[ws] = { ok: true, length: html.length, blank: html.trim().length === 0 };
  } catch (err) {
    report[ws] = { ok: false, error: String(err && err.stack || err).split('\n').slice(0, 4).join(' | ') };
  }
}
console.log(JSON.stringify(report, null, 2));

// Focused checks on experiments view
const expHtml = report.experiments.ok ? await renderView('experiments') : '';
console.log('EXPERIMENTS CHECKS:', JSON.stringify({
  '标题 实验设计器': expHtml.includes('实验设计器'),
  '研究主张': expHtml.includes('研究主张'),
  'E1..E5': ['E1', 'E2', 'E3', 'E4', 'E5'].every((k) => expHtml.includes(k)),
  '导出 Markdown': expHtml.includes('导出 Markdown'),
  '仅视觉': expHtml.includes('仅视觉'),
  '危险假成功率': expHtml.includes('危险假成功率'),
}));

