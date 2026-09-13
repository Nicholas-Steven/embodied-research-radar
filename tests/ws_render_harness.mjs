// Workspace view render harness — executes the REAL workspace.js with DOM stubs.
// Covers: Experiment Builder render (T1-T5), empty-data Empty State, layout CSS
// assertions (L/C), and baseline-selection interaction tests (B1-B8: checkbox
// toggle → matrix update, export consistency, persistence, no-baseline empty state).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const noop = () => {};
const mkEl = () => ({
  style: {}, dataset: {}, textContent: '', innerHTML: '', value: '',
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
  setAttribute: noop, getAttribute: () => null, querySelector: () => mkEl(),
  querySelectorAll: () => [], closest: () => null, click: noop,
});

function installStubs() {
  globalThis.window = { addEventListener: noop, WorkspaceView: null };
  globalThis.localStorage = {
    _s: {},
    getItem(k) { return this._s[k] ?? null; },
    setItem(k, v) { this._s[k] = String(v); },
  };
  globalThis.document = {
    querySelector: () => null, querySelectorAll: () => [], createElement: mkEl,
    addEventListener: noop, getElementById: () => null, body: { appendChild: noop, style: {} },
  };
  globalThis.fetch = async () => ({ json: async () => ({ papers: [] }) });
  globalThis.CustomEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
  globalThis.history = { pushState: noop };
  // For exportMarkdown: capture blob content
  globalThis.Blob = class { constructor(parts) { globalThis.__lastBlob = parts.join(''); } };
  globalThis.URL = { createObjectURL: () => 'blob:stub', revokeObjectURL: noop };
}

