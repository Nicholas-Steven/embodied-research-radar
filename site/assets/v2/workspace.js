// V2 Research Workspace — P1: routing infrastructure + My Research Thesis
// Vanilla JS module, no framework. Data-driven: research content lives in v2-data.js.
import {
  researchProfile, researchNodes, researchEdges, nodeRoleMeta, nodeStatusMeta,
  collisionConfig, criticalCollisionTopics,
  researchConcepts, researchClaims, evidenceSufficiencyRedTeam, aiRedTeamPrompt,
  labHypotheses, labProbes, labTasks, labDiscriminability, probeDecisionOptions, netVoiConfig, labNetVoi,
  experimentMetrics, experimentBaselines, defaultExperiments, defaultDecisions,
  fusionArchitectures, recommendedArchitecture, methodRoles,
  expansionTree,
} from './v2-data.js';
import { methodDetails } from './method-details.js';
import { methodKnowledge } from './method-knowledge.js';
import {
  tabLabels, roleLabels, statusLabels, riskLabels, dimensionLabels,
  impactLabels, cardVerificationLabels, verificationLevelLabels,
  relationLabels, recommendationLabels, gapStatusLabels,
  hypothesisNameLabels, hypothesisTips, probeNameLabels, taskNameLabels,
  decisionOptionLabels, discriminabilityLabels, baselineLabels,
  metricLabels, metricGroupLabels, fusionLabels, methodRoleGroupLabels,
  expansionFieldLabels, ui,
} from './i18n.js';

