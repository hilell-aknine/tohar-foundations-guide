/* ============================================================
   מודל היסודות השיווקיים — המנוע
   מסע שלבים · שמירת מצב · אבחון · המורה
   ============================================================ */
(function () {
'use strict';

/* ══════════════ CONFIG ══════════════ */
const CFG = {
  // הפרויקט הייעודי של טוהר. מפתח anon הוא ציבורי מעצם הגדרתו —
  // כל הכתיבה עוברת דרך Edge Functions עם RLS deny-all.
  SUPABASE_URL: 'https://llhgjyskcuedommznwqg.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaGdqeXNrY3VlZG9tbXpud3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTIxMzIsImV4cCI6MjEwMTgyODEzMn0.tmQSZwhsZFF3ssCGhUbU5RhP4fPv1KPhNeuEmztg9Mk',
  WA_TOHAR: '972547471300',
  STORE: 'tohar-foundations-v2'
};

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ══════════════ STEP MODEL ══════════════ */
const STEPS = [{ type:'welcome' }, { type:'intro' }];
GUIDE.foundations.forEach((f, i) => {
  STEPS.push({ type:'idea',  f:i });
  STEPS.push({ type:'story', f:i });
  STEPS.push({ type:'work',  f:i });
});
STEPS.push({ type:'recap' }, { type:'diagnostic' }, { type:'closing' });

const LAST = STEPS.length - 1;

/* ══════════════ STATE ══════════════ */
let state = { answers:{}, scores:[null,null,null,null,null], step:0, sid:null };
let cur = 0;

function newSid(){
  try { return crypto.randomUUID(); }
  catch(e){ return 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10); }
}
function load(){
  try{
    const raw = localStorage.getItem(CFG.STORE);
    if (raw){
      const d = JSON.parse(raw);
      if (d && typeof d === 'object'){
        state.answers = d.answers || {};
        if (Array.isArray(d.scores) && d.scores.length === 5) state.scores = d.scores;
        if (Number.isInteger(d.step)) state.step = Math.min(Math.max(d.step, 0), LAST);
        state.sid = d.sid || null;
      }
    }
  }catch(e){}
  if (!state.sid) state.sid = newSid();
}
let saveT;
function save(){
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    state.step = cur;
    try { localStorage.setItem(CFG.STORE, JSON.stringify(state)); } catch(e){}
    syncUp();
  }, 400);
}

/* ══════════════ TOAST ══════════════ */
const toastEl = $('#toast'); let toastT;
function toast(msg){
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600);
}

/* ══════════════ RENDER HELPERS ══════════════ */
const BRAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0-1 5.8V16a3 3 0 0 0 3 3h.5a1.5 1.5 0 0 0 1.5-1.5V3z"/><path d="M12 3a4 4 0 0 1 4 4v1a3 3 0 0 1 1 5.8V16a3 3 0 0 1-3 3h-.5a1.5 1.5 0 0 1-1.5-1.5V3z"/></svg>`;
const PEN   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

