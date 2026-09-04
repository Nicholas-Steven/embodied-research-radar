const state = {data:null,papers:[],filtered:[],topic:'all',view:'home',query:'',year:'all',score:'all',codeOnly:false,dark:false};
const branchConfig={all:{eyebrow:'PERSONAL RESEARCH INTELLIGENCE',title:'今天，机器人学会了什么。',desc:'面向机器人操作与具身智能的个人科研论文雷达。聚焦视觉–力觉融合，持续追踪状态理解、失败恢复与可复现方法。',stat:'RADAR PAPERS'},'vision-force':{eyebrow:'VISION · FORCE · CONTACT',title:'机器人开始理解“接触”。',desc:'聚焦视觉、六维力/力矩、触觉与接触状态理解。',stat:'VISION-FORCE PAPERS'},'failure-understanding':{eyebrow:'MONITOR · VERIFY · DETECT',title:'机器人如何知道自己做错了？',desc:'聚焦任务进度、成功预测、异常检测与执行监控。',stat:'FAILURE-UNDERSTANDING PAPERS'},'failure-recovery':{eyebrow:'RECOVER · RETRY · REPLAN',title:'失败之后，机器人下一步怎么办？',desc:'聚焦失败恢复、重试、重规划与纠错策略。',stat:'RECOVERY PAPERS'},'vla-manipulation':{eyebrow:'LANGUAGE · VISION · ACTION',title:'从理解指令，到真正完成操作。',desc:'聚焦VLA、机器人操作、模仿学习与通用策略。',stat:'VLA PAPERS'},'generative-policy':{eyebrow:'DIFFUSION · FLOW · ACTION',title:'动作，是如何被生成出来的？',desc:'聚焦Diffusion、Flow Matching与生成式机器人策略。',stat:'GENERATIVE PAPERS'},core:{eyebrow:'CORE COLLECTION',title:'真正值得反复读的论文。',desc:'核心必读、综述、Benchmark、Baseline与值得复现的工作。',stat:'CORE PAPERS'},'research-map':{eyebrow:'PERCEIVE · UNDERSTAND · RECOVER',title:'从感知，到理解，再到恢复。',desc:'观察不同具身智能研究方向如何连接成完整机器人操作闭环。',stat:'MAP PAPERS'}};
const branchPapers=()=>state.view==='core'?state.papers.filter(p=>p.core_candidate==='Yes'):(state.topic==='all'?state.papers:state.papers.filter(p=>(p.research_branches||[]).includes(state.topic)||(p.research_topics||[]).includes(state.topic)));
const $ = (selector) => document.querySelector(selector);
const esc = (value='') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const uniq = (items) => [...new Set((items || []).filter(Boolean))];
const dateLabel = (value) => value ? value.slice(0,10).replaceAll('-','.') : '—';
const topicLabel = (id) => state.data?.topics?.find((item) => item.id === id)?.label_zh || state.data?.topics?.find((item) => item.id === id)?.label || id;
const scoreStars = (score) => { const count = Math.max(0, Math.min(5, Math.round(score / 20))); return '★'.repeat(count) + '☆'.repeat(5-count); };
const paperSearchText = (paper) => [paper.title,paper.authors?.join(' '),paper.abstract,paper.abstract_zh,paper.venue,paper.arxiv_id,paper.research_topics?.join(' '),paper.literature_categories?.join(' '),paper.methods?.join(' '),paper.tasks?.join(' '),paper.sensors?.join(' '),paper.keywords?.join(' ')].join(' ').toLowerCase();