const esc = (v='') => String(v).replace(/[&<>'"]/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateLabel = (v) => v ? String(v).slice(0,10).replaceAll('-','.') : '—';

// ---------------------------------------------------------------------------
// Paper data (same data.json the radar builds; fetched once, cached)
// ---------------------------------------------------------------------------
let papersData = null;
async function ensurePapers() {
  if (papersData) return papersData;
  try {
    const res = await fetch('assets/data.json');
    papersData = await res.json();
  } catch (e) {
    papersData = { papers: [] };
  }
  return papersData;
}

// ---------------------------------------------------------------------------
// localStorage persistence — configuration / user annotations ONLY (spec §48/§49)
// ---------------------------------------------------------------------------
const LS = 'radar-v2-';
function lsGet(key, fallback) {
  try { const raw = localStorage.getItem(LS + key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch (e) { /* quota / private mode */ }
}

// Node status / confidence overrides
const nodeOverrides = () => lsGet('nodes', {});
function nodeEffective(node) {
  const o = nodeOverrides()[node.id] || {};
  return {
    ...node,
    status: o.status || node.status || 'not-started',
    confidence: typeof o.confidence === 'number' ? o.confidence : (node.confidence ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Workspace view registry + router (URL: ?view=workspace&ws=<key>)
// ---------------------------------------------------------------------------
const views = {}; // key -> { title, render(body) }
function registerView(key, view) { views[key] = view; }

// Order shown in the workspace tab bar; modules marked soon:true render a notice until implemented.
const tabOrder = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'thesis', label: 'Research Thesis' },
  { key: 'collision', label: 'Collision Radar' },
  { key: 'red-team', label: 'Novelty Red Team' },
  { key: 'failure-lab', label: 'Failure Hypothesis Lab' },
  { key: 'experiments', label: 'Experiment Builder' },
  { key: 'decisions', label: 'Decision Log' },
  { key: 'gaps', label: 'Gap Confidence' },
  { key: 'methods', label: 'Method Role Map' },
  { key: 'fusion', label: 'Fusion Explorer' },
  { key: 'expansion', label: 'Expansion' },
];

function currentWs() {
  const ws = new URLSearchParams(location.search).get('ws') || 'dashboard';
  return views[ws] ? ws : 'dashboard';
}

function hideHomeSections() {
  ['#hero-section', '#quick-stats', '#spotlight-grid', '#explore-section',
   '#map-section', '#branch-section', '#landscape-section']
    .forEach((sel) => document.querySelector(sel)?.classList.add('hidden'));
}

async function render() {
  hideHomeSections();
  const sec = document.getElementById('workspace-section');
  if (!sec) return;
  sec.classList.remove('hidden');
  await ensurePapers();
  const ws = currentWs();
  const bc = document.getElementById('breadcrumb-current');
  if (bc) bc.textContent = '研究工作台 / ' + tabLabels[ws];
  document.querySelectorAll('[data-view="workspace"]').forEach((el) => {
    el.classList.toggle('active', el.dataset.ws === ws);
  });
  sec.innerHTML = `
    <nav class="ws-tabs" aria-label="研究工作台模块">
      ${tabOrder.map((t) => t.soon
        ? `<button class="ws-tab ws-tab-soon" type="button" disabled title="后续阶段提供">${esc(tabLabels[t.key] || t.label)}<small>后续提供</small></button>`
        : `<button class="ws-tab ${t.key === ws ? 'active' : ''}" type="button" data-ws-tab="${t.key}">${esc(tabLabels[t.key] || t.label)}</button>`).join('')}
    </nav>
    <div id="ws-body" class="ws-body"></div>`;
  bindTabs(sec);
  await views[ws].render(sec.querySelector('#ws-body'));
}

function bindTabs(sec) {
  sec.querySelectorAll('[data-ws-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ws = btn.dataset.wsTab;
      history.pushState({}, '', `${location.pathname}?view=workspace&ws=${ws}`);
      render();
      window.scrollTo({ top: 0 });
    });
  });
}

function showSoon(body, label) {
  body.innerHTML = `<div class="ws-notice"><h3>${esc(label)}</h3><p>该模块将在后续阶段提供（见 docs/V2_PROGRESS.md）。</p></div>`;
}

// ---------------------------------------------------------------------------
// Markdown export helper (spec §75)
// ---------------------------------------------------------------------------
function exportMarkdown(filename, markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ===========================================================================
// VIEW: My Research Thesis (spec §5–§7, §47)
// ===========================================================================
let modalPaperSearchCache = null;

function openNodeModal(node) {
  const role = nodeRoleMeta[node.role] || nodeRoleMeta.supporting;
  const roleLabelZh = roleLabels[node.role] || role.label;
  const status = nodeStatusMeta[node.status] || nodeStatusMeta['not-started'];
  const statusLabelZh = statusLabels[node.status] || status.label;
  const list = (items) => (items && items.length
    ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="ws-muted">${ui.noData}</p>`);
  const overlay = document.createElement('div');
  overlay.className = 'ws-modal-overlay';
  overlay.innerHTML = `
    <div class="ws-modal" role="dialog" aria-modal="true" aria-label="${esc(node.titleZh || node.title)}">
      <header class="ws-modal-head">
        <div>
          <span class="ws-role-badge" style="--role-color:${role.color}">${esc(roleLabelZh)}</span>
          <h3>${esc(node.titleZh || node.title)}</h3>
          <p class="ws-muted" title="${esc(node.title)}">${esc(node.title)}</p>
        </div>
        <button class="ws-modal-close" type="button" aria-label="${ui.close}">×</button>
      </header>
      <div class="ws-modal-body">
        <section><span class="section-kicker">科学问题 · SCIENTIFIC QUESTION</span><p>${esc(node.scientificQuestion || '—')}</p></section>
        <section><span class="section-kicker">输入 · INPUTS</span>${list(node.inputs)}</section>
        <section><span class="section-kicker">输出 · OUTPUTS</span>${list(node.outputs)}</section>
        <section><span class="section-kicker">候选方法 · CANDIDATE METHODS</span>${list(node.candidateMethods)}</section>
        ${node.note ? `<section class="ws-note"><span class="section-kicker">备注 · NOTE</span><p>${esc(node.note)}</p></section>` : ''}
        <section><span class="section-kicker">最相近论文 · CLOSEST PAPERS</span><p class="ws-muted">${ui.noPapers}（closestPaperIds — 阅读后在 v2-data.js 中维护，保证可追溯）</p></section>
        <section><span class="section-kicker">高风险撞题论文 · CRITICAL COLLISION PAPERS</span>${collisionPapersForNode(node)}</section>
        <section><span class="section-kicker">当前研究缺口 · CURRENT GAP</span>${node.gaps && node.gaps.length ? `<ul>${node.gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : `<p class="ws-muted">${ui.noData}</p>`}</section>
        <section><span class="section-kicker">必要实验 · REQUIRED EXPERIMENTS</span>${node.experiments && node.experiments.length ? `<ul>${node.experiments.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ws-muted">尚未分配（在实验设计器中生成）</p>'}</section>
        <section class="ws-edit-row">
          <label><span class="section-kicker">当前状态 · STATUS</span>
            <select id="ws-node-status">${Object.entries(nodeStatusMeta).map(([k, m]) => `<option value="${k}" ${k === node.status ? 'selected' : ''}>${esc(statusLabels[k] || m.label)}</option>`).join('')}</select>
          </label>
          <label><span class="section-kicker">当前判断可信度 · CONFIDENCE (0–100)</span>
            <span class="ws-conf-row"><input id="ws-node-confidence" type="range" min="0" max="100" step="5" value="${Number(node.confidence) || 0}"><output id="ws-node-confidence-out">${Number(node.confidence) || 0}</output></span>
          </label>
        </section>
        <p class="ws-disclaimer">该评分用于研究决策辅助，不代表正式的文献计量或创新性证明。</p>
      </div>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('ws-modal-close')) { overlay.remove(); render(); }
  });
  overlay.querySelector('#ws-node-status').addEventListener('change', (e) => {
    const o = nodeOverrides(); o[node.id] = { ...(o[node.id] || {}), status: e.target.value }; lsSet('nodes', o);
  });
  const confInput = overlay.querySelector('#ws-node-confidence');
  confInput.addEventListener('input', (e) => {
    overlay.querySelector('#ws-node-confidence-out').textContent = e.target.value;
  });
  confInput.addEventListener('change', (e) => {
    const o = nodeOverrides(); o[node.id] = { ...(o[node.id] || {}), confidence: Number(e.target.value) }; lsSet('nodes', o);
  });
  document.body.appendChild(overlay);
}

// ===========================================================================
// Method Detail Modal (方法角色图谱 → 方法详情悬浮窗口)
// Data-driven from method-details.js; all fields optional, missing → 淡显示。
// Close: × / overlay click / Esc. Body scroll locked during modal, restored on
// close; focus moves into modal on open and returns to the source card.
// Related methods switch content in place (no close/reopen).
// ===========================================================================
const METHOD_CATEGORY_LABELS = {
  'state-estimation': '状态 / 信念估计',
  'active-diagnosis': '主动诊断',
  'recovery-optimization': '恢复优化',
  'interaction-control': '交互控制',
  safety: '安全',
};
const methodDetailById = (id) => methodDetails.find((m) => m.id === id);
// 方法角色图谱卡片（methodRoles[].methods[].name，英文）→ methodDetails id
const methodIdByName = Object.fromEntries(methodDetails.map((m) => [m.name, m.id]));

// KaTeX 安全渲染：latex 来自项目数据（非用户输入），仍统一走 katex.render +
// throwOnError:false；单个公式失败降级为原始 LaTeX 文本，绝不影响 Modal 整体。
function renderMathIn(el) {
  if (!el) return;
  const blocks = el.querySelectorAll('script[type="math/tex"]');
  blocks.forEach((s) => {
    const tex = s.textContent || '';
    const holder = document.createElement('div');
    holder.className = 'ws-katex-block';
    try {
      if (globalThis.katex?.render) katex.render(tex, holder, { throwOnError: false, displayMode: true, strict: false });
      else throw new Error('katex unavailable');
    } catch {
      holder.classList.add('ws-katex-fallback');
      holder.textContent = tex;
    }
    s.replaceWith(holder);
  });
  const inline = el.querySelectorAll('script[type="math/tex-inline"]');
  inline.forEach((s) => {
    const tex = s.textContent || '';
    const span = document.createElement('span');
    try {
      if (globalThis.katex?.render) katex.render(tex, span, { throwOnError: false, displayMode: false, strict: false });
      else throw new Error('katex unavailable');
    } catch {
      span.classList.add('ws-katex-fallback');
      span.textContent = tex;
    }
    s.replaceWith(span);
  });
}
// Modal 数据 → HTML 的公式占位（deferred rendering；无需 eval，无注入面）
const texBlock = (tex) => `<script type="math/tex">${tex}</script>`;
const texInline = (tex) => `<script type="math/tex-inline">${tex}</script>`;

// 方法详情代表论文：三分类（经典基础 / 机器人应用 / 与当前课题最近），全部为检索核验文献
const PAPER_GROUP_META = [
  ['foundation', '经典基础 · WHERE IT CAME FROM', '回答：这个方法从哪里来？'],
  ['robotics', '机器人 / 接触操作应用 · ROBOTICS APPLICATIONS', '回答：机器人里怎么用？'],
  ['closest', '与当前课题最相关 · CLOSEST TO THIS THESIS', '回答：与视觉力觉主动失败诊断的直接关系？'],
];
const paperStatusLabels = { PUBLISHED: '已发表', ACCEPTED: '已录用', PREPRINT: '预印本', UNVERIFIED: '未核验' };
function paperGroupCard(paper) {
  const status = paperStatusLabels[paper.status] || paper.status || '未核验';
  const ver = verificationLevelLabels[paper.verification] || paper.verification || '未核验';
  const open = paper.paperId
    ? `?paper=${encodeURIComponent(paper.paperId)}`
    : (paper.url || '#');
  return `<article class="ws-ref-card">
    <h5><a href="${esc(open)}" ${paper.paperId ? 'data-ws-paper' : 'target="_blank" rel="noopener"'}>${esc(paper.title)}</a></h5>
    <p class="ws-ref-meta">${esc(paper.authors || '—')} · ${esc(String(paper.year || '—'))} · ${esc(paper.venue || '—')}</p>
    <p class="ws-ref-badges"><span class="ws-tag-soft">${esc(status)}</span><span class="ws-tag-soft">${esc(ver)}</span></p>
    ${paper.relevanceNote ? `<p class="ws-ref-note"><b>为什么推荐这篇：</b>${esc(paper.relevanceNote)}</p>` : ''}
  </article>`;
}
function methodPapersSection(detail) {
  const groups = detail.paperGroups;
  if (!groups) return methodPapersSectionLegacy(detail);
  const html = PAPER_GROUP_META.map(([key, label, hint]) => {
    const papers = groups[key] || [];
    const body = papers.length
      ? papers.map(paperGroupCard).join('')
      : `<p class="ws-muted">暂无已核验文献——不硬凑数量。</p>`;
    return `<div class="ws-paper-group"><h4>${esc(label)}</h4><p class="ws-muted">${esc(hint)}</p>${body}</div>`;
  }).join('');
  return `<section><span class="section-kicker">代表论文 · REPRESENTATIVE PAPERS</span>${html}</section>`;
}
// 旧字段 representativePapers（paper_id 列表）兼容渲染
function methodPapersSectionLegacy(detail) {
  const all = papersData?.papers || [];
  const rows = (detail.representativePapers || [])
    .map((pid) => all.find((p) => p.paper_id === pid))
    .filter(Boolean);
  if (!rows.length) {
    return `<section><span class="section-kicker">代表论文 · REPRESENTATIVE PAPERS</span>
      <p class="ws-muted">暂无已核验代表论文。方法出处与经典文献见参考条目${detail.canonicalRefs ? `（${esc(detail.canonicalRefs)}）` : ''}。</p></section>`;
  }
  return `<section><span class="section-kicker">代表论文 · REPRESENTATIVE PAPERS</span>
    <ul class="ws-claims-list">${rows.map((p) => `<li class="dash-item"><b><a href="${esc(p.paper_url || '#')}" target="_blank" rel="noopener">${esc(p.title)}</a></b>
      <small class="ws-muted">${esc(p.year || p.published_date?.slice(0, 4) || '—')} · ${esc(p.venue || '—')} · ${esc(verificationLevelLabels[p.verification_level] || p.verification_level || 'DISCOVERED')}</small></li>`).join('')}</ul></section>`;
}

// 醒目中文 section 标题（英文只做辅助小字）
const mSection = (zh, en) => `<span class="ws-msection"><b>${esc(zh)}</b><small>${esc(en)}</small></span>`;

function methodModalContent(detail) {
  const k = methodKnowledge[detail.id] || {};
  const bullets = (items, empty = ui.noData) => (items && items.length
    ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="ws-muted">${empty}</p>`);
  const cat = METHOD_CATEGORY_LABELS[detail.category] || detail.category || '—';
  const related = (detail.relatedMethods || []).map((rid) => {
    const r = methodDetailById(rid);
    return r ? `<button class="ws-chip ws-related-method" type="button" data-method="${esc(rid)}" title="${esc(r.chineseName || r.name)}">${esc(r.chineseName ? `${r.chineseName}` : r.name)}<small>${esc(r.name)}</small></button>` : '';
  }).filter(Boolean).join('');
  const mathBlocks = (k.mathBlocks || []).map((b, i) => `
    <div class="ws-math-block">
      <h5>${esc(b.title || `公式 ${i + 1}`)}</h5>
      ${texBlock(b.latex || '')}
      ${b.explanation?.length ? `<ul class="ws-math-exp">${b.explanation.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');
  return `
    <header class="ws-modal-head">
      <div>
        <span class="ws-role-badge" data-method-category>${esc(cat)}</span>
        <h3 id="method-modal-title">${esc(detail.chineseName || detail.name)}</h3>
        <p class="ws-muted">${esc(detail.name)}</p>
      </div>
      <button class="ws-modal-close" type="button" aria-label="${ui.close}">×</button>
    </header>
    <div class="ws-modal-quick-tags" role="list" aria-label="快速摘要">
      <span role="listitem"><small>研究角色</small><b>${esc(detail.researchRole || '—')}</b></span>
      <span role="listitem"><small>当前推荐</small><b>${esc(detail.recommendation || '—')}</b></span>
      <span role="listitem"><small>实现难度</small><b>${esc(detail.difficulty || '—')}</b></span>
      <span role="listitem"><small>是否核心创新</small><b>${detail.isCoreInnovation ? '是' : '否'}</b></span>
    </div>
    <div class="ws-modal-body">
      ${k.plainExplanation ? `<section>${mSection('30 秒理解', 'PLAIN-LANGUAGE SUMMARY')}<p>${esc(k.plainExplanation)}</p></section>` : ''}
      ${k.robotExample ? `<section class="ws-note">${mSection('一个直观例子', 'A CONCRETE ROBOT EXAMPLE')}<p>${esc(k.robotExample)}</p></section>` : ''}
      ${(k.inputs || k.outputs) ? `<section>${mSection('输入 / 输出', 'INPUTS & OUTPUTS')}
        ${k.inputs ? `<p><b>输入是什么：</b>${esc(k.inputs)}</p>` : ''}
        ${k.outputs ? `<p><b>输出是什么：</b>${esc(k.outputs)}</p>` : ''}</section>` : ''}
      ${detail.coreIdea ? `<section>${mSection('核心思想', 'CORE IDEA')}<p>${esc(detail.coreIdea)}</p></section>` : ''}
      ${mathBlocks ? `<section>${mSection('标准数学表达与逐项解释', 'MATH, TERM BY TERM')}<p class="ws-muted">公式为帮助理解的最核心表达；完整推导请见代表论文。</p>${mathBlocks}</section>` : (detail.mathematicalForm ? `<section>${mSection('基本数学形式', 'MATH FORM')}<pre class="ws-math">${esc(detail.mathematicalForm)}</pre></section>` : '')}
      ${k.robotWorkflow?.length ? `<section>${mSection('在机器人里怎么跑', 'HOW IT RUNS ON A ROBOT')}<ol>${k.robotWorkflow.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>` : ''}
      <section>${mSection('能解决 / 不能直接解决', 'SOLVES / DOES NOT SOLVE')}
        ${detail.solves?.length ? `<p class="section-kicker">能解决</p>${bullets(detail.solves)}` : ''}
        ${detail.cannotSolve?.length ? `<p class="section-kicker">不能直接解决</p>${bullets(detail.cannotSolve)}` : ''}
        ${!detail.solves?.length && !detail.cannotSolve?.length ? `<p class="ws-muted">${ui.noData}</p>` : ''}</section>
      <section>${mSection('优点与局限', 'STRENGTHS & LIMITATIONS')}
        ${detail.strengths?.length ? `<p class="section-kicker">优点</p>${bullets(detail.strengths)}` : ''}
        ${detail.limitations?.length ? `<p class="section-kicker">局限</p>${bullets(detail.limitations)}` : ''}
        ${!detail.strengths?.length && !detail.limitations?.length ? `<p class="ws-muted">${ui.noData}</p>` : ''}</section>
      ${k.comparisonNotes ? `<section>${mSection('与相近方法的区别', 'HOW IT DIFFERS FROM NEIGHBORS')}<p>${esc(k.comparisonNotes)}</p></section>` : ''}
      ${detail.suitableScenarios?.length ? `<section>${mSection('适合场景', 'SUITABLE')} ${bullets(detail.suitableScenarios)}</section>` : ''}
      ${detail.unsuitableScenarios?.length ? `<section>${mSection('不适合场景', 'UNSUITABLE')} ${bullets(detail.unsuitableScenarios)}</section>` : ''}
      ${k.layerPosition || detail.roleInCurrentResearch ? `<section class="ws-note">${mSection('当前视觉力觉课题中怎么用', 'ROLE IN THIS THESIS')}
        ${k.layerPosition ? `<p><b>接入哪一层：</b>${esc(k.layerPosition)}</p>` : ''}
        ${detail.roleInCurrentResearch ? `<p>${esc(detail.roleInCurrentResearch)}</p>` : ''}</section>` : ''}
      ${detail.recommendedUsage ? `<section>${mSection('推荐组合', 'RECOMMENDED COMBINATION')}<p>${esc(detail.recommendedUsage)}</p></section>` : ''}
      ${detail.difficulty ? `<section>${mSection('实现难度', 'DIFFICULTY')}<p>${esc(detail.difficulty)}${detail.implementationNotes ? ` — ${esc(detail.implementationNotes)}` : ''}</p></section>` : ''}
      ${detail.recommendation ? `<section>${mSection('是否适合作为核心创新', 'RECOMMENDATION')}
        <p><b>${esc(detail.recommendation)}</b>${detail.isCoreInnovation ? '' : '（不建议作为核心创新表述）'}</p>
        ${k.recommendationReason ? `<p>${esc(k.recommendationReason)}</p>` : ''}
        <p class="ws-disclaimer">推荐程度仅针对当前视觉力觉主动失败诊断研究主线，不是普适排名；评分为启发式研究决策辅助，不构成正式文献计量或统计证明。</p></section>` : ''}
      ${related ? `<section>${mSection('相关方法（点击切换详情）', 'RELATED METHODS')}<div class="ws-chip-row">${related}</div></section>` : ''}
      ${methodPapersSection(detail)}
    </div>`;
}

function openMethodModal(methodId, sourceEl) {
  const detail = methodDetailById(methodId);
  if (!detail) return;
  const overlay = document.createElement('div');
  overlay.className = 'ws-modal-overlay ws-method-modal-overlay';
  overlay.innerHTML = `<div class="ws-modal ws-method-modal" role="dialog" aria-modal="true" aria-labelledby="method-modal-title">${methodModalContent(detail)}</div>`;

  const closeModal = () => {
    document.removeEventListener('keydown', onKey);
    document.body.style.removeProperty('overflow');
    overlay.remove();
    if (sourceEl && document.contains(sourceEl)) sourceEl.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };

  // related method click → switch content in place (no close/reopen)
  const openWith = (box, html) => {
    box.innerHTML = html;
    renderMathIn(box); // KaTeX 渲染；单个公式失败仅降级为原文，不影响 Modal
    box.querySelector('.ws-modal-close')?.focus();
    box.scrollTop = 0;
  };
  overlay.addEventListener('click', (e) => {
    const rel = e.target.closest('.ws-related-method');
    if (rel) {
      const next = methodDetailById(rel.dataset.method);
      if (next) openWith(overlay.querySelector('.ws-method-modal'), methodModalContent(next));
      return;
    }
    if (e.target === overlay || e.target.classList.contains('ws-modal-close')) closeModal();
  });

  document.addEventListener('keydown', onKey);
  document.body.style.setProperty('overflow', 'hidden'); // lock background scroll
  document.body.appendChild(overlay);
  const modal = overlay.querySelector('.ws-method-modal');
  renderMathIn(modal); // 首次渲染同样走 KaTeX（失败降级）
  if (modal) modal.scrollTop = 0;
  overlay.querySelector('.ws-modal-close')?.focus();
}


const nodeCollisionMap = {
  'visual-temporal': ['sensorOverlap'], 'force-temporal': ['sensorOverlap'],
  'failure-belief': ['problemOverlap', 'stateOverlap'], 'diagnosability': ['theoryOverlap'],
  'safe-active-diagnosis': ['activeActionOverlap'], 'probe-abstain': ['theoryOverlap', 'activeActionOverlap'],
  'belief-update': ['stateOverlap'], 'risk-recovery': ['recoveryOverlap'],
  'impedance': [], 'safety-layer': [], 'contact-phase': ['stateOverlap'],
};
function collisionPapersForNode(node) {
  const dims = nodeCollisionMap[node.id] || [];
  const scored = (papersData?.papers || [])
    .map((p) => ({ p, r: scorePaper(p) }))
    .filter((x) => x.r.score >= 51 && x.r.reasons.some((r) => dims.includes(r.key)))
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 5);
  if (!scored.length) return '<p class="ws-muted">当前无 High 及以上撞题论文。</p>';
  return `<ul class="ws-paper-links">${scored.map((x) =>
    `<li><a href="?paper=${encodeURIComponent(x.p.paper_id)}" data-ws-paper>${esc(x.p.title)}</a> <span class="ws-score-mini">${x.r.score}</span></li>`).join('')}</ul>`;
}

registerView('thesis', {
  title: 'Research Thesis',
  async render(body) {
    const nodes = researchNodes.map(nodeEffective);
    const coreQs = nodes.filter((n) => n.role === 'core-question');
    const gateAfter = 'diagnosability';
    const nodeCard = (n) => {
      const role = nodeRoleMeta[n.role] || nodeRoleMeta.supporting;
      const st = nodeStatusMeta[n.status] || nodeStatusMeta['not-started'];
      return `<button class="thesis-node" type="button" data-ws-node="${esc(n.id)}" title="${esc(n.title)}" style="--role-color:${role.color}">
        <span class="thesis-node-role">${esc(roleLabels[n.role] || role.label)}</span>
        <strong>${esc(n.titleZh || n.title)}</strong>
        <span class="thesis-node-zh">${esc(n.title)}</span>
        <span class="thesis-node-foot"><span class="ws-status-chip" data-status="${esc(n.status)}">${esc(statusLabels[n.status] || st.label)}</span>
        <span class="ws-conf-bar" title="当前判断可信度 ${n.confidence}/100"><i style="width:${Number(n.confidence) || 0}%"></i></span><b>${Number(n.confidence) || 0}</b></span>
      </button>`;
    };
    const gateCard = `<div class="thesis-gate">
        <span class="section-kicker">主动诊断决策门 · DIAGNOSTIC DECISION GATE</span>
        <strong>证据充分性（操作性决策变量）· Evidence / Diagnosability Gate</strong>
        <p>${esc(researchProfile.evidenceGateNoteZh || researchProfile.evidenceGateNote)}</p>
        <p class="ws-muted">Role: ${esc(researchProfile.evidenceGateRole || '诊断决策变量')} · ${esc(researchProfile.evidenceGateNote || '')}</p>
      </div>`;
    let flow = '';
    nodes.forEach((n) => {
      flow += nodeCard(n);
      if (n.id === gateAfter) flow += gateCard;
    });
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 我的研究主线 · MY RESEARCH THESIS</div>
        <h2>当前研究主线</h2>
        <p>${esc(researchProfile.titleZh || '')}</p>
        <div class="ws-profile-meta">
          <span><strong>传感器</strong>${(researchProfile.sensorsDisplay || researchProfile.sensors || []).map(esc).join(' · ')}</span>
          <span><strong>核心科学问题</strong>${esc(researchProfile.primaryQuestionZh || researchProfile.primaryQuestion)}</span>
          <span><strong>失败假设</strong>${(researchProfile.hypothesesDisplay || researchProfile.hypotheses || []).map(esc).join(' · ')}</span>
          <span><strong>后续扩展</strong>${(researchProfile.futureExtensionsDisplay || researchProfile.futureExtensions || []).map(esc).join(' · ')} <em class="ws-tag-soft">${esc(researchProfile.worldModelStatus || '')} · ${esc(researchProfile.vlaStatus || '')}</em></span>
        </div>
      </div>
      <div class="section-heading"><div><span class="section-kicker">研究链路 · RESEARCH PIPELINE</span><h3>研究主线 · 点击节点查看信息卡</h3></div>
        <button class="outline-button" id="thesis-export" type="button">${ui.exportMarkdown}</button></div>
      <div class="thesis-graph">${flow}</div>
      <p class="ws-disclaimer">该评分用于研究决策辅助，不代表正式的文献计量或创新性证明。</p>`;
    body.querySelectorAll('[data-ws-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = nodes.find((x) => x.id === btn.dataset.wsNode);
        if (n) openNodeModal(n);
      });
    });
    body.querySelectorAll('[data-ws-paper]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('ws:open-paper', { detail: a.getAttribute('href') })); });
    });
    body.querySelector('#thesis-export').addEventListener('click', () => exportThesisMarkdown(nodes));
  },
});