const paras  = arr => (arr || []).map(t => `<p>${t}</p>`).join('');
const beats  = arr => arr && arr.length ? `<ul class="beats">${arr.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
const pull   = t => t ? `<div class="pull">${t}</div>` : '';
const psych  = (body, tag) => `<div class="psych"><div class="psych__tag">${BRAIN}${esc(tag || 'למה זה חשוב מבחינה פסיכולוגית')}</div>${paras(body)}</div>`;

function voiceBlock(st){
  return `<div class="voice">
    <div class="voice__head">
      <img src="assets/tohar-avatar.jpg" alt="טוהר אקנין">
      <div><div class="voice__name">${esc(st.title)}</div><div class="voice__role">טוהר · תהליכי שיווק</div></div>
    </div>
    ${paras(st.body)}
    ${st.said ? `<span class="said">${esc(st.said)}</span>` : ''}
    ${paras(st.body2)}
  </div>`;
}

function crumb(n, label){ return `<div class="crumb"><i>${n}</i><span>${esc(label)}</span></div>`; }

/* ══════════════ STEP RENDERERS ══════════════ */
function renderStep(s, idx){
  const f = s.f != null ? GUIDE.foundations[s.f] : null;

  switch (s.type){
    case 'welcome':
      return `<div class="welcome">
        <div class="welcome__logo"><img src="assets/logo.png" alt="טוהר אקנין · תהליכי שיווק" width="420" height="420"></div>
        <div class="welcome__eyebrow">מסע אינטראקטיבי</div>
        <h1>מודל<em>היסודות השיווקיים</em></h1>
        <div class="rule"></div>
        <p class="welcome__sub">${esc(GUIDE.meta.subtitle)}</p>
        <div class="welcome__portrait"><img src="assets/tohar.jpg" alt="טוהר אקנין" width="720" height="900"></div>
        <p class="welcome__meta">מאת <b>${esc(GUIDE.meta.author)}</b><br>${esc(GUIDE.meta.tagline)}</p>
        <div class="facts">
          <div class="fact"><b>5</b><span>יסודות</span></div>
          <div class="fact"><b>27</b><span>שאלות עבודה</span></div>
          <div class="fact"><b>מורה</b><span>לאורך הדרך</span></div>
        </div>
        <p class="welcome__note">התשובות שלך נשמרות אצלך. אפשר לעצור באמצע ולחזור מתי שתרצי.</p>
      </div>`;

    case 'intro': {
      const g = GUIDE.intro;
      return `${crumb('0','הקדמה')}
        <h2>${esc(g.title)}</h2>
        <p class="lede">${esc(g.lede)}</p>
        <div class="copy">${paras(g.copy)}</div>
        ${pull(g.pull)}
        <div class="copy">${paras(g.copy2)}</div>
        ${beats(g.beats)}
        <div class="copy">${paras(g.copy3)}</div>
        ${psych(g.psych, g.psychTag)}`;
    }

    case 'idea':
      return `${crumb(f.n, `יסוד ${f.n} · הרעיון`)}
        <h2>${esc(f.name)}</h2>
        <p class="lede">${esc(f.lede)}</p>
        <div class="copy">${paras(f.copy)}</div>
        ${beats(f.beats)}
        <div class="copy">${paras(f.copy2)}</div>
        ${pull(f.pull)}
        ${psych(f.psych)}`;

    case 'story':
      return `${crumb(f.n, `יסוד ${f.n} · הדוגמה של טוהר`)}
        <h2>איך זה נראה אצלי</h2>
        <p class="lede">${esc(f.question)}</p>
        ${(f.stories || []).map(voiceBlock).join('')}
        <div class="copy">${paras(f.copy3)}</div>`;

    case 'work': {
      const qs = f.questions.map((q, i) => `
        <div class="q">
          <label for="q${s.f}_${i}"><b>${i + 1}</b>${esc(q)}</label>
          <textarea id="q${s.f}_${i}" data-k="f${f.n}q${i + 1}" placeholder="כתבי כאן..."></textarea>
        </div>`).join('');
      return `${crumb(f.n, `יסוד ${f.n} · העבודה שלך`)}
        <h2>${esc(f.short)}</h2>
        <p class="lede">${esc(f.question)}</p>
        <div class="work">
          <div class="work__title">${PEN}שאלות עבודה</div>
          <p class="work__hint">${esc(f.workHint)}</p>
          ${qs}
          <div class="score">
            <div class="score__q">${esc(f.scoreQ)}</div>
            <div class="score__row">
              <input type="range" min="1" max="10" value="5" data-score="${s.f}" aria-label="${esc(f.scoreQ)}">
              <div class="score__val"><span data-out="${s.f}">5</span><small>/10</small></div>
            </div>
            <div class="score__scale"><span>${esc(f.scaleLow)}</span><span>${esc(f.scaleHigh)}</span></div>
          </div>
        </div>
        <div class="sumline">${f.summary}</div>`;
    }

    case 'recap':
      return `${crumb('✓','חיבור')}
        <h2>עכשיו בואי נחבר הכול</h2>
        <p class="lede">חמישה יסודות. וכשכולם ברורים, הרבה החלטות שיווקיות הופכות לפשוטות יותר.</p>
        <div class="pillars">
          ${GUIDE.foundations.map(x => `<div class="pillar"><i>${x.n}</i><div><b>${esc(x.short)}</b><span>${esc(x.question)}</span></div></div>`).join('')}
        </div>`;

    case 'diagnostic':
      return `<h2>האבחון שלך</h2>
        <p class="lede">לפי הציונים שנתת לעצמך לאורך המסע. זה המקום שבו כדאי להתחיל.</p>
        <div class="chart" id="chart"></div>
        <div class="verdict" id="verdict"></div>
        <div class="actions">
          <button class="btn btn--primary btn--block" id="btnPrint">שמירת המדריך שלי כ־PDF</button>
          <a class="btn btn--wa btn--block" id="btnWa" href="#" target="_blank" rel="noopener">לשלוח את התוצאה לטוהר</a>
          <button class="btn btn--ghost btn--block" id="btnReset">להתחיל מחדש</button>
        </div>
        <div class="saved">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          <span>התשובות שלך נשמרות אוטומטית</span>
        </div>`;

    case 'closing': {
      const g = GUIDE.closing;
      return `<div class="closing">
        <h2>${esc(g.title)}</h2>
        <div class="copy">${paras(g.copy)}</div>
        ${pull(g.pull)}
        <div class="copy">${paras(g.copy2)}</div>
        <div class="closing__logo"><img src="assets/logo.png" alt="טוהר אקנין" width="420" height="420"></div>
        <a class="btn btn--wa btn--block" href="https://wa.me/${CFG.WA_TOHAR}" target="_blank" rel="noopener" style="margin-top:18px">דברי איתי בוואטסאפ</a>
      </div>`;
    }
  }
  return '';
}

/* ══════════════ BOOT DOM ══════════════ */
function build(){
  $('#stage').innerHTML = STEPS
    .map((s, i) => `<section class="step" data-i="${i}" data-type="${s.type}">${renderStep(s, i)}</section>`)
    .join('');
  wireAnswers();
  wireScores();
}

function wireAnswers(){
  $$('textarea[data-k]').forEach(ta => {
    const k = ta.dataset.k;
    if (state.answers[k]) ta.value = state.answers[k];
    autosize(ta); markFilled(ta);
    ta.addEventListener('input', () => {
      state.answers[k] = ta.value;
      autosize(ta); markFilled(ta); save();
    });
  });
}
function autosize(ta){ ta.style.height = 'auto'; ta.style.height = Math.max(72, ta.scrollHeight) + 'px'; }
function markFilled(ta){ ta.classList.toggle('filled', ta.value.trim().length > 0); }

function wireScores(){
  $$('input[data-score]').forEach(r => {
    const i = +r.dataset.score;
    if (state.scores[i] != null) r.value = state.scores[i];
    paintRange(r);
    $(`[data-out="${i}"]`).textContent = r.value;
    r.addEventListener('input', () => {
      state.scores[i] = +r.value;
      $(`[data-out="${i}"]`).textContent = r.value;
      paintRange(r); save(); renderDiagnostic();
    });
  });
}
function paintRange(r){ r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'); }

/* ══════════════ NAVIGATION ══════════════ */
function go(i, opts){
  opts = opts || {};
  i = Math.min(Math.max(i, 0), LAST);
  const prev = cur;
  cur = i;

  $$('.step').forEach(el => el.classList.toggle('on', +el.dataset.i === i));

  const s = STEPS[i];
  const f = s.f != null ? GUIDE.foundations[s.f] : null;

  // header
  let where = '';
  if (s.type === 'welcome')      where = 'ברוכה הבאה';
  else if (s.type === 'intro')   where = 'הקדמה';
  else if (f)                    where = `יסוד <b>${f.n}</b> מתוך 5 · <b>${esc(f.short)}</b>`;
  else if (s.type === 'recap')   where = 'חיבור';
  else if (s.type === 'diagnostic') where = 'האבחון שלך';
  else                           where = 'לסיום';
  $('#where').innerHTML = where;
  $('#count').textContent = (i + 1) + ' / ' + STEPS.length;
  $('#fill').style.width = (i / LAST) * 100 + '%';

  // nav buttons
  $('#back').disabled = i === 0;
  const next = $('#next');
  if (i === LAST){ next.disabled = true; next.textContent = 'סיימת 🤍'; }
  else {
    next.disabled = false;
    next.textContent = i === 0 ? 'בואי נתחיל'
                     : (STEPS[i + 1].type === 'diagnostic' ? 'לאבחון שלי' : 'הבא');
  }

  // teacher context refresh
  refreshSuggestions();

  // היסטוריה: כל שלב הוא כניסה משלו, כדי שכפתור "אחורה" של הדפדפן
  // יחזיר אותה שלב אחד ולא יזרוק אותה מהמדריך.
  if (opts.push)       history.pushState({ i }, '', '#' + i);
  else if (!opts.keep) history.replaceState({ i }, '', '#' + i);

  if (!opts.silent) window.scrollTo({ top:0, behavior: prev === i ? 'auto' : 'smooth' });
  if (s.type === 'diagnostic') renderDiagnostic();
  save();
}

/** ניווט שיזמה המשתמשת — נכנס להיסטוריה */
function nav(i){
  i = Math.min(Math.max(i, 0), LAST);
  if (i === cur) return;
  go(i, { push:true });
}
function hashIndex(){
  const n = parseInt((location.hash || '').replace('#',''), 10);
  return Number.isInteger(n) && n >= 0 && n <= LAST ? n : null;
}

/* ══════════════ DIAGNOSTIC ══════════════ */
function renderDiagnostic(){
  const chart = $('#chart'), verdict = $('#verdict');
  if (!chart || !verdict) return;
  const answered = state.scores.filter(x => x != null).length;

  chart.innerHTML = GUIDE.foundations.map((f, i) => {
    const sc = state.scores[i];
    const pct = sc == null ? 0 : (sc / 10) * 100;
    return `<div class="bar" data-i="${i}">
      <div class="bar__top">
        <span class="bar__name">${esc(f.short)}</span>
        <span class="bar__score">${sc == null ? 'טרם דורג' : sc + ' / 10'}</span>
      </div>
      <div class="bar__track"><div class="bar__fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  if (answered < 5){
    verdict.className = 'verdict empty';
    verdict.innerHTML = `<div class="verdict__tag">עוד רגע</div>
      <div class="verdict__name">דרגי את כל חמשת היסודות</div>
      <div class="verdict__body">דירגת ${answered} מתוך 5. ברגע שתדרגי את כולם, נראה כאן בדיוק מאיפה כדאי לך להתחיל.</div>`;
    return;
  }

  // הנמוך ביותר מנצח. תיקו → היסוד המוקדם, כי המודל נבנה מלמטה למעלה.
  const min = Math.min(...state.scores);
  const idx = state.scores.indexOf(min);
  const f = GUIDE.foundations[idx];
  const avg = (state.scores.reduce((a, b) => a + b, 0) / 5).toFixed(1);

  $$('.bar', chart).forEach(b => b.classList.toggle('weakest', +b.dataset.i === idx));

  verdict.className = 'verdict';
  verdict.innerHTML = `<div class="verdict__tag">היסוד להתחיל ממנו</div>
    <div class="verdict__name">${esc(f.short)}</div>
    <div class="verdict__body">${esc(f.rx)}<br><br><strong>ממוצע היסודות שלך: <bdi>${avg} / 10</bdi></strong></div>`;
}