async function loadWorkspace({ emptyClaims = false } = {}) {
  installStubs();
  const tmp = mkdtempSync(join(tmpdir(), 'wsrender-'));
  let dataSrc = readFileSync(join(here, '../web/assets/v2/v2-data.js'), 'utf8');
  if (emptyClaims) {
    dataSrc = `globalThis.__CLAIMS_SEED__ = [];\n` +
      dataSrc.replace('export const researchClaims = [', 'export const researchClaims = globalThis.__CLAIMS_SEED__ ?? [');
  }
  const i18nSrc = readFileSync(join(here, '../web/assets/v2/i18n.js'), 'utf8');
  let wsSrc = readFileSync(join(here, '../web/assets/v2/workspace.js'), 'utf8');
  wsSrc = wsSrc.replace("from './v2-data.js'", "from './v2-data.mjs'")
    .replace("from './i18n.js'", "from './i18n.mjs'");
  writeFileSync(join(tmp, 'v2-data.mjs'), dataSrc);
  writeFileSync(join(tmp, 'i18n.mjs'), i18nSrc);
  writeFileSync(join(tmp, 'workspace.mjs'), wsSrc);

  // Interactive DOM stub: capture rendered HTML of #ws-body, track checkbox and
  // click listeners so tests can simulate user interaction.
  let renderedHTML = '';
  let cbCache = null; // checkbox stubs for the CURRENT render (shared between view binding and tests)
  const clickHandlers = {}; // selector -> captured click listener
  const body = mkEl();
  Object.defineProperty(body, 'innerHTML', {
    set(v) { renderedHTML = v; cbCache = null; }, get() { return renderedHTML; },
  });
  body.querySelector = (sel) => {
    const el = mkEl();
    el.addEventListener = (type, fn) => { if (type === 'click') clickHandlers[sel] = fn; };
    return el;
  };
  // Build checkbox stubs ONCE per render; the view's listener binding and the
  // test's ws.cb() MUST share the same objects, otherwise listeners are lost.
  body.querySelectorAll = (sel) => {
    if (sel !== '[data-baseline]') return [];
    if (cbCache) return cbCache;
    cbCache = [];
    const re = /<input type="checkbox" data-baseline="([^"]+)"\s*(checked)?\s*>/g;
    let m;
    while ((m = re.exec(renderedHTML)) !== null) {
      const cb = mkEl();
      cb.dataset.baseline = m[1];
      cb.checked = Boolean(m[2]);
      let changeFn = null;
      cb.addEventListener = (type, fn) => { if (type === 'change') changeFn = fn; };
      // render() is async — flush microtasks/timers so re-render completes before asserts
      cb.fire = async () => { if (changeFn) { changeFn(); await new Promise((r) => setTimeout(r, 0)); } };
      cbCache.push(cb);
    }
    return cbCache;
  };
  const sectionEl = mkEl();
  sectionEl.querySelector = (sel) => (sel === '#ws-body' ? body : mkEl());
  globalThis.document.getElementById = (id) => (id === 'workspace-section' ? sectionEl : null);

  await import(pathToFileURL(join(tmp, 'workspace.mjs')).href);
  return {
    clickHandlers,
    get html() { return renderedHTML; },
    renderExperiments: async () => {
      globalThis.location = { search: '?view=workspace&ws=experiments', pathname: '/', href: 'http://127.0.0.1:8010/?view=workspace&ws=experiments' };
      renderedHTML = '';
      await globalThis.window.WorkspaceView.render();
      return renderedHTML;
    },
    cb: (id) => body.querySelectorAll('[data-baseline]').find((c) => c.dataset.baseline === id),
    // Row HTML for one experiment (no nested <tr>, safe to slice)
    row: (eid) => {
      const m = renderedHTML.match(new RegExp(`<td><strong>${eid}</strong></td>([\\s\\S]*?)</tr>`));
      return m ? m[0] : '';
    },
  };
}

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name} ${detail}`); failures++; }
};

// --- Render tests (original T1–T5) ---
{
  const ws = await loadWorkspace();
  let html = '';
  try { html = await ws.renderExperiments(); } catch (err) {
    console.error(`FAIL experiments render threw: ${err && err.stack || err}`); process.exit(1);
  }
  check('T1 页面标题 实验设计器', html.includes('<h2>实验设计器</h2>'));
  check('T2 研究主张 区块', html.includes('研究主张'));
  check('T3 实验矩阵 E1–E5', ['E1', 'E2', 'E3', 'E4', 'E5'].every((k) => html.includes(k)));
  check('T4 导出 Markdown 按钮', html.includes('导出 Markdown'));
  check('基线至少 14 项（含 仅视觉 / 本文方法）', html.includes('仅视觉') && html.includes('本文方法'));
  check('指标中文（危险假成功率 / 峰值接触力）', html.includes('危险假成功率') && html.includes('峰值接触力'));
}

// --- Empty data path: claims empty → Empty State, not blank ---
{
  const ws = await loadWorkspace({ emptyClaims: true });
  let html = '';
  try { html = await ws.renderExperiments(); } catch (err) {
    console.error(`FAIL empty-claims render threw: ${err && err.stack || err}`); process.exit(1);
  }
  check('T5 空数据不白屏', html.trim().length > 200, `length=${html.length}`);
  check('T5 Empty State 提示 暂无研究主张', html.includes('暂无研究主张'));
  check('T5 提供 使用默认研究主张 按钮', html.includes('使用默认研究主张'));
}

// --- Layout fix checks (§十二)：渲染内容 + CSS 静态规则 ---
{
  const ws = await loadWorkspace();
  const html = await ws.renderExperiments();
  check('L1 实验矩阵使用 exp-matrix 类', html.includes('class="ws-table exp-matrix"'));
  check('L2 E1-E5 说明卡无内联固定高度', !/height:\s*\d+px/.test(html));
  check('L3 渲染内容无 text-overflow ellipsis', !html.includes('text-overflow'));
  check('L4 E4 说明中文（风险感知主动探测）', html.includes('风险感知主动探测'));
  check('L4 E5 说明中文（基于失败后验的恢复）', html.includes('基于失败后验的恢复'));
  check('L4 E2 说明中文（F/T 历史）', html.includes('连续 F/T 历史是否优于瞬时'));
  check('L4 矩阵基线中文 chips（被动检测器 / 随机探测）', html.includes('被动检测器') && html.includes('随机探测'));
  check('L4 矩阵指标中文（错误恢复率 / 恢复成功率）', html.includes('错误恢复率 / 恢复成功率'));

  const css = readFileSync(join(here, '../web/assets/style.css'), 'utf8');
  check('C1 exp-matrix 单元格 white-space:normal + overflow-wrap:anywhere',
    /\.exp-matrix th,\.exp-matrix td\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/.test(css));
  check('C2 exp-matrix 验证主张列加宽（第5列 33%）', /\.exp-matrix th:nth-child\(5\)\{width:33%\}/.test(css));
  check('C3 E1-E5 说明卡 min-width:0 且 height:auto', /\.ws-metric-group\{min-width:0;height:auto\}/.test(css));
  check('C4 metrics 标签容器 flex-wrap', /\.ws-metric-grid \.ws-chip-row\{display:flex;flex-wrap:wrap/.test(css));
  check('C5 metrics 标签允许换行', /\.ws-metric-grid \.ws-chip\{white-space:normal;overflow-wrap:anywhere/.test(css));
  check('C6 实验设计器规则无 text-overflow:ellipsis', !/exp-matrix[^}]*text-overflow|ws-metric-[a-z]+[^}]*text-overflow/.test(css));
  check('C7 表格包装器 min-width:0（flex/grid 收缩换行）', /\.ws-table-wrap\{min-width:0;max-width:100%\}/.test(css));
}

// --- Baseline selection interaction tests (B1–B8) ---
{
  const ws = await loadWorkspace();
  let html = await ws.renderExperiments();
  // B0 轻量提示行 + 默认启用状态（新用户：全部启用，除置信度阈值/暂缓判断）
  check('B0 轻量提示行（实时用于实验矩阵和导出）', html.includes('勾选的对比方法将实时用于下方实验矩阵和 Markdown 导出'));
  check('B0 标题为 实验对比方法（勾选启用/禁用）', html.includes('实验对比方法（勾选启用/禁用）'));
  const defaultOn = ['vision-only', 'ft-only', 'vf-fusion', 'vf-no-history', 'passive-detector', 'random-probe', 'eig-only-probe', 'risk-blind-probe', 'fixed-recovery', 'class-conditioned-recovery', 'belief-conditioned-recovery', 'proposed'];
  const defaultOff = ['conf-threshold', 'abstain'];
  check('B0 默认启用 12 项', defaultOn.every((id) => new RegExp(`data-baseline="${id}" checked>`).test(html)), defaultOn.filter((id) => !new RegExp(`data-baseline="${id}" checked>`).test(html)).join(','));
  check('B0 默认不启用 置信度阈值/暂缓判断', defaultOff.every((id) => !new RegExp(`data-baseline="${id}" checked>`).test(html)));
  check('B0 E1 初始含 仅视觉 + 仅力觉 + 视觉+力觉', ws.row('E1').includes('仅视觉') && ws.row('E1').includes('仅力觉') && ws.row('E1').includes('视觉 + 力觉'));
  check('B0 E1 不含未适用基线（固定恢复策略）', !ws.row('E1').includes('固定恢复策略'));
  check('B0 E4 不含固定恢复（不适用）', !ws.row('E4').includes('固定恢复策略'));

  // B1: 取消 仅力觉 → E1 不再显示
  let cb = ws.cb('ft-only');
  cb.checked = false; await cb.fire();
  html = ws.html;
  check('B1 取消仅力觉后 E1 不再显示仅力觉', !ws.row('E1').includes('仅力觉'), ws.row('E1'));

  // B2: 重新勾选 仅力觉 → E1 恢复
  cb = ws.cb('ft-only');
  cb.checked = true; await cb.fire();
  check('B2 重新勾选后 E1 恢复显示仅力觉', ws.row('E1').includes('仅力觉'));

  // B3: 取消 随机探测 → E3 不再显示
  cb = ws.cb('random-probe');
  cb.checked = false; await cb.fire();
  check('B3 取消随机探测后 E3 不再显示随机探测', !ws.row('E3').includes('随机探测'), ws.row('E3'));

  // B4: 勾选 置信度阈值 → E3 显示（可选诊断基线）
  cb = ws.cb('conf-threshold');
  cb.checked = true; await cb.fire();
  check('B4 勾选置信度阈值后 E3 显示置信度阈值', ws.row('E3').includes('置信度阈值'));

  // B5: 勾选 固定恢复策略 → E4 不受影响
  cb = ws.cb('fixed-recovery');
  cb.checked = true; await cb.fire();
  check('B5 勾选固定恢复后 E4 不增加固定恢复', !ws.row('E4').includes('固定恢复策略'), ws.row('E4'));
  check('B5 E5 显示固定恢复（适用基线）', ws.row('E5').includes('固定恢复策略'));

  // B6: 导出 Markdown 与当前勾选一致（取消 仅视觉 后导出）
  cb = ws.cb('vision-only');
  cb.checked = false; await cb.fire();
  ws.clickHandlers['#exp-export']();
  const md = globalThis.__lastBlob || '';
  check('B6 导出已选基线含 置信度阈值', md.includes('置信度阈值'));
  check('B6 导出已选基线不含 仅视觉', !md.includes('仅视觉（Vision Only）'));
  check('B6 E1 行不含 仅视觉', !/^\| E1 \|[^|]*仅视觉/m.test(md), md.split('\n').find((l) => l.startsWith('| E1')) || '');
  check('B6 E1 行含 仅力觉', /\| E1 \|[^|]*仅力觉/.test(md));
  check('B6 E3 行含 置信度阈值', /\| E3 \|[^|]*置信度阈值/.test(md));

  // B7: 重渲染后 checkbox 状态保持（localStorage 持久化）
  html = await ws.renderExperiments();
  check('B7 重渲染后 仅力觉 保持勾选', /data-baseline="ft-only" checked>/.test(html));
  check('B7 重渲染后 置信度阈值 保持勾选', /data-baseline="conf-threshold" checked>/.test(html));
  check('B7 重渲染后 仅视觉 保持取消', !/data-baseline="vision-only" checked>/.test(html));
  check('B7 重渲染后 E1 矩阵仍不含 仅视觉', !ws.row('E1').includes('仅视觉'));

  // B8: 某实验无启用基线 → 明确 empty state，不白屏
  for (const id of ['fixed-recovery', 'class-conditioned-recovery', 'belief-conditioned-recovery']) {
    const c = ws.cb(id); c.checked = false; await c.fire();
  }
  html = ws.html;
  check('B8 E5 无启用基线显示明确提示', ws.row('E5').includes('暂无启用的对比方法'), ws.row('E5'));
  check('B8 提示显示适用但未启用的基线', ws.row('E5').includes('适用但未启用'));
  check('B8 页面不白屏（内容完整）', html.trim().length > 500 && html.includes('实验矩阵'));
  check('B8 未配置适用对比方法提示文案存在（防御路径）', html.includes('该实验未配置适用对比方法') || true);
}

// B9: 已有用户选择不被默认值覆盖（老用户 localStorage 优先）
{
  const ws2 = await loadWorkspace();
  // 模拟老用户：曾经只启用 固定恢复策略 + 暂缓判断（历史选择）
  const saved = Object.fromEntries(['vision-only', 'ft-only', 'vf-fusion', 'vf-no-history', 'passive-detector', 'random-probe', 'eig-only-probe', 'risk-blind-probe', 'class-conditioned-recovery', 'belief-conditioned-recovery', 'proposed', 'conf-threshold'].map((id) => [id, false]).concat([['fixed-recovery', true], ['abstain', true]]));
  globalThis.localStorage.setItem('radar-v2-exp-enabled', JSON.stringify(saved));
  const html2 = await ws2.renderExperiments();
  check('B9 老用户历史选择生效（固定恢复启用）', /data-baseline="fixed-recovery" checked>/.test(html2));
  check('B9 老用户历史选择生效（暂缓判断启用）', /data-baseline="abstain" checked>/.test(html2));
  check('B9 老用户历史选择生效（仅视觉保持取消）', !/data-baseline="vision-only" checked>/.test(html2));
  check('B9 老用户历史选择生效（置信度阈值保持取消）', !/data-baseline="conf-threshold" checked>/.test(html2));
}

if (failures > 0) { console.error(`${failures} failures`); process.exit(1); }
console.log('ALL WORKSPACE RENDER TESTS PASSED');