function exportThesisMarkdown(nodes) {
  const lines = [
    `# 当前研究主线 — ${researchProfile.titleZh || researchProfile.title}`,
    '',
    `**核心科学问题：** ${researchProfile.primaryQuestionZh || researchProfile.primaryQuestion}`,
    `**传感器：** ${researchProfile.sensors.join('；')}`,
    `**说明：** ${researchProfile.evidenceGateNoteZh || researchProfile.evidenceGateNote}`,
    '',
    '| 研究节点 | 研究定位 | 当前状态 | 判断可信度 | 科学问题 |',
    '|---|---|---|---|---|',
  ];
  nodes.forEach((n) => {
    const role = roleLabels[n.role] || n.role;
    const st = statusLabels[n.status] || n.status;
    lines.push(`| ${n.titleZh || n.title} | ${role} | ${st} | ${n.confidence}/100 | ${n.scientificQuestion || '—'} |`);
  });
  lines.push('', '> 从研究工作台导出。评分为研究决策辅助，不代表正式证明。');
  exportMarkdown('research-thesis.md', lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Paper navigation hook — the radar app owns ?paper= routing
// ---------------------------------------------------------------------------
window.addEventListener('ws:open-paper', (e) => {
  const url = new URL(e.detail, location.href);
  history.pushState({}, '', url.pathname + url.search);
  window.WorkspaceView.hide();
  if (typeof window.__radarRerender === 'function') window.__radarRerender();
});

// ---------------------------------------------------------------------------
// Public hook used by the radar app shell (app.js render loop)
// ---------------------------------------------------------------------------
window.WorkspaceView = {
  render,
  hide() {
    const sec = document.getElementById('workspace-section');
    if (sec) { sec.classList.add('hidden'); sec.innerHTML = ''; }
  },
};

// scorePaper is defined in the collision module (appended below); referenced by thesis modal.

// ===========================================================================
// VIEW: Collision Radar (spec §8–§12)
// Rule-based, explainable collision scoring. Weights live ONLY in
// v2-data.js collisionConfig (spec §9). Scores are heuristic aids (spec §74).
// ===========================================================================

const OVERLAP_KEYS = ['problemOverlap', 'stateOverlap', 'activeActionOverlap', 'recoveryOverlap', 'theoryOverlap'];

// Pure scoring function — exported for tests via window.V2Logic
function scorePaper(paper) {
  const cfg = collisionConfig;
  const text = collisionText(paper);
  const reasons = [];
  let score = 0;
  for (const [key, dim] of Object.entries(cfg.dimensions)) {
    let hit = false;
    if (dim.requireAll) {
      hit = dim.requireAll.every(([, re]) => re.test(text));
    } else if (dim.any) {
      hit = dim.any.some((re) => re.test(text));
    }
    if (hit) {
      score += cfg.weights[key] || 0;
      reasons.push({ key, label: dim.label, weight: cfg.weights[key] || 0 });
    }
  }
  return { score: Math.min(100, score), reasons };
}

function collisionText(paper) {
  return [paper.title, paper.abstract, paper.abstract_zh, ...(paper.research_topics || []),
    ...(paper.methods || []), ...(paper.sensors || []), ...(paper.keywords || []),
    ...(paper.tasks || [])].join(' ');
}

function riskLevelFor(score) {
  return collisionConfig.riskLevels.find((r) => score <= r.max) || collisionConfig.riskLevels[collisionConfig.riskLevels.length - 1];
}

// --- Change monitoring state (localStorage, keyed by paper_id; spec §11) ---
function collisionHistory() { return lsGet('collision-history', {}); }
function updateCollisionHistory(scored) {
  const today = new Date().toISOString();
  const hist = collisionHistory();
  const changed = [];
  scored.forEach(({ p, r }) => {
    const prev = hist[p.paper_id];
    if (!prev) {
      hist[p.paper_id] = { firstSeen: today, lastChecked: today, collisionScore: r.score, previousCollisionScore: r.score };
    } else {
      prev.previousCollisionScore = prev.collisionScore;
      prev.collisionScore = r.score;
      prev.lastChecked = today;
      if (prev.previousCollisionScore !== r.score) changed.push(p.paper_id);
    }
  });
  lsSet('collision-history', hist);
  return changed;
}
function isNewThisWeek(h) {
  if (!h?.firstSeen) return false;
  return (Date.now() - new Date(h.firstSeen).getTime()) < 7 * 864e5;
}

// User-set impact / verification per paper (spec §10)
function paperMetaStore() { return lsGet('collision-meta', {}); }
function setPaperMeta(pid, patch) {
  const m = paperMetaStore(); m[pid] = { ...(m[pid] || {}), ...patch }; lsSet('collision-meta', m);
}

registerView('collision', {
  title: 'Collision Radar',
  async render(body) {
    const papers = papersData?.papers || [];
    const scored = papers.map((p) => ({ p, r: scorePaper(p) }))
      .filter((x) => x.r.score > 0)
      .sort((a, b) => b.r.score - a.r.score);
    updateCollisionHistory(scored);
    const meta = paperMetaStore();
    const hist = collisionHistory();
    const minScore = Number(new URLSearchParams(location.search).get('minScore')) || 31; // Moderate+

    const alerts = {
      newThisWeek: scored.filter((x) => isNewThisWeek(hist[x.p.paper_id])).length,
      increased: scored.filter((x) => { const h = hist[x.p.paper_id]; return h && h.collisionScore > h.previousCollisionScore; }).length,
      recent: scored.filter((x) => (x.p.published_date || '') >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)).length,
      rereview: scored.filter((x) => (meta[x.p.paper_id]?.impact && meta[x.p.paper_id].impact !== 'No impact') && !meta[x.p.paper_id]?.verified).length,
    };

    const visible = scored.filter((x) => x.r.score >= minScore);
    const card = ({ p, r }) => {
      const lvl = riskLevelFor(r.score);
      const m = meta[p.paper_id] || {};
      const h = hist[p.paper_id];
      const impact = m.impact || '';
      const verified = m.verified || '';
      const chips = [
        isNewThisWeek(h) ? `<span class="ws-alert-chip alert-new">本周新增</span>` : '',
        h && h.collisionScore > h.previousCollisionScore ? '<span class="ws-alert-chip alert-up">风险上升</span>' : '',
      ].join('');
      return `<article class="collision-card risk-${lvl.key}" data-collision-card>
        <header>
          <div class="collision-score-box risk-${lvl.key}" title="撞题风险评分"><b>${r.score}</b><span>${esc(riskLabels[lvl.key] || lvl.label)}</span></div>
          <div class="collision-head-text">
            <h4><a href="?paper=${encodeURIComponent(p.paper_id)}" data-ws-paper title="查看论文（标题保持原文）">${esc(p.title)}</a></h4>
            <p class="ws-muted">${esc(p.venue || 'arXiv')} · ${dateLabel(p.published_date)} ${chips}</p>
          </div>
        </header>
        <div class="collision-why">
          <span class="section-kicker">重合原因 · WHY IT COLLIDES</span>
          <div class="ws-chip-row">${r.reasons.map((x) => `<span class="ws-chip">${esc(dimensionLabels[x.key] || x.label)} +${x.weight}</span>`).join('')}</div>
        </div>
        <div class="collision-covers">
          <span class="section-kicker">尚未覆盖的部分 · WHAT IT DOES NOT COVER</span>
          <div class="ws-chip-row">${missingCoverage(r).map((x) => `<span class="ws-chip ws-chip-dim">${esc(x)}</span>`).join('')}</div>
        </div>
        <div class="collision-actions">
          <label>对当前课题的影响
            <select data-meta="impact"><option value="">—</option>${collisionConfig.impactLevels.map((v) => `<option ${v === impact ? 'selected' : ''}>${esc(impactLabels[v] || v)}</option>`).join('')}</select>
          </label>
          <label>文献核验状态
            <select data-meta="verified"><option value="">—</option>${collisionConfig.verificationLevels.map((v) => `<option ${v === verified ? 'selected' : ''}>${esc(cardVerificationLabels[v] || v)}</option>`).join('')}</select>
          </label>
          <label>最接近的研究节点
            <select data-meta="closestNode"><option value="">—</option>${researchNodes.map((n) => `<option value="${esc(n.id)}" ${m.closestNode === n.id ? 'selected' : ''}>${esc(n.titleZh || n.title)}</option>`).join('')}</select>
          </label>
        </div>
      </article>`;
    };

    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 撞题雷达 · COLLISION RADAR</div>
        <h2>撞题雷达</h2>
        <p>评分综合考虑传感模态、科学问题、状态表示、主动动作、恢复机制和理论基础六个维度。</p>
        <p class="ws-disclaimer">该评分用于研究决策辅助，不代表正式的文献计量或创新性证明。</p>
      </div>
      <div class="ws-stat-row">
        <div class="stat-card accent-rose"><span class="stat-label">本周新增高风险论文</span><strong>${alerts.newThisWeek}</strong><small>首次出现 ≤7 天</small></div>
        <div class="stat-card accent-amber"><span class="stat-label">撞题风险上升</span><strong>${alerts.increased}</strong><small>相比上次检查</small></div>
        <div class="stat-card accent-cyan"><span class="stat-label">最新发表</span><strong>${alerts.recent}</strong><small>近 14 天发表</small></div>
        <div class="stat-card accent-violet"><span class="stat-label">需要重新审查</span><strong>${alerts.rereview}</strong><small>有影响判定但未核验</small></div>
      </div>
      <div class="ws-toolbar">
        <label>风险下限
          <select id="collision-minscore">
            <option value="31" ${minScore === 31 ? 'selected' : ''}>中等及以上</option>
            <option value="51" ${minScore === 51 ? 'selected' : ''}>高及以上</option>
            <option value="71" ${minScore === 71 ? 'selected' : ''}>很高及以上</option>
            <option value="86" ${minScore === 86 ? 'selected' : ''}>仅极高</option>
          </select>
        </label>
        <span class="ws-muted">${visible.length} / ${scored.length} 篇有重合信号</span>
        <button class="outline-button" id="collision-export" type="button">${ui.exportMarkdown}</button>
      </div>
      <div class="collision-list">${visible.map(card).join('') || `<div class="ws-notice"><p>${ui.noCollision}。可降低风险下限，或在撞题雷达配置中调整维度规则。</p></div>`}</div>`;

    body.querySelector('#collision-minscore').addEventListener('change', (e) => {
      const url = new URL(location.href);
      url.searchParams.set('view', 'workspace');
      url.searchParams.set('ws', 'collision');
      url.searchParams.set('minScore', e.target.value);
      history.pushState({}, '', url); render();
    });
    body.querySelectorAll('[data-meta]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const card = sel.closest('[data-collision-card]');
        const href = card.querySelector('[data-ws-paper]').getAttribute('href');
        const pid = decodeURIComponent(href.split('paper=')[1] || '');
        if (pid) setPaperMeta(pid, { [sel.dataset.meta]: sel.value });
      });
    });
    body.querySelectorAll('[data-ws-paper]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState({}, '', a.getAttribute('href'));
        window.WorkspaceView.hide();
        if (typeof window.__radarRerender === 'function') window.__radarRerender();
      });
    });
    body.querySelector('#collision-export').addEventListener('click', () => {
      const lines = ['# 撞题雷达报告', '',
        '| 论文 | 年份/来源 | 撞题风险评分 | 风险等级 | 重合原因 | 对当前课题的影响 | 文献核验状态 |',
        '|---|---|---|---|---|---|---|'];
      visible.forEach(({ p, r }) => {
        const lvl = riskLevelFor(r.score); const m = meta[p.paper_id] || {};
        lines.push(`| ${p.title} | ${dateLabel(p.published_date)} ${p.venue || ''} | ${r.score} | ${riskLabels[lvl.key] || lvl.label} | ${r.reasons.map((x) => dimensionLabels[x.key] || x.label).join('；')} | ${impactLabels[m.impact] || m.impact || '—'} | ${cardVerificationLabels[m.verified] || m.verified || '仅元数据'} |`);
      });
      lines.push('', '> 启发式研究决策辅助，不代表正式文献计量证明。');
      exportMarkdown('collision-radar.md', lines.join('\n'));
    });
  },
});

// Coverage gap: dimensions NOT matched by this paper (interpretive helper, spec §10)
const COVERAGE_META = {
  problemOverlap: '科学问题重合',
  stateOverlap: '状态 / 信念表示重合',
  activeActionOverlap: '主动动作机制重合',
  recoveryOverlap: '恢复机制重合',
  theoryOverlap: '理论基础重合',
};
function missingCoverage(r) {
  const hit = new Set(r.reasons.map((x) => x.key));
  return OVERLAP_KEYS.filter((k) => !hit.has(k)).map((k) => COVERAGE_META[k]);
}

// Expose pure logic for Python-independent browser checks and future tests
window.V2Logic = { scorePaper, riskLevelFor, missingCoverage, collisionConfig };

// ===========================================================================
// VIEW: Novelty Red Team (spec §13–§17, §73, §88–§89)
// Heuristic, hand-authored red-team evaluations from v2-data.js. No LLM wired
// in V2; the hostile-reviewer prompt template is displayed for future use.
// ===========================================================================
const REL_META = {
  'essentially-equivalent': { label: '基本等价', cls: 'rel-eq' },
  'strong-overlap': { label: '高度重合', cls: 'rel-strong' },
  'partial-overlap': { label: '部分重合', cls: 'rel-partial' },
  'distinct': { label: '明显不同', cls: 'rel-distinct' },
  'unclear': { label: '尚不明确', cls: 'rel-unclear' },
};
const REC_META = {
  keep: { label: '保留', cls: 'rec-keep' },
  narrow: { label: '保留，但需收缩', cls: 'rec-narrow' },
  merge: { label: '合并到其他创新点', cls: 'rec-merge' },
  rename: { label: '重新命名', cls: 'rec-rename' },
  downgrade: { label: '降级为支撑内容', cls: 'rec-downgrade' },
  remove: { label: '删除', cls: 'rec-remove' },
};
// Concept 显示名（§24）：中文主名称 + 英文/缩写括号
const conceptDisplayNames = {
  'evidence-sufficiency': '证据充分性（Evidence Sufficiency，操作性决策变量）',
  'prediction-confidence': '预测置信度（Prediction Confidence）',
  'epistemic-uncertainty': '认知不确定性（Epistemic Uncertainty）',
  'calibration': '校准（Calibration，ECE）',
  'selective-prediction': '选择性预测（Selective Prediction）',
  'reject-option': '拒识（Reject Option）',
  'abstention': '暂缓判断（Abstention）',
  'bayes-risk': '贝叶斯风险（Bayes Risk）',
  'value-of-information': '信息价值（Value of Information, VOI）',
  'diagnosability': '可诊断性（Diagnosability）',
  'fault-isolability': '故障可隔离性（Fault Isolability）',
  'observability': '可观测性（Observability）',
  'information-gain': '信息增益（Information Gain, IG）',
  'active-fault-diagnosis': '主动故障诊断（Active Fault Diagnosis, AFD）',
  'active-tactile': '主动触觉探索（Active Tactile Exploration）',
  'dual-control': '双控制（Dual Control）',
  'pomdp': '部分可观测马尔可夫决策过程（POMDP）',
  'belief-space-planning': '信念空间规划（Belief-space Planning）',
  'optimal-experiment-design': '最优实验设计（Optimal Experiment Design, OED）',
  'sequential-hypothesis-testing': '序贯假设检验（Sequential Hypothesis Testing）',
};
const conceptName = (id) => conceptDisplayNames[id]
  || ((researchConcepts.find((c) => c.id === id) || {}).name) || id;

function redTeamCard(claim) {
  const rt = claim.redTeam || {};
  const rec = REC_META[claim.recommendation] || REC_META.keep;
  const overlapRows = (claim.closestConcepts || []).map((id) => {
    const rel = REL_META[overlapFor(claim, id)] || REL_META.unclear;
    return `<li><span class="ws-concept">${esc(conceptName(id))}</span><span class="ws-rel ${rel.cls}">${esc(rel.label)}</span></li>`;
  }).join('');
  return `<article class="redteam-card" data-redteam-card>
    <header class="redteam-head">
      <div>
        <span class="section-kicker">研究主张 · RESEARCH CLAIM</span>
        <h4>${esc(claim.title)}</h4>
        <p class="ws-muted">${esc(claim.description || '')}</p>
      </div>
      <div class="redteam-verdict">
        <div class="redteam-verdict-row"><span>创新性评分</span><b>${claim.noveltyScore ?? '—'}/5</b></div>
        <div class="redteam-verdict-row"><span>撞题风险</span><b>${claim.collisionRisk ?? '—'}/5</b></div>
        <div class="redteam-verdict-row"><span>证据强度</span><b>${esc(claim.evidenceStrength === 'high' ? '强' : claim.evidenceStrength === 'medium' ? '中' : claim.evidenceStrength === 'low' ? '弱' : '—')}</b></div>
        <span class="ws-rec ${rec.cls}">${esc(rec.label)}</span>
      </div>
    </header>
    <div class="redteam-body">
      <section><span class="section-kicker">原子主张拆解 · ATOMIC CLAIMS</span><div class="ws-chip-row">${(claim.atomicClaims || []).map((a) => `<span class="ws-chip ws-chip-dim">${esc(a)}</span>`).join('')}</div></section>
      <section><span class="section-kicker">最接近的已有理论 · 语义重合关系</span>
        ${overlapRows ? `<ul class="redteam-overlaps">${overlapRows}</ul>` : `<p class="ws-muted">${ui.noData}</p>`}
      </section>
      ${rt.existingTheory ? `<section><span class="section-kicker">已有理论基础 · EXISTING THEORY</span><p>${esc(rt.existingTheory)}</p></section>` : ''}
      ${rt.closestRoboticsWork ? `<section><span class="section-kicker">最接近的机器人工作 · CLOSEST ROBOTICS WORK</span><p>${esc(rt.closestRoboticsWork)}</p></section>` : ''}
      ${rt.strongestCounterexample ? `<section><span class="section-kicker">最强反例 · STRONGEST COUNTEREXAMPLE</span><p>${esc(rt.strongestCounterexample)}</p></section>` : ''}
      ${rt.whatCanBeClaimed ? `<section><span class="section-kicker">仍可保留的创新表述 · WHAT CAN STILL BE CLAIMED</span><p>${esc(rt.whatCanBeClaimed)}</p></section>` : ''}
      ${rt.suggestedRewrite ? `<section class="ws-note"><span class="section-kicker">建议修改表述 · SUGGESTED REWRITE</span><p>${esc(rt.suggestedRewrite)}</p></section>` : ''}
    </div>
    <footer class="ws-muted">启发式审查 · 最近审查 ${esc(claim.lastReviewed || '—')} · AI 生成的研究假设，需要人工核验</footer>
  </article>`;
}
function overlapFor(claim, conceptId) {
  // For the dedicated Evidence Sufficiency evaluation, relationships are explicit.
  if (claim.id === 'evidence-sufficiency-demo') return 'strong-overlap';
  return 'partial-overlap';
}

registerView('red-team', {
  title: '创新性红队审查',
  async render(body) {
    const es = evidenceSufficiencyRedTeam;
    const esCard = redTeamCard({
      id: 'evidence-sufficiency-demo',
      title: es.claim,
      description: '演示用例：验证系统能够表达“创新点被否定”。',
      atomicClaims: ['证据充分性作为独立理论'],
      closestConcepts: es.overlaps.map((o) => o.conceptId),
      noveltyScore: es.verdict.noveltyScore, collisionRisk: es.verdict.collisionRisk,
      evidenceStrength: es.verdict.evidenceStrength,
      recommendation: es.verdict.recommendation,
      redTeam: {
        existingTheory: es.existingTheory,
        closestRoboticsWork: es.closestRoboticsWork,
        strongestCounterexample: es.strongestCounterexample,
        whatCanBeClaimed: es.whatCanBeClaimed,
        suggestedRewrite: es.suggestedRewrite,
      },
      lastReviewed: '2026-09-13',
    });

    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 创新性红队审查 · NOVELTY RED TEAM</div>
        <h2>创新性红队审查</h2>
        <p>不以证明当前方案有创新为目标，而是主动寻找能够推翻当前创新主张的已有理论、论文和反例，判断当前创新主张是否能够成立，并给出保留 / 收缩 / 改名 / 删除建议。评分均为启发式研究决策辅助。</p>
        <p class="ws-disclaimer">该评分用于研究决策辅助，不代表正式的文献计量或创新性证明。AI 生成的研究假设，需要人工核验。</p>
      </div>
      <div class="section-heading"><div><span class="section-kicker">关键示例 · 证据充分性</span><h3>示例：一个被否定的创新点</h3></div></div>
      ${esCard}
      <div class="section-heading" style="margin-top:34px"><div><span class="section-kicker">全部研究主张 · RESEARCH CLAIMS</span><h3>全部研究主张</h3></div>
        <button class="outline-button" id="redteam-export" type="button">${ui.exportMarkdown}</button></div>
      ${researchClaims.map((c) => redTeamCard(c)).join('')}
      <details class="ws-collapsible"><summary>Prompt 模板（未来接入 LLM 用，当前不调用）</summary><pre class="ws-prompt">${esc(aiRedTeamPrompt)}</pre></details>`;

    body.querySelector('#redteam-export').addEventListener('click', () => {
      const strengthZh = (v) => (v === 'high' ? '强' : v === 'medium' ? '中' : v === 'low' ? '弱' : '—');
      const lines = ['# 创新性红队审查报告', ''];
      [esClaimAsRow(es), ...researchClaims].forEach((c) => {
        const rec = (REC_META[c.recommendation] || {}).label || c.recommendation;
        lines.push(`## ${c.title}`, `- 创新性评分：${c.noveltyScore ?? '—'}/5，撞题风险：${c.collisionRisk ?? '—'}/5，证据强度：${strengthZh(c.evidenceStrength)}`, `- 审查建议：${rec}`, `- 最接近的已有理论：${(c.closestConcepts || []).map(conceptName).join('；') || '—'}`);
        const rt = c.redTeam || {};
        if (rt.existingTheory) lines.push(`- 已有理论基础：${rt.existingTheory}`);
        if (rt.strongestCounterexample) lines.push(`- 最强反例：${rt.strongestCounterexample}`);
        if (rt.whatCanBeClaimed) lines.push(`- 仍可保留的创新表述：${rt.whatCanBeClaimed}`);
        if (rt.suggestedRewrite) lines.push(`- 建议修改表述：${rt.suggestedRewrite}`);
        lines.push('');
      });
      lines.push('> 启发式研究决策辅助，不代表正式证明。');
      exportMarkdown('novelty-red-team.md', lines.join('\n'));
    });
  },
});

function esClaimAsRow(es) {
  return { title: es.claim, noveltyScore: es.verdict.noveltyScore, collisionRisk: es.verdict.collisionRisk, evidenceStrength: es.verdict.evidenceStrength, recommendation: es.verdict.recommendation, closestConcepts: es.overlaps.map((o) => o.conceptId), redTeam: { existingTheory: es.existingTheory, strongestCounterexample: es.strongestCounterexample, suggestedRewrite: es.suggestedRewrite } };
}

// ===========================================================================
// VIEW: Failure Hypothesis Lab (spec §18–§26)
// Data-driven from v2-data.js seeds; user edits persist to localStorage.
// First version: hand-authored heuristic ratings (spec §23) — no fake models.
// ===========================================================================
const labStore = {
  hypotheses: () => lsGet('lab-hypotheses', labHypotheses),
  probes: () => lsGet('lab-probes', labProbes),
  saveHypotheses: (h) => lsSet('lab-hypotheses', h),
  saveProbes: (p) => lsSet('lab-probes', p),
};

// Pure NetVOI computation (spec §25) — heuristic estimate, labeled as such.
function computeNetVoi(entry, cfg = netVoiConfig) {
  const gross = (entry.decisionRiskReduction ?? entry.expectedInformationGain ?? 0) * cfg.decisionWeight;
  const cost = (entry.forceRisk || 0) * cfg.forceWeight
    + (entry.damageRisk || 0) * cfg.damageWeight
    + (entry.timeCost || 0) * cfg.timeWeight
    + (entry.progressCost || 0) * cfg.progressWeight;
  return { netVOI: gross - cost, gross, cost };
}
function probeRecommended(netVOI, cfg = netVoiConfig) { return netVOI > cfg.recommendThreshold; }

function pairKey(a, b) { return [a, b].sort().join('-vs-'); }
function discriminabilityFor(pairK, probeId) {
  return (labDiscriminability[pairK] || {})[probeId] ?? null;
}
function discLabel(v) {
  if (v == null) return '—';
  if (v >= 0.85) return 'VERY HIGH';
  if (v >= 0.65) return 'HIGH';
  if (v >= 0.4) return 'MEDIUM';
  if (v >= 0.2) return 'LOW';
  return 'VERY LOW';
}

registerView('failure-lab', {
  title: '失败假设实验室',
  async render(body) {
    const hyps = labStore.hypotheses();
    const probes = labStore.probes();
    const hypLabel = (id) => hypothesisNameLabels[id] || (hyps.find((h) => h.id === id) || {}).name || id;
    const hypOptions = hyps.map((h) => `<option value="${esc(h.id)}">${esc(hypLabel(h.id))}</option>`).join('');
    const selA = new URLSearchParams(location.search).get('hA') || 'jam';
    const selB = new URLSearchParams(location.search).get('hB') || 'misalignment';
    const pairK = pairKey(selA, selB);

    // --- Hypothesis Matrix (spec §21) ---
    const matrixRows = hyps.map((h) => `<tr>
      <td><strong>${esc(hypLabel(h.id))}</strong>${hypothesisTips[h.id] ? `<br><small class="ws-muted" title="${esc(hypothesisTips[h.id])}">ⓘ</small>` : ''}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="visualEvidence">${esc((h.visualEvidence || []).join('; '))}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="forceEvidence">${esc((h.forceEvidence || []).join('; '))}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="temporalPattern">${esc(h.temporalPattern || '')}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="expectedPhase">${esc(h.expectedPhase || '')}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="recoverability">${h.recoverability ?? ''}</td>
      <td contenteditable="true" data-h="${esc(h.id)}" data-field="severity">${h.severity ?? ''}</td>
    </tr>`).join('');

    // --- Probe comparison for the selected pair (spec §23) ---
    const probeRows = probes.map((pr) => {
      const d = discriminabilityFor(pairK, pr.id);
      const dCls = d == null ? '' : (d >= 0.65 ? 'disc-high' : d >= 0.4 ? 'disc-mid' : 'disc-low');
      const riskCls = (pr.riskScore || 0) >= 0.5 ? 'disc-low' : (pr.riskScore || 0) >= 0.25 ? 'disc-mid' : 'disc-high';
      const dText = d == null ? '—（未评分）' : `${discriminabilityLabels[discLabel(d)] || discLabel(d)} <small class="ws-muted">${d}</small>`;
      return `<tr class="${pr.applicableHypotheses && !(pr.applicableHypotheses.includes(selA) || pr.applicableHypotheses.includes(selB)) ? 'probe-not-applicable' : ''}">
        <td><strong>${esc(probeNameLabels[pr.id] || pr.name)}</strong><br><small class="ws-muted">${esc(pr.description || '')}</small></td>
        <td class="${dCls}">${dText}</td>
        <td class="${riskCls}">${pr.riskScore != null ? `${pr.riskScore}${pr.riskScore >= 0.5 ? ' · 高风险' : ''}` : '—'}</td>
        <td>${esc(pr.maxDisplacement || '—')} / ${esc(pr.maxForce || pr.maxTorque || '—')}</td>
        <td>${pr.reversible ? '是' : '<b class="ws-risk-flag">否</b>'}</td>
      </tr>`;
    }).join('');

    // --- NetVOI table (spec §25–§26) ---
    const voiRows = labNetVoi.map((entry) => {
      const { netVOI } = computeNetVoi(entry);
      const rec = probeRecommended(netVOI);
      const probe = probes.find((p) => p.id === entry.actionId);
      return `<tr>
        <td><strong>${esc(probeNameLabels[entry.actionId] || probe?.name || entry.actionId)}</strong></td>
        <td>${entry.decisionRiskReduction}</td>
        <td>${entry.forceRisk}</td>
        <td>${entry.damageRisk}</td>
        <td>${entry.timeCost}</td>
        <td>${entry.progressCost}</td>
        <td class="${netVOI > 0 ? 'disc-high' : 'disc-low'}"><b>${netVOI.toFixed(2)}</b></td>
        <td>${rec ? '<span class="ws-rec rec-keep">建议执行主动探测</span>' : '<span class="ws-rec rec-remove">建议暂缓判断或执行安全恢复</span>'}</td>
      </tr>`;
    }).join('');

    const task = labTasks[0] || {};
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 失败假设实验室 · FAILURE HYPOTHESIS LAB</div>
        <h2>失败假设实验室</h2>
        <p>为具体机器人接触任务定义成功与失败假设，并分析视觉、连续 6D F/T 以及主动探测动作对不同假设的区分能力。矩阵单元格可直接编辑，编辑结果自动保存在当前浏览器中。</p>
        <p class="ws-disclaimer">启发式估计 — 所有判别性与净信息价值（NetVOI）数值都是人工填写的启发式估计，不是校准过的概率。</p>
      </div>

      <div class="section-heading"><div><span class="section-kicker">操作任务 · TASK</span><h3>${esc(taskNameLabels[task.id] || task.name || '—')}</h3></div></div>
      <p class="ws-muted">${esc(task.description || '')}</p>
      <p class="ws-muted">机器人平台：${esc(task.robot || '—')} · 传感器：${(task.sensors || []).map(esc).join(' · ')} · 任务阶段：${(task.phasesDisplay || task.phases || []).map(esc).join(' → ')}</p>

      <div class="section-heading" style="margin-top:28px"><div><span class="section-kicker">失败假设矩阵 · FAILURE HYPOTHESIS MATRIX</span><h3>失败假设矩阵（可编辑）</h3></div>
        <button class="outline-button" id="lab-export" type="button">${ui.exportMarkdown}</button></div>
      <div class="ws-table-wrap"><table class="ws-table">
        <thead><tr><th>失败假设</th><th>视觉证据</th><th>力觉证据</th><th>时序特征</th><th>预期任务阶段</th><th>可恢复性</th><th>严重程度</th></tr></thead>
        <tbody id="lab-matrix">${matrixRows}</tbody>
      </table></div>

      <div class="section-heading" style="margin-top:34px"><div><span class="section-kicker">假设判别分析 · HYPOTHESIS DISCRIMINATION</span><h3>假设对比：哪些观测/探测最能区分？</h3></div></div>
      <div class="ws-toolbar">
        <label>假设 A <select id="lab-ha">${hypOptions}</select></label>
        <label>假设 B <select id="lab-hb">${hypOptions}</select></label>
      </div>
      <div class="ws-table-wrap"><table class="ws-table">
        <thead><tr><th>主动探测动作</th><th>预期区分能力</th><th>风险</th><th>限制（位移 / 力·力矩）</th><th>是否可逆</th></tr></thead>
        <tbody>${probeRows}</tbody>
      </table></div>

      <div class="section-heading" style="margin-top:34px"><div><span class="section-kicker">主动探测决策 · 净信息价值</span><h3>主动探测决策（Probe vs Abstain）</h3></div></div>
      <p class="ws-muted">在继续探测、直接恢复、暂缓判断和安全停止之间进行决策。净信息价值（NetVOI）= 预期决策风险降低 − 接触力风险 − 二次损伤风险 − 时间代价 − 任务进度损失（启发式加权）。支持"不知道，但不值得继续探索"：NetVOI ≤ 阈值时明确建议暂缓判断或执行安全恢复，可选动作包括 ${probeDecisionOptions.map((o) => decisionOptionLabels[o] || o).join(' · ')}。</p>
      <div class="ws-table-wrap"><table class="ws-table">
        <thead><tr><th>动作</th><th>预期决策风险降低</th><th>接触力风险</th><th>二次损伤风险</th><th>时间代价</th><th>任务进度损失</th><th>净信息价值（NetVOI）</th><th>建议</th></tr></thead>
        <tbody>${voiRows}</tbody>
      </table></div>
      <p class="ws-disclaimer">当前 NetVOI 为研究决策辅助指标，并非经过统计校准的真实概率或正式安全保证。${esc(netVoiConfig.scaleNote)}</p>`;

    // bind pair selectors
    const applyPair = () => {
      const a = body.querySelector('#lab-ha').value, b = body.querySelector('#lab-hb').value;
      const url = new URL(location.href);
      url.searchParams.set('view', 'workspace'); url.searchParams.set('ws', 'failure-lab');
      url.searchParams.set('hA', a); url.searchParams.set('hB', b);
      history.pushState({}, '', url); render();
    };
    body.querySelector('#lab-ha').value = selA; body.querySelector('#lab-hb').value = selB;
    body.querySelector('#lab-ha').addEventListener('change', applyPair);
    body.querySelector('#lab-hb').addEventListener('change', applyPair);

    // editable matrix persistence
    body.querySelectorAll('#lab-matrix [contenteditable]').forEach((cell) => {
      cell.addEventListener('blur', () => {
        const all = labStore.hypotheses();
        const h = all.find((x) => x.id === cell.dataset.h);
        if (!h) return;
        const v = cell.textContent.trim();
        const f = cell.dataset.field;
        if (f === 'visualEvidence' || f === 'forceEvidence') h[f] = v ? v.split(/[;；]/).map((s) => s.trim()).filter(Boolean) : [];
        else if (f === 'recoverability' || f === 'severity') h[f] = v === '' ? null : Number(v);
        else h[f] = v;
        labStore.saveHypotheses(all);
      });
    });

    body.querySelector('#lab-export').addEventListener('click', () => {
      const hypLabel = (id) => hypothesisNameLabels[id] || (hyps.find((h) => h.id === id) || {}).name || id;
      const lines = [`# 失败假设实验室 — ${taskNameLabels[task.id] || task.name || ''}`, '',
        '## 失败假设矩阵', '',
        '| 失败假设 | 视觉证据 | 力觉证据 | 时序特征 | 预期任务阶段 | 可恢复性 | 严重程度 |',
        '|---|---|---|---|---|---|---|'];
      hyps.forEach((h) => lines.push(`| ${hypLabel(h.id)} | ${(h.visualEvidence || []).join('；')} | ${(h.forceEvidence || []).join('；')} | ${h.temporalPattern || '—'} | ${h.expectedPhase || '—'} | ${h.recoverability ?? '—'} | ${h.severity ?? '—'} |`));
      lines.push('', `## 假设判别分析：${hypLabel(selA)} vs ${hypLabel(selB)}`, '', '| 主动探测动作 | 预期区分能力 | 风险 | 是否可逆 |', '|---|---|---|---|');
      probes.forEach((pr) => {
        const d = discriminabilityFor(pairK, pr.id);
        lines.push(`| ${probeNameLabels[pr.id] || pr.name} | ${d == null ? '未评分' : (discriminabilityLabels[discLabel(d)] || discLabel(d)) + ` (${d})`} | ${pr.riskScore ?? '—'} | ${pr.reversible ? '是' : '否'} |`);
      });
      lines.push('', '## 主动探测决策 · 净信息价值（启发式）', '', '| 动作 | 净信息价值（NetVOI） | 建议 |', '|---|---|---|');
      labNetVoi.forEach((entry) => { const { netVOI } = computeNetVoi(entry); lines.push(`| ${probeNameLabels[entry.actionId] || entry.actionId} | ${netVOI.toFixed(2)} | ${probeRecommended(netVOI) ? '建议执行主动探测' : '建议暂缓判断或执行安全恢复'} |`); });
      lines.push('', '> 启发式估计，不是校准过的概率或正式安全保证。');
      exportMarkdown('failure-hypothesis-lab.md', lines.join('\n'));
    });
  },
});