function buildWa(){
  const answered = state.scores.filter(x => x != null).length;
  const L = ['היי טוהר, סיימתי את מודל היסודות השיווקיים.', ''];
  if (answered === 5){
    const min = Math.min(...state.scores), idx = state.scores.indexOf(min);
    const avg = (state.scores.reduce((a, b) => a + b, 0) / 5).toFixed(1);
    L.push('הציונים שלי:');
    GUIDE.foundations.forEach((f, i) => L.push('• ' + f.short + ': ' + state.scores[i] + '/10'));
    L.push('', 'ממוצע: ' + avg + '/10', 'היסוד הכי חלש שלי: ' + GUIDE.foundations[idx].short);
  } else {
    L.push('עוד לא דירגתי את כל היסודות, אבל אשמח לדבר.');
  }
  L.push('', 'אשמח לשמוע איך ממשיכים מכאן.');
  return 'https://wa.me/' + CFG.WA_TOHAR + '?text=' + encodeURIComponent(L.join('\n'));
}

/* ══════════════ TEACHER ══════════════ */
const T = { history:[], busy:false, greeted:false, offline:false };

function stepContext(){
  const s = STEPS[cur];
  const f = s.f != null ? GUIDE.foundations[s.f] : null;
  const ctx = { stepType:s.type, stepIndex:cur, totalSteps:STEPS.length };
  if (f){
    ctx.foundation = { n:f.n, name:f.name, question:f.question, summary:stripTags(f.summary) };
    if (s.type === 'idea')  ctx.material = [f.lede, ...(f.copy||[]), ...(f.beats||[]), ...(f.psych||[])].map(stripTags).join(' ');
    if (s.type === 'story') ctx.material = (f.stories||[]).map(st => [...(st.body||[]), st.said||'', ...(st.body2||[])].join(' ')).map(stripTags).join(' ');
    if (s.type === 'work'){
      ctx.material = f.questions.join(' | ');
      ctx.herAnswers = f.questions.map((q, i) => ({
        question: q,
        answer: (state.answers['f' + f.n + 'q' + (i + 1)] || '').trim()
      })).filter(a => a.answer);
      if (state.scores[s.f] != null) ctx.herScore = state.scores[s.f];
    }
  }
  if (s.type === 'diagnostic' || s.type === 'closing'){
    ctx.allScores = GUIDE.foundations.map((f2, i) => ({ name:f2.short, score:state.scores[i] }));
  }
  return ctx;
}
function stripTags(s){ return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function addMsg(role, html){
  const d = document.createElement('div');
  d.className = 'msg msg--' + (role === 'user' ? 'u' : 't');
  d.innerHTML = html;
  $('#tlog').appendChild(d);
  $('#tlog').scrollTop = $('#tlog').scrollHeight;
  return d;
}
function fmt(txt){
  return esc(txt)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function refreshSuggestions(){
  const s = STEPS[cur];
  const key = TEACHER_PROMPTS[s.type] ? s.type : 'other';
  const list = TEACHER_PROMPTS[key];
  const box = $('#tsug');
  if (!box) return;
  box.innerHTML = list.map(p => `<button type="button">${esc(p)}</button>`).join('');
}

function openTeacher(){
  $('#tsheet').classList.add('on');
  if (!T.greeted){
    T.greeted = true;
    const s = STEPS[cur];
    const f = s.f != null ? GUIDE.foundations[s.f] : null;
    const hello = f
      ? `היי. אני כאן איתך ביסוד <strong>${esc(f.short)}</strong>. אפשר לשאול אותי כל דבר על מה שקראת, או לבקש שאעזור לך לנסח תשובה.`
      : `היי. אני כאן איתך לאורך המסע. אפשר לשאול אותי כל דבר על החומר, או לבקש שאעזור לך לחשוב.`;
    addMsg('t', `<p>${hello}</p>`);
  }
  setTimeout(() => $('#tinput').focus(), 320);
}
function closeTeacher(){ $('#tsheet').classList.remove('on'); }

async function ask(question){
  if (T.busy || !question.trim()) return;
  T.busy = true;
  $('#tsend').disabled = true;
  addMsg('user', `<p>${esc(question)}</p>`);
  T.history.push({ role:'user', content:question });

  const typing = addMsg('t', `<div class="dots3"><i></i><i></i><i></i></div>`);

  try{
    const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/teacher', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + CFG.SUPABASE_ANON },
      body: JSON.stringify({
        sid: state.sid,
        question,
        context: stepContext(),
        history: T.history.slice(-8)
      })
    });

    if (!res.ok){
      const t = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 140));
    }
    const data = await res.json();
    const reply = (data && (data.reply || data.text)) || '';
    if (!reply) throw new Error('empty');
    typing.innerHTML = fmt(reply);
    T.history.push({ role:'assistant', content:reply });
    $('#tnote').textContent = '';
  }catch(err){
    typing.innerHTML = `<p>אני עוד לא מחוברת כאן. בינתיים אפשר להמשיך בשאלות העבודה — כל מה שאת כותבת נשמר.</p>`;
    $('#tnote').textContent = 'המורה תופעל בקרוב';
    T.offline = true;
    T.history.pop();
  }finally{
    T.busy = false;
    $('#tsend').disabled = false;
    $('#tlog').scrollTop = $('#tlog').scrollHeight;
  }
}