async function init(){
  try{ const response = await fetch('assets/data.json', {cache:'no-store'}); if(!response.ok) throw new Error('data unavailable'); state.data = await response.json(); state.papers = state.data.papers || []; syncFromUrl(); populateFilters(); render(); bind(); }
  catch(error){ $('#app').innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>雷达数据暂时不可用</h3><p>请先运行 <code>python scripts/build_site.py</code> 生成静态数据。</p></div>`; console.error(error); }
}
function syncFromUrl(){ const params = new URLSearchParams(location.search); state.topic = params.get('topic') || 'all'; state.view = params.get('view') || (params.get('paper') ? 'detail' : 'home'); state.query = params.get('q') || ''; state.year = params.get('year') || 'all'; state.score = params.get('score') || 'all'; $('#search-input').value = state.query; $('#topic-filter').value = state.topic; $('#year-filter').value = state.year; $('#score-filter').value = state.score; }
function updateUrl(extra={}){ const params = new URLSearchParams(); const merged = {...extra}; if(merged.topic && merged.topic !== 'all') params.set('topic',merged.topic); if(merged.view && merged.view !== 'home') params.set('view',merged.view); if(merged.paper) params.set('paper',merged.paper); if(merged.q) params.set('q',merged.q); if(merged.year && merged.year !== 'all') params.set('year',merged.year); if(merged.score && merged.score !== 'all') params.set('score',merged.score); const url = `${location.pathname}${params.toString() ? `?${params}` : ''}`; history.pushState({},'',url); syncFromUrl(); render(); }
function populateFilters(){ const topics = uniq(state.papers.flatMap(p=>p.research_topics)).sort(); $('#topic-filter').innerHTML = `<option value="all">全部方向</option>` + topics.map(id=>`<option value="${esc(id)}">${esc(topicLabel(id))}</option>`).join(''); const years=uniq(state.papers.map(p=>p.year)).sort((a,b)=>b-a); $('#year-filter').innerHTML = '<option value="all">全部</option>' + years.map(year=>`<option value="${year}">${year}</option>`).join(''); }
function bind(){ $('#search-input').addEventListener('input',(event)=>{state.query=event.target.value.trim(); renderList();}); $('#topic-filter').addEventListener('change',(event)=>{state.topic=event.target.value; updateUrl({topic:state.topic,view:'home'});}); $('#year-filter').addEventListener('change',(event)=>{state.year=event.target.value; updateUrl({topic:state.topic,year:state.year,view:'home'});}); $('#score-filter').addEventListener('change',(event)=>{state.score=event.target.value; updateUrl({topic:state.topic,score:state.score,view:'home'});}); $('#code-filter').addEventListener('click',()=>{state.codeOnly=!state.codeOnly; $('#code-filter').setAttribute('aria-pressed',state.codeOnly); renderList();}); $('#reset-filter').addEventListener('click',clearFilters); $('#empty-reset').addEventListener('click',clearFilters); $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open')); $('#theme-toggle').addEventListener('click',toggleTheme); window.addEventListener('popstate',()=>{syncFromUrl();render();}); document.addEventListener('click',(event)=>{ const card=event.target.closest('[data-paper-id]'); if(card) openPaper(card.dataset.paperId); const action=event.target.closest('[data-action]'); if(action && action.dataset.action==='topic') updateUrl({topic:action.dataset.value,view:'home'}); const nav=event.target.closest('.nav-item'); if(nav){ event.preventDefault(); const url=new URL(nav.getAttribute('href'),location.href); const topic=url.searchParams.get('topic'); const view=url.searchParams.get('view'); if(view==='map'){updateUrl({view:'map'});} else if(view==='core'){updateUrl({view:'core',topic:'all'});} else if(view==='landscape'){updateUrl({view:'landscape',topic:'all'});} else if(topic){updateUrl({topic,view:'home'});} else {history.pushState({},'',location.pathname);state.topic='all';state.view='home';render();} $('#sidebar').classList.remove('open'); } }); }
function clearFilters(){ state.query='';state.topic='all';state.year='all';state.score='all';state.codeOnly=false; $('#search-input').value='';$('#code-filter').setAttribute('aria-pressed','false'); updateUrl({view:'home'}); }
function syncThemeUI(){ const btn=$('#theme-toggle'); if(btn) btn.innerHTML=state.dark?'◑ 浅色':'◐ 暗色'; const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute('content',state.dark?'#07121f':'#f6f8fa'); } function toggleTheme(){ state.dark=!state.dark; document.documentElement.classList.toggle('dark',state.dark); localStorage.setItem('radar-theme',state.dark?'dark':'light'); syncThemeUI(); }
function render(){ if(localStorage.getItem('radar-theme')==='dark'&&!state.dark){state.dark=true;document.documentElement.classList.add('dark');} syncThemeUI(); renderChrome(); if(state.view==='detail'){renderDetail(new URLSearchParams(location.search).get('paper'));return;} if(state.view==='map'){renderHome(true);$('#explore-section').classList.add('hidden');$('#map-section').classList.remove('hidden');$('#branch-section').classList.add('hidden');$('#landscape-section').classList.add('hidden');return;} if(state.view==='landscape'){renderLandscape();return;} renderHome(true); }
function renderChrome(){ document.querySelectorAll('[data-topic]').forEach(item=>item.classList.toggle('active',item.dataset.topic===state.topic)); document.querySelectorAll('[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view===state.view)); document.querySelector('[data-route="home"]')?.classList.toggle('active',state.view==='home'&&state.topic==='all'); const date=state.data.generated_at || '—'; $('#sidebar-date').textContent=dateLabel(date); $('#hero-date').textContent=dateLabel(date); $('#hero-count').textContent=state.data.retained_count ?? state.papers.length; $('#hero-threshold').textContent=`relevance ≥ ${state.data.relevance_threshold ?? '—'}`; $('[data-nav-count="all"]').textContent=state.papers.length; $('[data-nav-count="core"]').textContent=state.papers.filter(p=>p.core_candidate==='Yes').length; (state.data?.topics||[]).forEach(topic=>{ if(topic.id==='core-papers')return; const el=document.querySelector(`[data-nav-count="${topic.id}"]`); if(!el)return; const count=state.papers.filter(p=>(p.research_branches||[]).includes(topic.id)||(p.research_topics||[]).includes(topic.id)).length; if(count>0){ el.textContent=count; el.closest('.nav-item')?.classList.remove('muted-link'); } else { el.textContent=topic.status==='coming-soon'?'soon':'0'; } }); }
function renderHome(showRadar){ $('#hero-section').classList.toggle('hidden',!showRadar); $('#quick-stats').classList.toggle('hidden',!showRadar); $('#spotlight-grid').classList.toggle('hidden',!showRadar); $('#map-section').classList.add('hidden'); $('#branch-section').classList.add('hidden'); $('#landscape-section').classList.add('hidden'); const cfg=branchConfig[state.view==='map'?'research-map':(state.view==='core'?'core':(state.topic||'all'))]||branchConfig.all; const he=$('#hero-eyebrow'),ht=$('#hero-title'),hd=$('#hero-desc'),sl=$('#stat-label-1'); if(he)he.textContent=cfg.eyebrow; if(ht)ht.innerHTML=cfg.title; if(hd)hd.textContent=cfg.desc; if(sl)sl.textContent=cfg.stat; if(showRadar){ renderStats();renderSpotlight();renderInsight(); } const btn=document.querySelector('[data-action="topic"]'); if(btn) btn.dataset.value=state.topic==='all'?'vision-force':state.topic; $('#explore-section').classList.remove('hidden'); $('#list-title').textContent=state.view==='core'?'核心论文 · 收藏集':(state.topic==='all'?'最近加入雷达':`${topicLabel(state.topic)} · 最近加入`); renderList(); $('#breadcrumb-current').textContent=state.view==='core'?'CORE':(state.topic==='all'?'TODAY':String(state.topic).toUpperCase()); }
function renderStats(){ const ps=branchPapers(); $('#stat-papers').textContent=ps.length;$('#stat-high').textContent=ps.filter(p=>p.relevance_score>=80).length;$('#stat-code').textContent=ps.filter(p=>p.code_url).length;$('#stat-2026').textContent=ps.filter(p=>p.year===2026).length; }
let spStart=0,spAnimActive=false,spAnimId=0,spCommitted=0,spAccum=0,spPending=0,spIdleTimer=null,spLastDiscrete=0,spLastInput=0,spSmoothed=0,spCurDur=220;
const SP_DISCRETE_MIN=28,SP_TRACKPAD_THRESHOLD=32,SP_MAX_PENDING=2,SP_IDLE_RESET=100,SP_TAIL_WINDOW=30,SP_SLOW_INT=280,SP_FAST_INT=60,SP_SLOW_DUR=220,SP_FAST_DUR=115,SP_EMA_OLD=0.65,SP_MAX_DUR_CHANGE=35,SP_VELOCITY_IDLE=320;
function renderSpotlight(){ const ps=branchPapers(); const candidates=[...ps].filter(p=>p.relevance_score>=70).sort((a,b)=>b.relevance_score-a.relevance_score).slice(0,10); const list=$('#spotlight-list'); if(!list)return; const item=(p,i)=>`<article class="spotlight-item" data-paper-id="${esc(p.paper_id)}"><div class="spotlight-rank">${String(i+1).padStart(2,'0')}</div><div><div class="spotlight-title">${esc(p.title)}</div><div class="spotlight-meta"><span>${esc(p.venue)}</span><span>·</span><span>${dateLabel(p.published_date)}</span>${p.potential_competition?'<span class="competition-mini">Potential Competition</span>':''}</div></div><div class="score">${p.relevance_score} / 100</div></article>`; const track=()=>list.querySelector('.spotlight-track'); const draw=(rows)=>{list.innerHTML='<div class="spotlight-track">'+rows.join('')+'</div>';}; const n=candidates.length; const paint=(count)=>{ const rows=Array.from({length:Math.min(count||4,n)},(_,s)=>{ const idx=(spStart+s)%n; return item(candidates[idx],idx); }); draw(rows); const t=track(); if(t){t.style.transition='none';t.style.transform='translate3d(0,0,0)';} }; const addSteps=(d)=>{ const now=performance.now(); const interval=spLastInput? now-spLastInput : SP_SLOW_INT; spLastInput=now; if(interval>SP_VELOCITY_IDLE){ spSmoothed=SP_SLOW_INT; } else { spSmoothed=spSmoothed? spSmoothed*SP_EMA_OLD+interval*(1-SP_EMA_OLD) : interval; } const norm=Math.max(0,Math.min(1,(SP_SLOW_INT-spSmoothed)/(SP_SLOW_INT-SP_FAST_INT))); const desired=Math.round(SP_SLOW_DUR+(SP_FAST_DUR-SP_SLOW_DUR)*norm); const prev=spCurDur||SP_SLOW_DUR; let applied; if(interval>SP_VELOCITY_IDLE){ applied=SP_SLOW_DUR; } else { applied=desired<prev? Math.max(SP_FAST_DUR,prev-SP_MAX_DUR_CHANGE) : Math.min(SP_SLOW_DUR,prev+SP_MAX_DUR_CHANGE); } spCurDur=applied; console.log('STEP_INPUT',{interval:Math.round(interval),smoothed:Math.round(spSmoothed),desired,applied,pending:spPending}); if((spPending>0&&d<0)||(spPending<0&&d>0))spPending=0; spPending=Math.max(-SP_MAX_PENDING,Math.min(SP_MAX_PENDING,spPending+d)); pump(); }; const pump=()=>{ if(spAnimActive||spPending===0)return; const dir=spPending>0?1:-1; spPending-=dir; startAnim(dir); }; const startAnim=(dir)=>{ console.count('START_ANIMATION'); spAnimActive=true; const aid=++spAnimId; const step=92; const rows=Array.from({length:5},(_,s)=>{ const idx=(spStart+(dir>0?0:-1)+s+n)%n; return item(candidates[idx],idx); }); draw(rows); const t=track(); t.style.transition='none'; t.style.transform=dir>0?'translate3d(0,0,0)':`translate3d(0,-${step}px,0)`; void t.offsetWidth; t.style.transition=`transform ${spCurDur||SP_SLOW_DUR}ms cubic-bezier(.22,.61,.36,1)`; t.style.transform=dir>0?`translate3d(0,-${step}px,0)`:'translate3d(0,0,0)'; const finish=(ev)=>{ if(spCommitted===aid)return; if(ev&&(ev.target!==t||ev.propertyName!=='transform'))return; spCommitted=aid; console.count('COMMIT_INDEX'); spStart=(spStart+dir+n)%n; paint(4); spAnimActive=false; pump(); }; t.addEventListener('transitionend',finish); setTimeout(()=>finish(),(spCurDur||SP_SLOW_DUR)+30); }; if(!candidates.length){list.innerHTML='<div class="empty-state"><p>当前没有达到编辑推荐阈值的论文。</p></div>';return;} if(n<=4){spStart=0;paint(4);return;} spStart=0; paint(4); if(!list.dataset.wheel){ list.dataset.wheel='1'; list.addEventListener('wheel',function(e){ console.count('WHEEL_EVENT'); if(n<=4)return; e.preventDefault(); e.stopPropagation(); const d=e.deltaY, dm=e.deltaMode; const norm = dm===1? d*32 : dm===2? d*(window.innerHeight||800) : d; const now=performance.now(); console.log('RAW_WHEEL',{deltaY:d,deltaMode:dm,normalized:norm}); clearTimeout(spIdleTimer); spIdleTimer=setTimeout(()=>{spAccum=0;},SP_IDLE_RESET); if(Math.abs(norm)>=SP_DISCRETE_MIN){ spLastDiscrete=now; console.log('INPUT_CLASS','DISCRETE','EMITTED_STEP',1); addSteps(norm>0?1:-1); return; } if(now-spLastDiscrete<SP_TAIL_WINDOW&&Math.abs(norm)<8)return; spAccum+=norm; if((spAccum>0&&norm<0)||(spAccum<0&&norm>0))spAccum=norm; const abs=Math.abs(spAccum), steps=Math.trunc(abs/SP_TRACKPAD_THRESHOLD); if(steps===0)return; spAccum=spAccum>0?spAccum-steps*SP_TRACKPAD_THRESHOLD:spAccum+steps*SP_TRACKPAD_THRESHOLD; const sdir=spAccum>=0?1:-1; console.log('INPUT_CLASS','PRECISION','EMITTED_STEP',steps); addSteps(sdir*steps); },{passive:false}); } }
function renderInsight(){ const ps=branchPapers(); if(ps.length<4){$('#insight-title').textContent='样本仍在积累';$('#insight-body').textContent='近期样本不足，暂不生成趋势判断。';$('#trend-note').textContent='Insufficient Data';$('#trend-bars').innerHTML='';return;} const counts={};ps.forEach(p=>(p.research_topics||[]).forEach(t=>counts[t]=(counts[t]||0)+1)); const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]); const [top,count]=ranked[0]; $('#insight-title').textContent=state.topic==='all'?`${topicLabel(top)}正在成为近期高信号主线`:`${topicLabel(state.topic)}近期论文活跃度持续上升`; $('#insight-body').textContent=`当前收录样本中有${count}篇论文涉及${topicLabel(top)}方向。统计基于当前${state.topic==='all'?'全站':'分支'}数据，不等同于领域整体趋势。`; $('#trend-note').textContent=`${count} papers`; const months={}; ps.forEach(p=>{const m=String(p.published_date||'').slice(0,7); if(m&&/^\d{4}-\d{2}$/.test(m)) months[m]=(months[m]||0)+1;}); const mkeys=Object.keys(months).sort().slice(-5); const max=Math.max(...Object.values(months),1); $('#trend-bars').innerHTML=mkeys.map(m=>`<span class="trend-bar" style="height:${Math.max(10,Math.round(38*months[m]/max))}px" title="${esc(m)}"></span>`).join(''); }
function getFiltered(){ const q=state.query.toLowerCase(); return state.papers.filter(p=>{const topicOk=state.topic==='all'||(p.research_branches||[]).includes(state.topic)||(p.research_topics||[]).includes(state.topic);const qOk=!q||paperSearchText(p).includes(q);const yearOk=state.year==='all'||String(p.year)===String(state.year);const scoreOk=state.score==='all'||p.relevance_score>=Number(state.score);const codeOk=!state.codeOnly||Boolean(p.code_url);const coreOk=state.view!=='core'||p.core_candidate==='Yes';return topicOk&&qOk&&yearOk&&scoreOk&&codeOk&&coreOk;}).sort((a,b)=>b.published_date.localeCompare(a.published_date)||b.relevance_score-a.relevance_score);}
function renderList(){ const papers=getFiltered();state.filtered=papers;$('#result-count').textContent=`${papers.length} / ${state.papers.length} papers`; const grid=$('#paper-grid');const empty=$('#empty-state');empty.classList.toggle('hidden',papers.length>0);if(papers.length===0){grid.innerHTML='';renderActiveFilters();return;} const groups={};papers.forEach(p=>{const d=String(p.published_date||'').slice(0,10)||'未知日期';(groups[d]=groups[d]||[]).push(p);});const days=Object.keys(groups).sort((a,b)=>b.localeCompare(a));grid.innerHTML=days.map(day=>`<section class="date-group"><div class="date-group-header"><span class="date-group-title">${esc(day)}</span><div class="date-group-divider"></div><span class="date-group-count">${groups[day].length}篇</span></div><div class="date-paper-grid">${groups[day].map(renderCard).join('')}</div></section>`).join('');renderActiveFilters(); }
function renderCard(p){ const allTags=uniq([...(p.research_topics||[]).map(topicLabel),...(p.methods||[])]);const tags=allTags.slice(0,3);const extra=allTags.length>3?`<span class="tag">+${allTags.length-3}</span>`:'';const fig=p.image?`<div class="paper-figure"><img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.closest('.paper-figure').classList.add('paper-figure-empty');this.remove()"></div>`:`<div class="paper-figure paper-figure-empty">Embodied<br>Research<br>Radar</div>`;const action=(label,url,cls='')=>url?`<a class="card-btn ${cls}" href="${esc(url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${label}</a>`:'';return `<article class="paper-card" data-paper-id="${esc(p.paper_id)}">${fig}<div class="paper-card-top"><span class="paper-date">${dateLabel(p.published_date)} · ${esc(p.venue)}</span><span class="score-pill">${p.relevance_score} ${scoreStars(p.relevance_score)}</span></div><h3>${esc(p.title)}</h3><div class="paper-authors">${esc(p.authors?.slice(0,3).join(', '))}${p.authors?.length>3?' et al.':''}</div><p class="paper-summary">${esc(p.summary_one_sentence||p.abstract_zh||p.abstract||'Pending')}</p><div class="tag-row">${tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}${extra}</div><div class="card-actions">${action('详细分析')}${action('论文',p.paper_url)}${action('PDF',p.pdf_url)}${action('Code',p.code_url,'code')}</div></article>`; }
function renderActiveFilters(){const chips=[];if(state.topic!=='all')chips.push(`方向：${topicLabel(state.topic)}`);if(state.year!=='all')chips.push(`年份：${state.year}`);if(state.score!=='all')chips.push(`相关度：${state.score}+`);if(state.query)chips.push(`搜索：${state.query}`);if(state.codeOnly)chips.push('有代码');$('#active-filters').innerHTML=chips.map(c=>`<span class="filter-chip">${esc(c)}</span>`).join('');}
function openPaper(id){ history.pushState({},'',`${location.pathname}?paper=${encodeURIComponent(id)}`);state.view='detail';render();window.scrollTo({top:0,behavior:'smooth'}); }
function renderDetail(id){ $('#hero-section').classList.add('hidden');$('#quick-stats').classList.add('hidden');$('#spotlight-grid').classList.add('hidden');$('#explore-section').classList.remove('hidden');$('#map-section').classList.add('hidden');$('#branch-section').classList.add('hidden');const p=state.papers.find(item=>item.paper_id===id);$('#breadcrumb-current').textContent='PAPER DETAIL';if(!p){$('#paper-grid').innerHTML='<div class="empty-state"><h3>找不到这篇论文</h3><p>它可能已被去重或尚未生成站点数据。</p></div>';return;}$('#list-title').innerHTML=`<button class="text-button" id="back-button">← 返回雷达</button>`;$('#result-count').textContent=`${p.relevance_score} / 100 · ${scoreStars(p.relevance_score)}`;$('#back-button').onclick=()=>{history.pushState({},'',location.pathname);state.view='home';state.topic='all';render();};$('#paper-grid').innerHTML=readerMarkup(p);readerInit();$('#empty-state').classList.add('hidden'); }
function detailMarkup(p){const link=(label,url,cls='')=>url?`<a class="detail-link ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label} ↗</a>`:'';const section=(zh,en,content)=>`<section class="detail-section"><span class="section-kicker"><span class="kicker-zh">${zh}</span><span class="kicker-en">${en}</span></span><div class="detail-copy">${Array.isArray(content)&&content.length?`<ul>${content.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:`<p>${esc(content||'Pending')}</p>`}</div></section>`;return `<article class="paper-detail"><div class="detail-head"><div class="detail-head-copy"><div class="detail-label"><span class="score-pill">${p.relevance_score} / 100</span><span>${esc(p.venue)}</span><span>·</span><span>${dateLabel(p.published_date)}</span></div><h1>${esc(p.title)}</h1><p class="detail-authors">${esc(p.authors.join(', '))}</p><div class="detail-tags">${uniq([...(p.research_topics||[]).map(topicLabel),...(p.sensors||[]),...(p.methods||[])]).slice(0,9).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div><div class="detail-actions">${link('Paper',p.paper_url)}${link('PDF',p.pdf_url)}${link('Code',p.code_url,'code-link')}${link('Project',p.project_url)}</div></div><div class="detail-grid"><div class="detail-main">${section('一句话总结','ONE-LINE SUMMARY',p.summary_one_sentence)}${section('中文摘要','ABSTRACT (ZH)',p.abstract_zh)}${section('研究问题','RESEARCH PROBLEM',p.research_problem)}${section('核心贡献','CORE CONTRIBUTIONS',p.core_contributions)}${section('方法','METHOD',p.method_summary)}${section('实验设置','EXPERIMENTAL SETUP',p.experimental_setup)}${section('关键结果','KEY RESULTS',p.key_results)}${section('局限','LIMITATIONS',p.limitations)}</div><aside class="detail-side"><div class="side-card"><span class="section-kicker"><span class="kicker-zh">与我的研究</span><span class="kicker-en">MY RESEARCH</span></span><strong>${esc(p.related_to_my_research||'待人工确认')}</strong><p>${esc(p.why_it_matters)}</p><div class="side-divider"></div><span class="section-kicker"><span class="kicker-zh">推荐阅读</span><span class="kicker-en">RECOMMENDED READING</span></span><p>${esc(p.recommended_reading)}</p><div class="side-divider"></div><span class="section-kicker"><span class="kicker-zh">复现价值</span><span class="kicker-en">REPRODUCTION VALUE</span></span><strong class="value-${(p.reproduction_value||'').startsWith('High')?'high':(p.reproduction_value||'').startsWith('Low')?'low':'medium'}">${esc((p.reproduction_value||'').split('：')[0].split(':')[0])}</strong><p>${esc(p.reproduction_value)}</p></div>${p.potential_competition?`<div class="competition-card"><span class="section-kicker"><span class="kicker-zh">潜在竞争</span><span class="kicker-en">POTENTIAL COMPETITION</span></span><strong>需要重点核对</strong><p>${esc(p.competition_reason)}</p></div>`:''}<div class="fact-card"><span class="section-kicker"><span class="kicker-zh">事实核查</span><span class="kicker-en">FACT CHECK</span></span><p>Source: ${esc(p.source)}<br>arXiv ID: ${esc(p.arxiv_id||'—')}<br>Last checked: ${esc(p.last_checked)}</p><small>元数据字段来自来源页面；分析字段可能为AI或人工摘要。</small></div></aside></div></article>`;}
function renderBranch(id){const topic=state.data.topics.find(item=>item.id===id);$('#hero-section').classList.add('hidden');$('#quick-stats').classList.add('hidden');$('#spotlight-grid').classList.add('hidden');$('#explore-section').classList.add('hidden');$('#map-section').classList.add('hidden');$('#branch-section').classList.remove('hidden');$('#breadcrumb-current').textContent=(topic?.label||id).toUpperCase();$('#branch-title').textContent=topic?.label_zh||topic?.label||id;$('#branch-description').textContent=topic?.description||'未来研究分支';$('#branch-questions').innerHTML=(topic?.research_questions||[]).map(q=>`<div class="question">${esc(q)}</div>`).join('');}
function renderMap(){ $('#hero-section').classList.add('hidden');$('#quick-stats').classList.add('hidden');$('#spotlight-grid').classList.add('hidden');$('#explore-section').classList.add('hidden');$('#branch-section').classList.add('hidden');$('#map-section').classList.remove('hidden');$('#breadcrumb-current').textContent='RESEARCH MAP';$('#research-map').innerHTML=state.data.research_map.map((node,index)=>`<div class="map-node"><span class="map-step">0${index+1} / ${esc(node.topic)}</span><h3>${esc(node.label)}</h3><p>${esc(topicLabel(node.topic))}</p></div>`).join('');}
// Keep map rendering separate so the navigation can activate it without adding a second page.
const oldRender = render; render = function(){ if(state.view==='map'){renderChrome();renderMap();return;} oldRender(); };
init();
function readerMarkup(p){const link=(label,url,cls='')=>url?`<a class="detail-link ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label} ↗</a>`:'';const card=(id,zh,en,content)=>`<section class="reader-card" id="${id}"><span class="section-kicker"><span class="kicker-zh">${zh}</span><span class="kicker-en">${en}</span></span><div class="reader-copy">${Array.isArray(content)&&content.length?`<ul>${content.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:`<p>${esc(content||'Pending')}</p>`}</div></section>`;const branches=(p.research_branches||[]).map(b=>topicLabel(b)).filter(Boolean).join(' / ')||'待人工确认';const tags=uniq([...(p.research_topics||[]).map(topicLabel),...(p.methods||[]),...(p.tasks||[]),...(p.sensors||[])]).slice(0,10);return `<article class="reader"><header class="reader-header"><div class="reader-header-left"><span class="reader-kicker">论文阅读 / PAPER READER</span><h1>${esc(p.title)}</h1></div><div class="reader-header-actions">${link('原文',p.paper_url)}${link('PDF',p.pdf_url)}${link('Code',p.code_url,'code-link')}<button class="reader-close" id="reader-close" type="button" aria-label="关闭">×</button></div></header><div class="reader-layout"><div class="reader-main">${card('metadata','元信息','METADATA',`<div class="meta-grid"><div><strong>作者</strong>${esc(p.authors.join(', '))}</div><div><strong>Venue</strong>${esc(p.venue)} · ${dateLabel(p.published_date)}</div><div><strong>arXiv</strong>${esc(p.arxiv_id||'—')}</div>${p.doi?`<div><strong>DOI</strong>${esc(p.doi)}</div>`:''}${p.project_url?`<div><strong>项目</strong>${link('链接',p.project_url)}</div>`:''}</div>`)}${card('positioning','研究定位','RESEARCH POSITIONING',`<div class="pos-grid"><div class="pos-row"><span>相关度</span><strong class="pos-score">${p.relevance_score} ${scoreStars(p.relevance_score)}</strong></div><div class="pos-row"><span>Research Branch</span><strong>${esc(branches)}</strong></div></div><div class="detail-tags" style="margin:10px 0 4px">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><p><strong>一句话总结：</strong>${esc(p.summary_one_sentence)}</p><p><strong>研究问题：</strong>${esc(p.research_problem)}</p>`)}${card('overview','论文概述','PAPER OVERVIEW',p.abstract_zh||p.abstract)}${card('contributions','核心贡献','CORE CONTRIBUTIONS',p.core_contributions)}${card('method','方法描述','METHOD',p.method_summary)}${card('experiments','实验设置','EXPERIMENTAL SETUP',p.experimental_setup)}${card('results','评估与结果','KEY RESULTS',p.key_results)}${card('limitations','局限性','LIMITATIONS',p.limitations)}${card('my-research','与我的研究关系','MY RESEARCH',`<p><strong>${esc(p.related_to_my_research||'待人工确认')}</strong></p>${p.why_it_matters?`<p>${esc(p.why_it_matters)}</p>`:''}${p.potential_competition?`<p class="competition-note">⚠ 潜在竞争：${esc(p.competition_reason||'')}</p>`:''}`)}${card('reproduction','复现价值','REPRODUCTION VALUE',p.reproduction_value)}<section class="reader-card" id="fact"><span class="section-kicker"><span class="kicker-zh">事实核查</span><span class="kicker-en">FACT CHECK</span></span><div class="reader-copy"><p>Source: ${esc(p.source)} · arXiv ID: ${esc(p.arxiv_id||'—')} · Last checked: ${esc(p.last_checked)}</p></div></section></div><aside class="reader-toc"><span class="section-kicker">阅读目录</span><a href="#positioning">研究定位</a><a href="#overview">论文概述</a><a href="#contributions">核心贡献</a><a href="#method">方法描述</a><a href="#experiments">实验设置</a><a href="#results">评估与结果</a><a href="#limitations">局限性</a><a href="#my-research">与你的研究</a></aside></div></article>`;}
function readerInit(){const closeBtn=$('#reader-close');if(closeBtn)closeBtn.onclick=()=>{history.pushState({},'',location.pathname);state.view='home';state.topic='all';render();};document.querySelectorAll('.reader-toc a').forEach(a=>{a.addEventListener('click',(e)=>{e.preventDefault();const target=document.querySelector(a.getAttribute('href'));if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});});if('IntersectionObserver' in window){const links=[...document.querySelectorAll('.reader-toc a')];const map={};links.forEach(l=>map[l.getAttribute('href').slice(1)]=l);const io=new IntersectionObserver((entries)=>{entries.forEach(en=>{const l=map[en.target.id];if(l)l.classList.toggle('active',en.isIntersecting);});},{rootMargin:'-15% 0px -70% 0px'});document.querySelectorAll('.reader-card').forEach(s=>io.observe(s));}document.querySelectorAll('.reader-hero-figure img').forEach(img=>{img.style.cursor='zoom-in';img.addEventListener('click',()=>openLightbox(img.src));});}
function openLightbox(src){if(document.querySelector('.lightbox'))return;let scale=1;const box=document.createElement('div');box.className='lightbox';box.setAttribute('role','dialog');box.setAttribute('aria-label','图片放大查看');box.innerHTML=`<img class="lightbox-img" src="${esc(src)}" alt="论文图片放大查看"><button class="lightbox-close" type="button" aria-label="关闭">×</button>`;const img=box.querySelector('.lightbox-img');const MIN=0.5,MAX=8;box.addEventListener('wheel',(e)=>{e.preventDefault();const factor=e.deltaY<0?1.15:0.87;scale=Math.min(MAX,Math.max(MIN,scale*factor));const r=img.getBoundingClientRect();if(r.width&&r.height){img.style.transformOrigin=`${((e.clientX-r.left)/r.width)*100}% ${((e.clientY-r.top)/r.height)*100}%`;}img.style.transform=`scale(${scale})`;},{passive:false});box.addEventListener('click',(e)=>{if(e.target===box||e.target.classList.contains('lightbox-close'))closeLightbox();});document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){closeLightbox();document.removeEventListener('keydown',esc);}});document.body.appendChild(box);document.body.style.overflow='hidden';}
function closeLightbox(){const box=document.querySelector('.lightbox');if(box)box.remove();document.body.style.overflow='';}
readerMarkup = (p) => {
  const link=(label,url,cls='')=>url?`<a class="detail-link ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label} ↗</a>`:'';
  const PH=['pending','无法从摘要确认','未可靠提取','待人工确认','unknown','n/a',''];
  const clean=(v)=>{ if(Array.isArray(v)) return (v||[]).map(x=>String(x).trim()).filter(x=>x&&!PH.includes(String(x).toLowerCase().trim())); const s=String(v==null?'':v).trim(); return PH.includes(s.toLowerCase())?'':s; };
  const has=(v)=>Array.isArray(v)?clean(v).length>0:clean(v)!=='';
  const card=(id,zh,en,bodyHtml)=>`<section class="reader-card" id="${id}"><span class="section-kicker"><span class="kicker-zh">${zh}</span><span class="kicker-en">${en}</span></span><div class="reader-copy">${bodyHtml}</div></section>`;
  const text=(v)=>esc(clean(v));
  const splitPts=(v)=>{const s=clean(v);if(!s)return [];return s.split(/\n|；|。/).map(x=>x.trim()).filter(x=>x.length>=8).slice(0,6);};const bodyHtml=(v)=>{if(Array.isArray(v))return `<ul>${clean(v).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;const pts=splitPts(v);return pts.length>1?`<ul>${pts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>${text(v)}</p>`;};
  const branches=(p.research_branches||[]).map(b=>topicLabel(b)).filter(Boolean).join(' / ');
  const tags=uniq([...(p.research_branches||[]).map(topicLabel),...(p.research_topics||[]).map(topicLabel),...(p.methods||[]),...(p.tasks||[]),...(p.sensors||[])]).filter(Boolean).slice(0,12);
  const figure=p.image?`<div class="reader-hero-figure"><img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.closest('.reader-hero-figure').classList.add('empty');this.remove()"></div>`:`<div class="reader-hero-figure empty">Embodied Research Radar</div>`;
  const zhRaw=String(p.image_caption_zh||'').trim();const zhCap=(!zhRaw||/^(pending|无法从摘要确认|未可靠提取|待人工确认)$/i.test(zhRaw))?'':zhRaw.replace(/^(figure|fig\.?)\s*\d+[.:]?\s*/i,'').trim();const figureNote=p.image?`<div class="reader-figure-note">${esc(zhCap||'方法框架图预览')}</div>`:'';
  const hero=`<div class="reader-hero"><div class="reader-hero-left">${figure}${figureNote}</div><div class="reader-hero-right"><h1 class="reader-hero-title">${esc(p.title)}</h1><div class="reader-hero-meta"><span>${dateLabel(p.published_date)}</span><span>·</span><span>${esc(p.venue)}</span><span>·</span><span>arXiv ${esc(p.arxiv_id||'—')}</span>${p.doi?`<span>·</span><span>DOI ${esc(p.doi)}</span>`:''}</div><div class="reader-hero-links">${link('原文',p.paper_url)}${link('PDF',p.pdf_url)}${link('Code',p.code_url,'code-link')}${link('项目',p.project_url)}</div><p class="reader-hero-authors">${esc(p.authors.join(', '))}</p><div class="detail-tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="reader-hero-summary"><p><strong>一句话总结：</strong>${text(p.summary_one_sentence)}</p><p><strong>中文概述：</strong>${text(p.abstract_zh||p.abstract)}</p><p><strong>相关度：</strong><span class="pos-score">${p.relevance_score} ${scoreStars(p.relevance_score)}</span></p></div></div></div>`;
  const cards=[]; const toc=[];
  const add=(id,zh,en,content,extraHtml='')=>{ if(!has(content))return; cards.push(card(id,zh,en,bodyHtml(content)+extraHtml)); toc.push(`<a href="#${id}">${zh}</a>`); };
  add('positioning','研究定位','RESEARCH POSITIONING',`分支：${branches}${p.research_problem?' · 研究问题：'+p.research_problem:''}`,p.relevance_reason&&has(p.relevance_reason)?`<p><strong>相关性说明：</strong>${text(p.relevance_reason)}</p>`:'');
  add('overview','论文概述','PAPER OVERVIEW',p.abstract_zh||p.abstract);
  add('contributions','核心贡献','CORE CONTRIBUTIONS',p.core_contributions);
  add('method','方法描述','METHOD',p.method_summary);
  add('experiments','实验设置','EXPERIMENTAL SETUP',p.experimental_setup);
  add('results','评估与结果','KEY RESULTS',p.key_results);
  add('limitations','局限性','LIMITATIONS',p.limitations);
  add('my-research','与我的研究关系','MY RESEARCH',p.related_to_my_research,p.why_it_matters&&has(p.why_it_matters)?`<p>${text(p.why_it_matters)}</p>`:'');
  add('reproduction','复现价值','REPRODUCTION VALUE',p.reproduction_value);
  return `<article class="reader"><header class="reader-header"><div class="reader-header-left"><span class="reader-kicker">论文阅读 / PAPER READER</span><h1 class="reader-header-title">${esc(p.title)}</h1></div><div class="reader-header-actions">${link('原文',p.paper_url)}${link('PDF',p.pdf_url)}${link('Code',p.code_url,'code-link')}<button class="reader-close" id="reader-close" type="button" aria-label="关闭">×</button></div></header><div class="reader-layout"><div class="reader-main">${hero}${cards.join('')}</div><aside class="reader-toc"><span class="section-kicker">阅读目录</span>${toc.join('')||'<span class="toc-empty">—</span>'}</aside></div></article>`;
};

// ── Research Landscape ──────────────────────────────────────────────
function renderLandscape(){
  const ls = state.data?.landscape;
  // Hide home/explore sections
  $('#hero-section').classList.add('hidden');
  $('#quick-stats').classList.add('hidden');
  $('#spotlight-grid').classList.add('hidden');
  $('#explore-section').classList.add('hidden');
  $('#map-section').classList.add('hidden');
  $('#branch-section').classList.add('hidden');
  $('#landscape-section').classList.remove('hidden');
  $('#breadcrumb-current').textContent = 'LANDSCAPE';
  if(!ls){
    $('#ls-overview').innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><h3>Landscape 数据尚未生成</h3><p>请先运行 <code>python scripts/build_landscape.py</code> 再执行 <code>python scripts/build_site.py</code>。</p></div>';
    return;
  }
  // Header
  $('#ls-eyebrow').textContent = ls.topic || 'RESEARCH LANDSCAPE';
  $('#ls-date').textContent = dateLabel(ls.generated_at);
  $('#ls-desc').textContent = ls.topic_zh || ls.topic;
  $('#ls-disclaimer').textContent = ls.disclaimer || '';
  renderLandscapeStats(ls);
  renderLandscapePipeline(ls);
  renderLandscapeMaturity(ls);
  renderLandscapeGaps(ls);
  renderLandscapeDirections(ls);
  renderLandscapeMethodology(ls);
}

function renderLandscapeStats(ls){
  const s = ls.statistics || {};
  const tc = s.topic_counts || {};
  const ct = s.cross_topic_counts || {};
  const et = s.evidence_tiers || {};
  $('#ls-stats').innerHTML = [
    statCard('雷达论文总量', s.total_papers||0, 'RADAR TOTAL', 'accent-cyan'),
    statCard('分析样本', s.analysis_sample_size||0, 'ANALYSIS SAMPLE', 'accent-amber'),
    statCard('视觉力觉融合', tc['vision-force']||0, 'VISION-FORCE', 'accent-cyan'),
    statCard('失败理解', tc['failure-understanding']||0, 'FAILURE-UNDERSTANDING', 'accent-amber'),
    statCard('失败恢复', tc['failure-recovery']||0, 'FAILURE-RECOVERY', 'accent-rose'),
  ].join('');
  const cross = [
    {label:'视觉力觉 ∩ 失败理解', sub:'VF ∩ Failure-Understanding', value: ct['vision-force_and_failure-understanding']||0},
    {label:'视觉力觉 ∩ 失败恢复', sub:'VF ∩ Failure-Recovery', value: ct['vision-force_and_failure-recovery']||0},
    {label:'三方向交集', sub:'VF ∩ FU ∩ FR', value: ct['vision-force_and_failure-understanding_and_failure-recovery']||0},
  ];
  const tiers = [
    {label:'直接证据', sub:'Direct Evidence', value:et.direct||0, cls:'ls-tier-direct', desc:'论文内容中存在较直接的视觉/力觉与失败理解或失败恢复证据'},
    {label:'相关证据', sub:'Related Evidence', value:et.related||0, cls:'ls-tier-related', desc:'与失败问题和力觉/接触相关，但未满足直接证据标准'},
    {label:'背景证据', sub:'Background Evidence', value:et.background||0, cls:'ls-tier-bg', desc:'为视觉力觉融合、接触状态理解等提供背景支撑，但并非直接研究失败恢复'},
  ];
  $('#ls-cross-stats').innerHTML =
    '<p class="ls-overview-kicker">主题交叉 / Cross-topic Coverage</p>' +
    '<p class="ls-overview-note">统计同时被标记为多个研究 Topic 的论文数量</p>' +
    `<div class="ls-cross-row">${cross.map(c=>`<div class="ls-cross-item"><span class="ls-cross-label">${esc(c.label)}</span><span class="ls-cross-sub">${esc(c.sub)}</span><strong class="ls-cross-value">${c.value}</strong></div>`).join('')}</div>` +
    '<p class="ls-overview-kicker">证据层级 / Evidence Tiers</p>' +
    '<p class="ls-overview-note">依据论文内容、传感器及失败相关证据进一步分类</p>' +
    `<div class="ls-cross-row">${tiers.map(c=>`<div class="ls-cross-item"><span class="ls-cross-label">${esc(c.label)}</span><span class="ls-cross-sub">${esc(c.sub)}</span><strong class="ls-cross-value ${c.cls}">${c.value}</strong><p class="ls-cross-desc">${esc(c.desc)}</p></div>`).join('')}</div>` +
    '<p class="ls-overview-footnote">Topic 交集依据论文 Topic 标签统计；Evidence Tier 依据论文内容、传感器及失败相关证据进一步分类。两者统计口径不同，例如 VF ∩ Failure-Recovery = 0 而直接证据 > 0 并不矛盾。</p>';
}

function statCard(label,value,sub,accent){
  return `<div class="stat-card ${accent}"><span class="stat-label">${esc(label)}</span><strong>${value}</strong><small>${esc(sub)}</small></div>`;
}

function renderLandscapePipeline(ls){
  const flow = ls.pipeline || [];
  $('#ls-pipeline-flow').innerHTML = flow.map((s,i)=>{
    const pct = Math.min(100, Math.round((s.paper_count / Math.max(1,ls.statistics?.total_papers||1))*100));
    return `<div class="pipeline-stage${s.paper_count===0?' pipeline-empty':''}" data-stage="${esc(s.id)}" tabindex="0"><div class="pipeline-num">${String(i+1).padStart(2,'0')}</div><div class="pipeline-body"><div class="pipeline-label">${esc(s.label_zh)}</div><div class="pipeline-en">${esc(s.label)}</div><div class="pipeline-bar"><div class="pipeline-fill" style="width:${pct}%"></div></div><div class="pipeline-count">${s.paper_count} 篇</div><div class="pipeline-desc">${esc(s.description)}</div>${s.paper_count>0?`<button class="pipeline-expand" data-action="stage-papers" data-stage-id="${esc(s.id)}">查看论文 →</button>`:''}</div>${i<flow.length-1?'<div class="pipeline-arrow" data-action="stage-detail" data-stage-id="${esc(s.id)}" title="查看详情">→</div>':''}</div>`;
  }).join('');
  // Bind card click → open Stage Detail
  document.querySelectorAll('.pipeline-stage[data-stage]').forEach(card=>{
    if(card.classList.contains('pipeline-empty')) return;
    card.addEventListener('click',(e)=>{
      // Don't trigger if clicking 查看论文 button
      if(e.target.closest('[data-action="stage-papers"]')) return;
      const stageId = card.dataset.stage;
      const stage = flow.find(s=>s.id===stageId);
      if(stage) showStageDetail(stage, ls);
    });
  });
  // Bind 查看论文 buttons (stopPropagation to prevent card click)
  document.querySelectorAll('[data-action="stage-papers"]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      e.stopPropagation();
      const stageId = btn.dataset.stageId;
      const stage = flow.find(s=>s.id===stageId);
      if(!stage)return;
      showStagePapers(stage, ls);
    });
  });
  // Bind arrow clicks → open Stage Detail
  document.querySelectorAll('.pipeline-arrow[data-action="stage-detail"]').forEach(arrow=>{
    arrow.addEventListener('click',(e)=>{
      e.stopPropagation();
      const stageId = arrow.dataset.stageId;
      const stage = flow.find(s=>s.id===stageId);
      if(stage) showStageDetail(stage, ls);
    });
  });
}

function showStageDetail(stage, ls){
  const ids = new Set(stage.paper_ids||[]);
  const papers = state.papers.filter(p=>ids.has(p.paper_id));
  const maturity = ls.maturity?.find(m=>m.id===stage.id);
  const total = ls.statistics?.total_papers||1;
  const pct = Math.round((stage.paper_count/Math.max(1,total))*100);
  // Find prev/next stages
  const pipeline = ls.pipeline||[];
  const idx = pipeline.findIndex(s=>s.id===stage.id);
  const prev = idx>0?pipeline[idx-1]:null;
  const next = idx<pipeline.length-1?pipeline[idx+1]:null;
  const topPapers = papers.sort((a,b)=>(b.relevance_score||0)-(a.relevance_score||0)).slice(0,5);
  const overlay = document.createElement('div');
  overlay.className = 'ls-overlay';
  overlay.innerHTML = `<div class="ls-overlay-inner">
    <div class="ls-overlay-header"><h3>${String(idx+1).padStart(2,'0')} · ${esc(stage.label_zh)} · ${esc(stage.label)}</h3><button class="ls-overlay-close" type="button">×</button></div>
    <div class="stage-detail-body">
      <p class="ls-overlay-desc">${esc(stage.description)}</p>
      <div class="stage-detail-stats">
        <div class="stage-detail-stat"><span>论文数量</span><strong>${stage.paper_count} 篇 (${pct}%)</strong></div>
        ${maturity?`<div class="stage-detail-stat"><span>成熟度</span><strong>${esc(maturity.level)}</strong></div>`:''}
      </div>
      <div class="stage-detail-relation">
        ${prev?`<div class="stage-rel-item"><span>← 上一阶段</span><strong>${esc(prev.label_zh)}</strong></div>`:''}
        ${next?`<div class="stage-rel-item"><span>下一阶段 →</span><strong>${esc(next.label_zh)}</strong></div>`:''}
      </div>
      ${topPapers.length?`<div class="stage-detail-papers"><span class="section-kicker">代表论文 / REPRESENTATIVE PAPERS</span>${topPapers.map(p=>`<div class="gap-paper-mini" data-paper-id="${esc(p.paper_id)}"><span class="score-pill">${p.relevance_score}</span><span>${esc(p.title)}</span></div>`).join('')}</div>`:''}
      ${papers.length>5?`<button class="outline-button" data-action="stage-papers-from-detail" data-stage-id="${esc(stage.id)}">查看全部 ${papers.length} 篇论文</button>`:''}
    </div>
  </div>`;
  overlay.querySelector('.ls-overlay-close').onclick = ()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelectorAll('.gap-paper-mini[data-paper-id]').forEach(el=>{
    el.style.cursor='pointer';
    el.addEventListener('click',()=>{overlay.remove();openPaper(el.dataset.paperId);});
  });
  const allBtn = overlay.querySelector('[data-action="stage-papers-from-detail"]');
  if(allBtn) allBtn.addEventListener('click',()=>{overlay.remove();showStagePapers(stage,ls);});
  document.body.appendChild(overlay);
}

function showStagePapers(stage, ls){
  const ids = new Set(stage.paper_ids||[]);
  const papers = state.papers.filter(p=>ids.has(p.paper_id));
  const overlay = document.createElement('div');
  overlay.className = 'ls-overlay';
  overlay.innerHTML = `<div class="ls-overlay-inner"><div class="ls-overlay-header"><h3>${esc(stage.label_zh)} · ${esc(stage.label)}</h3><button class="ls-overlay-close" type="button">×</button></div><p class="ls-overlay-desc">${esc(stage.description)}</p><div class="ls-overlay-grid">${papers.map(p=>renderCard(p)).join('')}</div></div>`;
  overlay.querySelector('.ls-overlay-close').onclick = ()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelectorAll('[data-paper-id]').forEach(el=>{
    el.addEventListener('click',()=>{overlay.remove();openPaper(el.dataset.paperId);});
  });
  document.body.appendChild(overlay);
}

function renderLandscapeMaturity(ls){
  const maturity = ls.maturity || [];
  const levelClass = {'Emerging':'maturity-emerging','Developing':'maturity-developing','Moderate':'maturity-moderate','Relatively Mature':'maturity-mature'};
  $('#ls-maturity-grid').innerHTML = maturity.map(m=>{
    const cls = levelClass[m.level]||'maturity-emerging';
    return `<div class="maturity-cell ${cls}"><div class="maturity-label">${esc(m.label)}</div><div class="maturity-en">${esc(m.label_en)}</div><div class="maturity-level">${esc(m.level)}</div><div class="maturity-count">${m.paper_count} 篇</div></div>`;
  }).join('');
}

function renderLandscapeGaps(ls){
  const gaps = ls.gaps || [];
  if(gaps.length===0){
    $('#ls-gap-list').innerHTML = '<div class="empty-state"><p>当前数据中未识别到足够的 Research Gap。</p></div>';
    return;
  }
  const majorGaps = gaps.filter(g => (g.gap_status||g.group) !== 'dataset-limited');
  const minorGaps = gaps.filter(g => (g.gap_status||g.group) === 'dataset-limited');
  function renderGapCards(gapList){
    return gapList.map(g=>{
    const confClass = {'high':'gap-conf-high','medium':'gap-conf-medium','low':'gap-conf-low','insufficient':'gap-conf-insufficient','dataset-limited':'gap-conf-low'}[g.confidence]||'gap-conf-low';
    const typeBadge = {'fact':'gap-type-fact','evidence-based-inference':'gap-type-inference','open-hypothesis':'gap-type-hypothesis','dataset-limited':'gap-type-dataset'}[g.claim_type]||'gap-type-inference';
    const confLabel = {'high':'较高 · High','medium':'中等 · Medium','low':'较低 · Low','insufficient':'不足 · Insufficient','dataset-limited':'数据不足 · Dataset-limited'}[g.confidence]||g.confidence;
    const typeLabel = {'fact':'事实 · Fact','evidence-based-inference':'证据推断 · Evidence-based','open-hypothesis':'开放假设 · Open hypothesis','dataset-limited':'数据不足 · Dataset-limited'}[g.claim_type]||g.claim_type;
    const gapStatus = g.gap_status || g.group || 'evidence-supported';
    const supPapers = (g.supporting_paper_ids||[]).map(pid=>state.papers.find(p=>p.paper_id===pid)).filter(Boolean);
    const cntPapers = (g.counter_paper_ids||[]).map(pid=>state.papers.find(p=>p.paper_id===pid)).filter(Boolean);
    const extInfo = ls.external_evidence?.[g.id];
    const isPA = gapStatus === 'partially-addressed';
    return `<div class="gap-card" data-gap-id="${esc(g.id)}" data-gap-group="${esc(gapStatus)}">
      <div class="gap-header">
        <h3 class="gap-title-zh">${esc(g.title_zh)}</h3>
        <span class="gap-en">${esc(g.title)}</span>
        <div class="gap-badges">${isPA?'<span class="gap-badge gap-type-pa">已有进展 · PA</span>':''}<span class="gap-badge ${confClass}">${esc(confLabel)}</span></div>
      </div>
      <p class="gap-question">${esc(g.question)}</p>
      <div class="gap-expanded hidden">
      ${isPA && g.what_has_been_addressed ? `<div class="gap-section gap-pa-addressed"><span class="section-kicker"><span class="kicker-zh">已有进展</span><span class="kicker-en">WHAT HAS BEEN ADDRESSED</span></span><p>${esc(g.what_has_been_addressed)}</p></div>` : ''}
      ${isPA && g.what_remains_open ? `<div class="gap-section gap-pa-open"><span class="section-kicker"><span class="kicker-zh">仍然开放的问题</span><span class="kicker-en">WHAT REMAINS OPEN</span></span><p>${esc(g.what_remains_open)}</p></div>` : ''}
      <div class="gap-section"><span class="section-kicker"><span class="kicker-zh">当前进展</span><span class="kicker-en">CURRENT PROGRESS</span></span><p>${esc(g.current_progress)}</p></div>
        <div class="gap-section"><span class="section-kicker"><span class="kicker-zh">缺失环节</span><span class="kicker-en">MISSING PIECE</span></span><p>${esc(g.missing_piece)}</p></div>
        <div class="gap-section"><span class="section-kicker"><span class="kicker-zh">为什么重要</span><span class="kicker-en">WHY IT MATTERS</span></span><p>${esc(g.why_it_matters)}</p></div>
        <div class="gap-evidence">
          <div class="gap-evidence-col"><span class="section-kicker">SUPPORTING EVIDENCE (${supPapers.length})</span>${supPapers.length?supPapers.map(p=>`<div class="gap-paper-mini" data-paper-id="${esc(p.paper_id)}"><span class="score-pill">${p.relevance_score}</span><span>${esc(p.title)}</span></div>`).join(''):'<p class="gap-empty">当前 Radar 中未找到直接支持论文</p>'}</div>
          <div class="gap-evidence-col"><span class="section-kicker">COUNTER EVIDENCE (${cntPapers.length})</span>${cntPapers.length?cntPapers.map(p=>`<div class="gap-paper-mini" data-paper-id="${esc(p.paper_id)}"><span class="score-pill">${p.relevance_score}</span><span>${esc(p.title)}</span></div>`).join(''):'<p class="gap-empty">当前 Radar 中未找到直接反例</p>'}</div>
        </div>
        <div class="gap-section"><span class="section-kicker"><span class="kicker-zh">研究机会</span><span class="kicker-en">RESEARCH OPPORTUNITY</span></span><p>${esc(g.research_opportunity)}</p></div>
        <div class="gap-section gap-external">
          <span class="section-kicker"><span class="kicker-zh">外部证据</span><span class="kicker-en">EXTERNAL EVIDENCE</span></span>
          ${extInfo ? `<div class="gap-ext-stats">
            <span>检索结果: <strong>${extInfo.unique_after_dedup||0}</strong></span>
            <span>支持缺口: <strong class="ls-tier-direct">${extInfo.supporting_count||0}</strong> <small>SUPPORTING</small></span>
            <span>已有解决: <strong class="ls-tier-related">${extInfo.counter_count||0}</strong> <small>COUNTER</small></span>
            <span>来源: OpenAlex ${extInfo.sources?.openalex||0} · S2 ${extInfo.sources?.semantic_scholar||0} · arXiv ${extInfo.sources?.arxiv||0}</span>
          </div>
          ${extInfo.evidence_stale ? '<div class="gap-ext-stale"><span>⚠ 问题已更新，证据需要重新检索 / Evidence refresh required after claim update</span></div>' : '<div class="gap-ext-aligned"><span>✓ 证据与当前问题一致 / Evidence aligned with current claim</span></div>'}
          <div class="gap-ext-note"><span>支持缺口：说明该问题仍存在或只解决了一部分。</span><span>已有解决/反例：表示已有论文部分或直接解决该问题，会降低 Gap 判断置信度。</span></div>
          <div class="gap-ext-freshness">${extInfo.searched_at?`<span>最近检索 / Last searched: <strong>${esc(extInfo.searched_at)}</strong></span>`:''}</div>` : '<p class="gap-ext-na">尚未检索 / Not searched</p>'}
          <button class="gap-refresh-btn" data-action="refresh-evidence" data-gap-id="${esc(g.id)}" type="button">更新文献证据 <small>Refresh Evidence</small></button>
          <span class="gap-refresh-hint">需要本地运行检索 / Local refresh required</span>
          <div class="gap-scheduled-status"><span class="gap-scheduled-label">自动证据更新 / Scheduled Refresh</span><span class="gap-scheduled-state">尚未启用 / Not enabled yet</span><span class="gap-scheduled-note">发布并启用 GitHub Actions 后，Radar 将每周自动更新文献证据。</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
  }
  const majorHtml = renderGapCards(majorGaps);
  const minorHtml = renderGapCards(minorGaps);
  let output = '';
  if(majorGaps.length > 0){
    output += `<div class="gap-section-group"><div class="section-heading"><div><span class="section-kicker">MAJOR RESEARCH QUESTIONS</span><h3>主要研究问题</h3></div><span class="result-count">${majorGaps.length} 个</span></div><p class="gap-section-desc">基于当前证据，值得优先关注的问题</p><div class="gap-cards">${majorHtml}</div></div>`;
  }
  if(minorGaps.length > 0){
    output += `<div class="gap-section-group"><div class="section-heading"><div><span class="section-kicker">NEEDS MORE EVIDENCE</span><h3>待验证问题</h3></div><span class="result-count">${minorGaps.length} 个</span></div><p class="gap-section-desc">当前证据覆盖不足，暂不宜作为强结论</p><div class="gap-cards">${minorHtml}</div></div>`;
  }
  $('#ls-gap-list').innerHTML = output;
  // Bind whole-card click → toggle expanded
  document.querySelectorAll('.gap-card[data-gap-id]').forEach(card=>{
    card.addEventListener('click',(e)=>{
      // Don't toggle if clicking a button or interactive element inside
      if(e.target.closest('[data-action="refresh-evidence"]')) return;
      if(e.target.closest('.gap-refresh-btn')) return;
      if(e.target.closest('.gap-paper-mini')) return;
      if(e.target.closest('[data-action]')) return;
      if(e.target.closest('a[href]')) return;
      if(e.target.closest('.ls-overlay')) return;
      const expanded = card.querySelector('.gap-expanded');
      if(expanded){
        expanded.classList.toggle('hidden');
        card.classList.toggle('gap-expanded-active', !expanded.classList.contains('hidden'));
      }
    });
  });
  // Bind paper clicks
  document.querySelectorAll('.gap-paper-mini[data-paper-id]').forEach(el=>{
    el.style.cursor='pointer';
    el.addEventListener('click',(e)=>{
      e.stopPropagation();
      openPaper(el.dataset.paperId);
    });
  });
  // Bind gap group filters
  document.querySelectorAll('[data-gap-filter]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-gap-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.gapFilter;
      document.querySelectorAll('.gap-card[data-gap-group]').forEach(card=>{
        if(filter==='all'){card.style.display='';}
        else{card.style.display=card.dataset.gapGroup===filter?'':'none';}
      });
    });
  });
  // Bind refresh evidence buttons
  document.querySelectorAll('[data-action="refresh-evidence"]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      e.stopPropagation();
      const gapId = btn.dataset.gapId;
      const extInfo = ls.external_evidence?.[gapId];
      openRefreshPanel(gapId, extInfo);
    });
  });
}

function openRefreshPanel(gapId, extInfo){
  if(document.querySelector('.refresh-panel-overlay')) return;
  const gap = (state.data?.landscape?.gaps||[]).find(g=>g.id===gapId);
  const gapTitle = gap ? gap.title_zh + ' / ' + gap.title : gapId;
  const cmd = `python scripts/search_gap_evidence.py --gap ${gapId} --refresh`;
  const searchedAt = extInfo?.searched_at || '';
  const sources = extInfo?.sources || {};
  const overlay = document.createElement('div');
  overlay.className = 'refresh-panel-overlay';
  overlay.innerHTML = `<div class="refresh-panel">
    <div class="refresh-panel-header"><h3>更新文献证据 / Refresh Evidence</h3><button class="refresh-panel-close" type="button">×</button></div>
    <div class="refresh-panel-body">
      <div class="refresh-field"><span>Gap</span><strong>${esc(gapTitle)}</strong></div>
      ${searchedAt?`<div class="refresh-field"><span>最近检索 / Last searched</span><strong>${esc(searchedAt)}</strong></div>`:'<div class="refresh-field"><span>状态 / Status</span><strong>尚未检索 / Not searched</strong></div>'}
      <div class="refresh-field"><span>已搜索数据源 / Sources</span><strong>OpenAlex ${sources.openalex||0} · Semantic Scholar ${sources.semantic_scholar||0} · arXiv ${sources.arxiv||0}</strong></div>
      <div class="refresh-cmd-block">
        <span class="refresh-cmd-label">本地刷新命令 / Local refresh command</span>
        <code class="refresh-cmd">${esc(cmd)}</code>
        <button class="refresh-copy-btn" data-action="copy-cmd" type="button">复制刷新命令 / Copy Refresh Command</button>
      </div>
      <div class="refresh-steps">
        <p><strong>步骤 1</strong> — 复制并在项目目录中运行上方命令。</p>
        <p><strong>步骤 2</strong> — 外部证据检索完成后运行：<code>python scripts/build_site.py</code></p>
        <p><strong>步骤 3</strong> — 刷新当前网页查看最新证据。</p>
      </div>
    </div>
  </div>`;
  overlay.querySelector('.refresh-panel-close').onclick = ()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelector('[data-action="copy-cmd"]').addEventListener('click',(e)=>{
    navigator.clipboard.writeText(cmd).then(()=>{
      e.target.textContent = '已复制 / Copied';
      setTimeout(()=>{e.target.textContent = '复制刷新命令 / Copy Refresh Command';},2000);
    }).catch(()=>{});
  });
  document.body.appendChild(overlay);
}

function renderLandscapeDirections(ls){
  const dirs = ls.directions || [];
  $('#ls-direction-list').innerHTML = dirs.map(d=>{
    return `<div class="direction-card">
      <h3>${esc(d.title_zh)}</h3><span class="direction-en">${esc(d.title)}</span>
      <p class="direction-question">${esc(d.research_question)}</p>
      <div class="direction-grid">
        <div class="direction-field"><span>为什么值得研究</span><p>${esc(d.why_worthworth||d.why_worthwhile||'')}</p></div>
        <div class="direction-field"><span>当前状态</span><p>${esc(d.current_state)}</p></div>
        <div class="direction-field"><span>缺失环节</span><p>${esc(d.missing)}</p></div>
        <div class="direction-field"><span>潜在实验方式</span><p>${esc(d.potential_experiment)}</p></div>
      </div>
      <div class="direction-meta"><span class="gap-badge gap-type-hypothesis">${esc(d.type)}</span><span class="direction-evidence">证据充分度: ${esc(d.evidence_strength)}</span></div>
    </div>`;
  }).join('');
}

function renderLandscapeMethodology(ls){
  $('#ls-methodology-body').innerHTML = `
    <div class="methodology-content">
      <h4>证据分类规则</h4>
      <div class="methodology-tiers">
        <div class="tier-card tier-direct"><strong>Direct Evidence</strong><p>论文同时被标记为 vision-force topic 和 failure-understanding/recovery topic，且文本中包含力觉/触觉/接触信号。</p></div>
        <div class="tier-card tier-related"><strong>Related Evidence</strong><p>论文属于 failure-understanding/recovery topic，且包含力觉/接触信号，但未被标记为 vision-force topic。</p></div>
        <div class="tier-card tier-background"><strong>Background Evidence</strong><p>论文属于 vision-force topic，且包含失败检测/恢复相关信号，但未被标记为 failure topic。</p></div>
      </div>
      <h4>成熟度定义</h4>
      <div class="methodology-maturity-def">
        <span class="maturity-tag maturity-emerging">Emerging</span> ≤2 篇论文
        <span class="maturity-tag maturity-developing">Developing</span> 3–5 篇
        <span class="maturity-tag maturity-moderate">Moderate</span> 6–12 篇
        <span class="maturity-tag maturity-mature">Relatively Mature</span> &gt;12 篇
      </div>
      <h4>研究缺口声明类型</h4>
      <ul>
        <li><strong>FACT</strong> — 论文 metadata 或 abstract 明确支持</li>
        <li><strong>EVIDENCE-BASED INFERENCE</strong> — 多篇论文归纳所得</li>
        <li><strong>OPEN HYPOTHESIS</strong> — 值得进一步验证</li>
      </ul>
      <h4>免责声明</h4>
      <p>${esc(ls.disclaimer||'当前分析基于 Embodied Research Radar 已收录论文及其标题、摘要、结构化字段和辅助分析，不等同于系统综述或 Meta-analysis。')}</p>
    </div>`;
}