// Expose lab logic for tests
window.V2Logic.computeNetVoi = computeNetVoi;
window.V2Logic.probeRecommended = probeRecommended;
window.V2Logic.pairKey = pairKey;

// ===========================================================================
// VIEW: Experiment Matrix Builder (spec §27–§30)
// ===========================================================================
const expStore = { list: () => lsGet('experiments', defaultExperiments), save: (x) => lsSet('experiments', x) };
const enabledStore = { get: () => lsGet('exp-enabled', null), set: (x) => lsSet('exp-enabled', x) };

function enabledBaselines() {
  const saved = enabledStore.get();
  if (saved) return saved; // 已有用户选择，不覆盖
  // 默认：全部启用，除「扩展诊断对照」（置信度阈值 / 暂缓判断，仅用户需要时手动启用）
  return Object.fromEntries(experimentBaselines.map((b) => [b.id, b.id !== 'conf-threshold' && b.id !== 'abstain']));
}

registerView('experiments', {
  title: '实验设计器',
  async render(body) {
    // 安全默认值：数据缺失时不得白屏，走空态兜底（验收指令 §一.4）
    const claims = researchClaims ?? [];
    const exps = expStore.list() ?? [];
    const enabled = enabledBaselines();
    const claimById = (id) => claims.find((c) => c.id === id);

    const claimsSection = claims.length
      ? `<div class="ws-claims-list">${claims.map((c) => `<div class="dash-item"><b>${esc(c.titleZh || c.title)}</b>${c.titleZh && c.title !== c.titleZh ? `<small class="ws-muted" style="display:block">${esc(c.title)}</small>` : ''}</div>`).join('')}</div>`
      : `<div class="ws-notice"><p>暂无研究主张。请先添加研究主张，或使用默认研究主线生成实验。</p>
          <button class="outline-button" id="exp-use-default-claims" type="button" style="margin-top:12px">使用默认研究主张</button></div>`;

    const baselineChecks = experimentBaselines.map((b) => `<label class="ws-check"><input type="checkbox" data-baseline="${esc(b.id)}" ${enabled[b.id] ? 'checked' : ''}> ${esc(baselineLabels[b.id] || b.name)}</label>`).join('');
    const metricChips = Object.entries(experimentMetrics).map(([group, list]) =>
      `<div class="ws-metric-group"><span class="section-kicker">${esc(metricGroupLabels[group] || group)}</span><div class="ws-chip-row">${list.map((m) => `<span class="ws-chip ws-chip-dim" title="${esc(m)}">${esc(metricLabels[m] || m)}</span>`).join('')}</div></div>`).join('');

    // baseline selection：矩阵单元格只显示该实验「适用且已启用」的基线（内部 id 英文，显示中文）
    const applicableOf = (e) => e.applicableBaselines ?? [];
    const enabledFor = (e, en) => applicableOf(e).filter((id) => en[id]);
    const baseCell = (e, en) => {
      const on = enabledFor(e, en);
      if (on.length) return on.map((id) => `<span class="ws-chip ws-chip-dim">${esc(baselineLabels[id] || experimentBaselines.find((b) => b.id === id)?.name || id)}</span>`).join(' ');
      const off = applicableOf(e);
      if (!off.length) return `<span class="ws-muted">该实验未配置适用对比方法。</span>`;
      return `<span class="ws-muted">暂无启用的对比方法。</span><br><small class="ws-muted">适用但未启用：${off.map((id) => esc(baselineLabels[id] || experimentBaselines.find((b) => b.id === id)?.name || id)).join('、')}</small>`;
    };

    const expRows = (en) => exps.map((e) => {
      const c = claimById(e.claimId);
      return `<tr>
        <td><strong>${esc(e.id)}</strong></td>
        <td>${baseCell(e, en)}</td>
        <td>${esc(e.variable)}</td>
        <td>${esc(e.mainMetric)}</td>
        <td>${esc(c?.titleZh || c?.title || '—')}</td>
      </tr>`;
    }).join('');
    const expPurpose = exps.some((e) => e.purpose)
      ? `<div class="ws-metric-grid" style="margin-top:12px">${exps.map((e) => `<div class="ws-metric-group"><span class="section-kicker">${esc(e.id)} · ${esc(e.tag || '')}</span><div class="ws-chip-row"><span class="ws-chip ws-chip-dim">${esc(e.purpose || '')}</span></div></div>`).join('')}</div>`
      : '';

    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 实验设计器 · EXPERIMENT BUILDER</div>
        <h2>实验设计器</h2>
        <p>将研究主张转换为可证伪实验、对比方法、消融实验和评价指标。</p>
      </div>

      <div class="section-heading"><div><span class="section-kicker">研究主张 · RESEARCH CLAIMS</span><h3>研究主张</h3></div></div>
      ${claimsSection}

      <div class="section-heading" style="margin-top:30px"><div><span class="section-kicker">对比方法 · COMPARISON METHODS</span><h3>实验对比方法（勾选启用/禁用）</h3></div></div>
      <p class="ws-muted" style="margin-top:-6px">勾选的对比方法将实时用于下方实验矩阵和 Markdown 导出。</p>
      <div class="ws-check-grid">${baselineChecks}</div>

      <div class="section-heading" style="margin-top:30px"><div><span class="section-kicker">实验矩阵 · EXPERIMENT MATRIX</span><h3>实验矩阵（E1–E5）</h3></div>
        <button class="outline-button" id="exp-export" type="button">${ui.exportMarkdown}</button></div>
      <div class="ws-table-wrap"><table class="ws-table exp-matrix">
        <thead><tr><th>实验</th><th>对比方法</th><th>核心变量</th><th>主要指标</th><th>验证主张</th></tr></thead>
        <tbody>${expRows(enabled) || `<tr><td colspan="5" class="ws-muted">${ui.noData}</td></tr>`}</tbody>
      </table></div>
      ${expPurpose}

      <div class="section-heading" style="margin-top:30px"><div><span class="section-kicker">评价指标 · METRICS</span><h3>评价指标（按类别）</h3></div></div>
      <div class="ws-metric-grid">${metricChips}</div>
      <p class="ws-disclaimer">评分与建议结构均为启发式研究决策辅助，不代表正式证明。</p>`;

    const useDefaultBtn = body.querySelector('#exp-use-default-claims');
    if (useDefaultBtn) useDefaultBtn.addEventListener('click', () => { expStore.save(defaultExperiments); render(); });
    body.querySelectorAll('[data-baseline]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const state = enabledBaselines(); state[cb.dataset.baseline] = cb.checked; enabledStore.set(state);
        // 即时生效：勾选/取消后立即重渲染实验矩阵（无需应用按钮）
        render();
      });
    });
    body.querySelector('#exp-export').addEventListener('click', () => {
      const en = enabledBaselines();
      const lines = ['# 实验矩阵', '',
        '## 当前研究主张', '',
        ...((claims.length ? claims : []).map((c, i) => `${i + 1}. ${c.titleZh || c.title}`)),
        '', '## 已选对比方法', '',
        ...experimentBaselines.filter((b) => en[b.id]).map((b) => `- ${baselineLabels[b.id] || b.name}`),
        '', '## 实验矩阵（E1–E5）', '',
        '| 实验 | 对比方法 | 核心变量 | 主要指标 | 验证主张 |', '|---|---|---|---|---|',
      ];
      exps.forEach((e) => {
        const c = claimById(e.claimId);
        const bl = enabledFor(e, en);
        const blText = bl.length
          ? bl.map((id) => baselineLabels[id] || experimentBaselines.find((b) => b.id === id)?.name || id).join(' / ')
          : '（无启用基线）';
        lines.push(`| ${e.id} | ${blText} | ${e.variable} | ${e.mainMetric} | ${c ? (c.titleZh || c.title) : '—'} |`);
      });
      lines.push('', '## 实验目的', '');
      exps.forEach((e) => { if (e.purpose) lines.push(`- **${e.id}（${e.tag || ''}）**：${e.purpose}`); });
      lines.push('', '## 评价指标', '');
      Object.entries(experimentMetrics).forEach(([group, list]) => {
        lines.push(`**${metricGroupLabels[group] || group}**：${list.map((m) => metricLabels[m] || m).join('、')}`);
      });
      lines.push('', '> 启发式研究决策辅助，不代表正式证明。');
      exportMarkdown('experiment-matrix.md', lines.join('\n'));
    });
  },
});

// ===========================================================================
// VIEW: Multimodal Fusion Explorer (spec §31–§34) + Method Role Map (§35–§36)
// Descriptive comparison pages; ratings are heuristic, no code generation.
// ===========================================================================
const boolMark = (v) => (v ? '<span class="bool-yes">✓</span>' : '<span class="bool-no">✗</span>');

registerView('fusion', {
  title: '视觉力觉融合架构',
  async render(body) {
    const rec = recommendedArchitecture;
    const rows = fusionArchitectures.map((f) => `<tr>
      <td><strong>${esc(fusionLabels[f.id] || f.name)}</strong>${f.status ? `<br><em class="ws-tag-soft">${esc(f.status)}</em>` : ''}<br><small class="ws-muted">${esc(f.description)}</small></td>
      <td>${esc(f.visionRate)} / ${esc(f.forceRate)}</td>
      <td>${boolMark(f.usesHistory)}</td>
      <td>${boolMark(f.contactAware)}</td>
      <td>${boolMark(f.supportsAsync)}</td>
      <td>${boolMark(f.supportsUncertainty)}</td>
      <td>${boolMark(f.predictive)}</td>
      <td>${f.complexity}/10</td>
      <td>${f.realTimeSuitability}/10</td>
    </tr>`).join('');
    const recPipeline = (rec.pipelineDisplay || rec.pipeline).map((s) => `<div class="fusion-rec-step">${esc(s)}</div>`).join('');
    const recConfig = Object.entries(rec.configDisplay || rec.config).map(([k, v]) => {
      const label = v && typeof v === 'object' ? v.label : k;
      const value = v && typeof v === 'object' ? v.value : v;
      return `<div class="fusion-rec-cfg"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
    }).join('');
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 视觉力觉融合架构 · FUSION ARCHITECTURE EXPLORER</div>
        <h2>视觉力觉融合架构</h2>
        <p>比较各融合方式的适用条件与代价，帮助避免把热门结构当默认选择。评分为启发式。</p>
      </div>
      <div class="section-heading"><div><span class="section-kicker">${esc(rec.label)}</span><h3>当前推荐方案</h3></div></div>
      <div class="fusion-rec">
        <div class="fusion-rec-flow">${recPipeline}</div>
        <div class="fusion-rec-cfgs">${recConfig}</div>
        <p class="ws-muted">当前推荐路线不是简单地将视觉特征与 F/T 数值拼接，而是针对视觉与力觉异步、采样频率不同、有效阶段不同的特点，采用双流时序编码和接触条件化融合。仅用于展示推荐路线，不生成可运行代码。</p>
      </div>
      <div class="section-heading" style="margin-top:30px"><div><span class="section-kicker">架构对比 · ARCHITECTURE COMPARISON</span><h3>架构对比表</h3></div></div>
      <div class="ws-table-wrap"><table class="ws-table">
        <thead><tr><th>融合方式</th><th>采样率（视觉/力觉）</th><th>使用时序历史</th><th>接触阶段感知</th><th>支持异步</th><th>支持不确定性</th><th>预测能力</th><th>复杂度</th><th>实时性</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="ws-disclaimer">启发式对比，用于研究规划，不代表实测结果。世界模型融合与 VLA 属后续扩展 / 可选集成，不是硕士阶段默认必选。</p>`;
  },
});

registerView('methods', {
  title: '方法角色图谱',
  async render(body) {
    const groups = methodRoles.map((g) => `<section class="method-role-group">
      <h4>${esc(methodRoleGroupLabels[g.role] || g.role)}</h4>
      <div class="method-cards">${g.methods.map((m) => {
        const id = methodIdByName[m.name];
        return `<div class="method-card" ${id ? `data-method="${esc(id)}" role="button" tabindex="0" aria-haspopup="dialog"` : ''}>
        <strong>${esc(m.name)}</strong>
        <p class="method-solves"><span class="section-kicker">能够解决</span>${esc(m.solves)}</p>
        <p class="method-not"><span class="section-kicker">不能直接解决</span>${esc(m.doesNotSolve)}</p>
        ${m.note ? `<p class="ws-muted"><em>当前定位：${esc(m.note)}</em></p>` : ''}
        ${id ? `<span class="method-card-hint">点击查看详情</span>` : ''}
      </div>`;
      }).join('')}</div>
    </section>`).join('');
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 方法角色图谱 · METHOD ROLE MAP</div>
        <h2>方法角色图谱</h2>
        <p>一个算法负责解决什么，而不是是不是热门。按<b>角色</b>而非先进程度组织算法，每个方法明确标注"能够解决 / 不能直接解决"，防止"热门算法 = 创新"的误判。点击卡片查看方法详细解释。</p>
      </div>
      ${groups}
      <p class="ws-disclaimer">角色描述为启发式研究决策摘要，不是穷尽式文献综述。</p>`;

    body.querySelectorAll('[data-method]').forEach((card) => {
      card.addEventListener('click', () => openMethodModal(card.dataset.method, card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMethodModal(card.dataset.method, card); }
      });
    });
  },
});