/* ══════════════ CLOUD SYNC (best-effort, never blocks) ══════════════ */
let syncT;
function syncUp(){
  clearTimeout(syncT);
  syncT = setTimeout(() => {
    const payload = {
      sid: state.sid,
      step: cur,
      scores: state.scores,
      answers: state.answers
    };
    fetch(CFG.SUPABASE_URL + '/functions/v1/guide-progress', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + CFG.SUPABASE_ANON },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {}); // המדריך עובד מצוין גם בלי הענן
  }, 2500);
}

/* ══════════════ WIRING ══════════════ */
load();
build();

// resume where she left off — כתובת מפורשת גוברת על השלב השמור
const start = hashIndex();
go(start != null ? start : (state.step || 0), { silent:true });

// כפתור "אחורה" של הדפדפן, וגם שינוי ידני של הכתובת
window.addEventListener('popstate', e => {
  const i = (e.state && Number.isInteger(e.state.i)) ? e.state.i : hashIndex();
  if (i != null && i !== cur) go(i, { keep:true });
});
window.addEventListener('hashchange', () => {
  const i = hashIndex();
  if (i != null && i !== cur) go(i, { keep:true });
});

$('#next').addEventListener('click', () => nav(cur + 1));
$('#back').addEventListener('click', () => nav(cur - 1));
$('#teach').addEventListener('click', openTeacher);
$('#tclose').addEventListener('click', closeTeacher);
$('#tsheet').addEventListener('click', e => { if (e.target.id === 'tsheet') closeTeacher(); });