// ===========================================================================
// VIEW: Gap Confidence Monitor (spec §37–§38) — upgrades existing Research Gap
// evidence with V2 status semantics. Missing fields are shown as unknown, NOT
// fabricated (no "not found" == "nobody studied it").
// ===========================================================================
const GAP_V2_STATUS = {
  'evidence-supported': 'STRONG',
  'partially-addressed': 'VIABLE',
  'open-hypotheses': 'TENTATIVE',
  'dataset-limited': 'WINDOW CLOSING',
};
// localStorage overrides for per-gap V2 fields (verification is manual work)
const gapV2Store = { get: () => lsGet('gap-v2', {}), set: (x) => lsSet('gap-v2', x) };

registerView('gaps', {
  title: '研究缺口可信度',
  async render(body) {
    const gaps = papersData?.landscape?.research_gaps || papersData?.landscape?.gaps || [];
    const v2 = gapV2Store.get();
    const cards = gaps.map((g) => {
      const gid = g.gap_id || g.id || g.title_en || g.title_zh || 'gap';
      const o = v2[gid] || {};
      const statusKey = o.status || GAP_V2_STATUS[g.gap_status] || 'TENTATIVE';
      const evidence = o.evidenceStrength ?? null; // 0-100, user-verified only
      const collision = o.collisionRisk ?? null;
      const ext = g.external_evidence || {};
      const sup = (g.supporting_evidence || ext.supporting || []).length;
      const cnt = (g.counter_evidence || ext.counter || []).length;
      const statusCls = { STRONG: 'rec-keep', VIABLE: 'rec-narrow', TENTATIVE: 'rec-merge', 'WINDOW CLOSING': 'rec-rename', 'COLLISION DETECTED': 'rec-remove', REJECTED: 'rec-remove' }[statusKey] || 'rec-merge';
      return `<article class="gapv2-card" data-gap="${esc(gid)}">
        <header><div><span class="ws-status-chip ${statusCls}">${esc(gapStatusLabels[statusKey] || statusKey)}</span>
          <h4>${esc(g.title_zh || g.title || gid)}</h4>
          <p class="ws-muted">${esc(g.title_en || '')}</p></div></header>
        <div class="gapv2-rows">
          <div><span>证据强度</span><b>${evidence != null ? evidence + ' / 100' : ui.unassessed}</b></div>
          <div><span>撞题风险</span><b>${collision != null ? collision + ' / 100' : ui.unassessed}</b></div>
          <div><span>支撑 / 反驳证据</span><b>${sup} / ${cnt}</b></div>
          <div><span>最近核验时间</span><b>${esc(o.lastVerified || '—')}</b></div>
        </div>
        <p class="ws-muted">雷达未找到相关证据 ≠ 没有人研究。当前判断由 gap_status 映射，证据/撞题分数仅在人工核验后填写。</p>
      </article>`;
    }).join('');
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 研究缺口可信度 · GAP CONFIDENCE MONITOR</div>
        <h2>研究缺口可信度</h2>
        <p>在现有 Research Gap 体系上增加研究决策语义：证据强度、撞题风险、当前判断。分数是启发式研究决策辅助。</p>
        <p class="ws-disclaimer">该评分用于研究决策辅助，不代表正式的文献计量或创新性证明。</p>
      </div>
      ${cards || `<div class="ws-notice"><p>${ui.noData} — landscape 数据中没有 gap 字段，请先运行 python scripts/build_landscape.py。</p></div>`}`;
  },
});

// ===========================================================================
// VIEW: Expansion Tree (spec §42–§43, §71) — no fabricated admission odds
// ===========================================================================
registerView('expansion', {
  title: '硕士博士研究扩展',
  async render(body) {
    const t = expansionTree;
    const master = t.masterCore.map((m) => `<div class="exp-node exp-master">${esc(m)}</div>`).join('');
    const dirs = t.phdDirections.map((d) => `<article class="exp-card">
      <header><h4 title="${esc(d.title)}">${esc(d.titleZh || d.title)}</h4>${d.status ? `<em class="ws-tag-soft">${esc(d.status)}</em>` : ''}</header>
      <div class="exp-grid">
        <div><span>${esc(expansionFieldLabels.scientificValue)}</span><b>${esc(d.scientificValue)}</b></div>
        <div><span>${esc(expansionFieldLabels.noveltyRisk)}</span><b>${esc(d.noveltyRisk)}</b></div>
        <div><span>${esc(expansionFieldLabels.technicalDifficulty)}</span><b>${esc(d.technicalDifficulty)}</b></div>
        <div><span>${esc(expansionFieldLabels.masterReuse)}</span><b>${esc(d.masterReuse)}</b></div>
        <div><span>${esc(expansionFieldLabels.requiredHardware)}</span><b>${esc(d.requiredHardware)}</b></div>
        <div><span>${esc(expansionFieldLabels.requiredData)}</span><b>${esc(d.requiredData)}</b></div>
        <div><span>${esc(expansionFieldLabels.potentialVenues)}</span><b>${esc(d.potentialVenues)}</b></div>
        <div><span>${esc(expansionFieldLabels.closestPapers)}</span><b>${(d.closestPapers || []).length ? esc(d.closestPapers.join('；')) : ui.pending}</b></div>
      </div>
    </article>`).join('');
    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 硕士博士研究扩展 · MASTER → PhD</div>
        <h2>硕士博士研究扩展</h2>
        <p>从当前硕士核心向博士方向扩展。只显示科学价值、风险、难度与所需资源；<b>不显示任何虚构的发表概率</b>。潜在投稿方向均标注"需核验"。</p>
      </div>
      <div class="section-heading"><div><span class="section-kicker">当前硕士核心 · MASTER CORE</span><h3>当前硕士核心</h3></div></div>
      <div class="exp-master-row">${master}</div>
      <div class="exp-arrow">↓ 博士扩展方向</div>
      <div class="section-heading"><div><span class="section-kicker">博士扩展方向 · PhD DIRECTIONS</span><h3>博士扩展方向（D1–D9）</h3></div></div>
      <div class="exp-cards">${dirs}</div>
      <p class="ws-disclaimer">方向属性为定性研究规划说明，不是预测。</p>`;
  },
});

// ===========================================================================
// VIEW: Workspace Dashboard (spec §78–§79) + rule-based Next Recommended Action
// ===========================================================================
registerView('dashboard', {
  title: '工作台总览',
  async render(body) {
    const papers = papersData?.papers || [];
    const scored = papers.map((p) => ({ p, r: scorePaper(p) })).filter((x) => x.r.score > 0)
      .sort((a, b) => b.r.score - a.r.score);
    const topCollisions = scored.slice(0, 5);
    const gaps = papersData?.landscape?.research_gaps || papersData?.landscape?.gaps || [];
    const topGaps = gaps.slice(0, 3);
    const decisions = decStore.list().slice(0, 3);
    const exps = expStore.list();
    const coreQs = researchNodes.filter((n) => n.role === 'core-question');

    // --- Rule-based Next Recommended Action (spec §79): first matching rule wins ---
    const meta = paperMetaStore();
    let nextAction = null;
    for (const x of scored) {
      if (x.r.score >= 86 && (meta[x.p.paper_id]?.verified || '') === '') {
        nextAction = { text: `极高风险撞题论文未核验（${x.r.score} 分）→ 阅读 ${x.p.title.slice(0, 60)}…`, ws: 'collision' }; break;
      }
    }
    if (!nextAction) {
      const expClaimIds = new Set(exps.map((e) => e.claimId));
      const noExp = researchClaims.find((c) => !expClaimIds.has(c.id));
      if (noExp) nextAction = { text: `研究主张未分配实验：${noExp.title} → 实验设计器`, ws: 'experiments' };
    }
    if (!nextAction) {
      const unverifiedProbe = (labDiscriminability['jam-vs-misalignment'] || {})['lateral-probe'] == null;
      if (unverifiedProbe) nextAction = { text: '部分假设对缺少判别性探测评分 → 失败假设实验室补充诊断动作', ws: 'failure-lab' };
    }
    if (!nextAction) {
      const risky = scored.find((x) => x.r.score > 80);
      if (risky) nextAction = { text: `撞题风险 > 80：${risky.p.title.slice(0, 60)}… → 重新审查创新性主张`, ws: 'red-team' };
    }
    if (!nextAction) nextAction = { text: '当前无高优先级告警 — 继续常规文献跟踪', ws: 'collision' };

    const gapCard = (g) => {
      const gid = g.gap_id || g.id || g.title_en || g.title_zh || 'gap';
      const statusKey = GAP_V2_STATUS[g.gap_status] || 'TENTATIVE';
      return `<div class="dash-item"><span class="ws-status-chip ${statusKey === 'STRONG' ? 'rec-keep' : statusKey === 'VIABLE' ? 'rec-narrow' : 'rec-merge'}">${esc(gapStatusLabels[statusKey] || statusKey)}</span> ${esc(g.title_zh || g.title || gid)}</div>`;
    };
    const decCard = (d) => `<div class="dash-item"><b>${esc(d.date || '')}</b> · ${esc(d.decision)}</div>`;
    const expCard = (e) => `<div class="dash-item"><b>${esc(e.id)}</b> ${esc(e.baseline)} vs ${esc(e.variable)} → ${esc(metricLabels[e.mainMetric] || e.mainMetric)}</div>`;

    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 研究工作台 · RESEARCH WORKSPACE</div>
        <h2>研究工作台总览</h2>
        <p>面向机器人操作与具身智能研究的个人研究决策工作台。用于管理研究主线、跟踪撞题论文、审查创新性、设计失败假设与主动诊断实验，并记录研究方向的演化过程。</p>
      </div>
      <div class="dash-next ws-note">
        <span class="section-kicker">下一步建议 · NEXT RECOMMENDED ACTION</span>
        <p>${esc(nextAction.text)} <button class="text-button" data-ws-go="${esc(nextAction.ws)}">${ui.goTo} →</button></p>
      </div>
      <div class="dash-grid">
        <section class="dash-panel"><h4>核心科学问题</h4>
          ${coreQs.map((n) => `<div class="dash-item">${esc(n.titleZh || n.title)} <small class="ws-muted">${esc(statusLabels[n.status] || '')}</small></div>`).join('')}</section>
        <section class="dash-panel"><h4>高风险撞题论文</h4>
          ${topCollisions.length ? topCollisions.map((x) => `<div class="dash-item"><span class="ws-score-mini">${x.r.score}</span> ${esc(x.p.title.slice(0, 70))}…</div>`).join('') : `<div class="dash-item ws-muted">${ui.noCollision}</div>`}</section>
        <section class="dash-panel"><h4>当前研究缺口</h4>
          ${topGaps.map(gapCard).join('') || `<div class="dash-item ws-muted">${ui.noData}</div>`}</section>
        <section class="dash-panel"><h4>当前实验</h4>
          ${exps.map(expCard).join('')}</section>
        <section class="dash-panel"><h4>最近研究决策</h4>
          ${decisions.map(decCard).join('') || `<div class="dash-item ws-muted">${ui.noData}</div>`}</section>
        <section class="dash-panel"><h4>前沿窗口提醒</h4>
          ${gaps.filter((g) => g.gap_status === 'dataset-limited').slice(0, 3).map((g) => `<div class="dash-item"><span class="ws-alert-chip alert-up">窗口收窄</span> ${esc(g.title_zh || g.title || '')}</div>`).join('') || `<div class="dash-item ws-muted">${ui.noData}</div>`}</section>
      </div>
      <p class="ws-disclaimer">提醒与下一步建议基于本地数据的规则化启发（论文数量、人工核验状态），不是 AI 判断（spec §72/§79）。</p>`;
    body.querySelectorAll('[data-ws-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        history.pushState({}, '', `${location.pathname}?view=workspace&ws=${btn.dataset.wsGo}`);
        render();
      });
    });
  },
});
const decStore = { list: () => lsGet('decisions', defaultDecisions), save: (x) => lsSet('decisions', x) };

registerView('decisions', {
  title: '研究决策日志',
  async render(body) {
    const decisions = decStore.list();
    const statusZh = (s) => (s === 'Accepted' ? '已采纳' : s === 'Rejected' ? '已否决' : s === 'Proposed' ? '待定' : (s || '待定'));
    const statusCls = (s) => (s === 'Accepted' ? 'chip-accepted' : s === 'Rejected' ? 'rec-remove' : 'chip-open');
    const cards = decisions.map((d) => `<article class="decision-card" data-decision-id="${esc(d.id)}">
      <header class="decision-head">
        <div>
          <span class="section-kicker">${esc(d.date || '')} · <span class="ws-status-chip ${statusCls(d.status)}">${esc(statusZh(d.status))}</span></span>
          <h4>${esc(d.decision)}</h4>
        </div>
        <div class="decision-confidence"><span>判断可信度</span><b>${d.confidence ?? '—'}/100</b></div>
      </header>
      <p class="decision-reason"><strong>决策依据：</strong>${esc(d.reason)}</p>
      ${d.keep ? `<p class="decision-keep"><strong>保留：</strong>${esc(d.keep)}</p>` : ''}
      ${d.useAs ? `<p class="decision-keep"><strong>当前定位：</strong>${esc(d.useAs)}</p>` : ''}
      ${d.previousState ? `<p class="ws-muted"><strong>状态变化：</strong>${esc(d.previousState)} → ${esc(d.newState)}</p>` : ''}
      ${(d.evidence || []).length ? `<ul class="decision-evidence">${d.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      <div class="decision-actions"><button class="text-button" data-action="append-decision" data-id="${esc(d.id)}">+ 追加说明</button></div>
    </article>`).join('');

    body.innerHTML = `
      <div class="ws-page-head">
        <div class="eyebrow"><span class="pulse"></span> 研究决策日志 · RESEARCH DECISION LOG</div>
        <h2>研究决策日志</h2>
        <p>记录研究方向为什么保留或放弃，保证长期可追溯。决策保存在浏览器 localStorage，可导出 Markdown 用于导师汇报。</p>
      </div>
      <div class="ws-toolbar">
        <button class="outline-button" id="decision-add" type="button">+ 添加研究决策</button>
        <button class="outline-button" id="decision-export" type="button">${ui.exportMarkdown}</button>
      </div>
      <div class="decision-list">${cards}</div>`;

    body.querySelector('#decision-export').addEventListener('click', () => {
      const lines = ['# 研究决策日志', ''];
      decisions.forEach((d) => {
        lines.push(`## ${d.date || ''} — ${d.decision}`, `- 状态：${statusZh(d.status)}（判断可信度 ${d.confidence ?? '—'}/100）`, `- 决策依据：${d.reason}`);
        if (d.keep) lines.push(`- 保留：${d.keep}`);
        if (d.useAs) lines.push(`- 当前定位：${d.useAs}`);
        if (d.previousState) lines.push(`- 状态变化：${d.previousState} → ${d.newState}`);
        (d.evidence || []).forEach((e) => lines.push(`- 支撑证据：${e}`));
        lines.push('');
      });
      exportMarkdown('decision-log.md', lines.join('\n'));
    });
    body.querySelector('#decision-add').addEventListener('click', () => {
      const title = prompt('研究决策（一句话）:');
      if (!title) return;
      const reason = prompt('决策依据（为什么）:') || '';
      const all = decStore.list();
      all.unshift({ id: `dec-${Date.now()}`, date: new Date().toISOString().slice(0, 10), decision: title, reason, evidence: [], papers: [], previousState: '', newState: '', confidence: 50, status: 'Proposed' });
      decStore.save(all); render();
    });
    body.querySelectorAll('[data-action="append-decision"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = prompt('追加说明:');
        if (!note) return;
        const all = decStore.list();
        const d = all.find((x) => x.id === btn.dataset.id);
        if (d) { d.evidence = [...(d.evidence || []), note]; decStore.save(all); render(); }
      });
    });
  },
});