$('#tsug').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) ask(b.textContent);
});
$('#tform').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#tinput').value;
  $('#tinput').value = ''; $('#tinput').style.height = 'auto';
  ask(v);
});
$('#tinput').addEventListener('input', e => {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px';
});
$('#tinput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('#tform').requestSubmit(); }
});

// keyboard: RTL — left arrow advances, right arrow goes back
document.addEventListener('keydown', e => {
  if ($('#tsheet').classList.contains('on')){
    if (e.key === 'Escape') closeTeacher();
    return;
  }
  if (e.target.matches('textarea, input')) return;
  if (e.key === 'ArrowLeft')  nav(cur + 1);
  if (e.key === 'ArrowRight') nav(cur - 1);
});

// swipe
let tx = 0, ty = 0;
document.addEventListener('touchstart', e => {
  if ($('#tsheet').classList.contains('on')) return;
  tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
}, { passive:true });
document.addEventListener('touchend', e => {
  if ($('#tsheet').classList.contains('on')) return;
  if (e.target.closest('textarea, input, .tsheet')) return;
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return;
  nav(cur + (dx > 0 ? 1 : -1)); // RTL: swipe right = forward
}, { passive:true });

// diagnostic actions (delegated — the step is rendered at boot)
document.addEventListener('click', e => {
  if (e.target.closest('#btnPrint')){
    $$('textarea[data-k]').forEach(autosize);
    setTimeout(() => window.print(), 120);
  }
  if (e.target.closest('#btnWa')) e.target.closest('#btnWa').href = buildWa();
  if (e.target.closest('#btnReset')){
    if (!confirm('למחוק את כל התשובות והציונים ולהתחיל מחדש?')) return;
    try { localStorage.removeItem(CFG.STORE); } catch(err){}
    state = { answers:{}, scores:[null,null,null,null,null], step:0, sid:newSid() };
    $$('textarea[data-k]').forEach(ta => { ta.value=''; autosize(ta); markFilled(ta); });
    $$('input[data-score]').forEach(r => {
      r.value = 5; paintRange(r);
      $(`[data-out="${r.dataset.score}"]`).textContent = '5';
    });
    renderDiagnostic();
    nav(0);
    toast('הכול נוקה. אפשר להתחיל מחדש.');
  }
});

// gentle first-write confirmation
let told = false;
document.addEventListener('input', e => {
  if (told) return;
  if (e.target.matches('textarea[data-k]') && e.target.value.trim().length > 2){
    told = true; toast('נשמר. אפשר לחזור לכאן מתי שתרצי.');
  }
}, true);

window.addEventListener('resize', () => $$('textarea[data-k]').forEach(autosize));
})();
