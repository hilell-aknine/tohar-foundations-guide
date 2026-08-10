/* ============================================================
   מודל היסודות השיווקיים — המנוע
   מסע שלבים · שמירת מצב · דוח אישי · המלווה
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

// ב-Vercel המורה רצה כפונקציית שרת מקומית (/api/teacher) ואין צורך בסופרבייס.
// ב-GitHub Pages אין צד שרת, ולכן נופלים ל-Edge Function.
const ON_PAGES = /github\.io$/.test(location.hostname);
CFG.TEACHER_URL = ON_PAGES ? CFG.SUPABASE_URL + '/functions/v1/teacher' : '/api/teacher';

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
STEPS.push({ type:'recap' }, { type:'quickcheck' }, { type:'diagnostic' }, { type:'contact' }, { type:'closing' });

const LAST = STEPS.length - 1;

/* ══════════════ STATE ══════════════ */
let state = { answers:{}, scores:[null,null,null,null,null], quick:{}, name:'', step:0, sid:null };
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
        state.quick = d.quick || {};
        state.name = typeof d.name === 'string' ? d.name : '';
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
        <div class="welcome__portrait"><img src="assets/tohar-desk.jpg" alt="טוהר אקנין" width="880" height="1100"></div>
        <p class="welcome__meta">מאת <b>${esc(GUIDE.meta.author)}</b><br>${esc(GUIDE.meta.tagline)}</p>
        <div class="facts">
          <div class="fact"><b>5</b><span>יסודות</span></div>
          <div class="fact"><b>27</b><span>שאלות עבודה</span></div>
          <div class="fact"><b>דוח</b><span>אישי בסוף</span></div>
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
          <div class="q__print" aria-hidden="true"></div>
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
              <div class="score__val"><span data-out="${s.f}">—</span><small>/10</small></div>
            </div>
            <div class="score__scale"><span>${esc(f.scaleLow)}</span><span>${esc(f.scaleHigh)}</span></div>
            <div class="score__hint" data-hint="${s.f}">גררי את העיגול כדי לדרג</div>
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

    case 'quickcheck':
      return `${crumb('?','אבחון קצר')}
        <h2>עוד שלוש שאלות</h2>
        <p class="lede">נגיעה אחת בכל שאלה. הן מחדדות את ההמלצה שתקבלי בעמוד הבא.</p>
        ${QUICKCHECK.map(q => `
          <div class="qc" data-k="${q.k}">
            <div class="qc__q">${esc(q.q)}</div>
            <div class="qc__opts">
              ${q.opts.map(o => `<button type="button" class="qc__opt" data-v="${o.v}">
                <b>${esc(o.t)}</b><span>${esc(o.hint)}</span>
              </button>`).join('')}
            </div>
          </div>`).join('')}
        <p class="qc__note">אפשר גם לדלג. האבחון יעבוד גם בלי זה, פשוט פחות מדויק.</p>`;

    case 'diagnostic':
      return `<div class="rep__id">
          <img class="rep__logo" src="assets/logo.png" alt="" width="420" height="420">
          <div>
            <h2>${esc(REPORT.title)}</h2>
            <p class="rep__for" id="repFor"></p>
          </div>
        </div>
        <p class="lede">${esc(REPORT.lede)}</p>
        <div class="namefld" data-noprint>
          <label for="repName">${esc(REPORT.namePrompt)}</label>
          <input id="repName" type="text" autocomplete="name" placeholder="${esc(REPORT.namePlaceholder)}">
        </div>
        <div id="report"></div>
        <div class="actions" data-noprint>
          <button class="btn btn--primary btn--block" id="btnPrintReport">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
            לשמור את הדוח שלי כ־PDF
          </button>
          <a class="btn btn--wa btn--block" id="btnMeet" href="#" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.5-.4M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/></svg>
            לקבוע שיחה עם טוהר
          </a>
          <button class="btn btn--ghost btn--block" id="btnPrint">לשמור את כל המדריך עם התשובות</button>
          <button class="btn btn--ghost btn--block" id="btnReset">להתחיל מחדש</button>
        </div>
        <div class="saved" data-noprint>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          <span>התשובות שלך נשמרות אוטומטית</span>
        </div>`;

    case 'contact':
      return `${crumb('★','הצעד הבא')}
        <h2>שיחת אבחון עם טוהר</h2>
        <p class="lede">שלושים דקות, בלי עלות ובלי התחייבות. נעבור על התמונה שיצאה לך ותצאי עם צעד ברור לשבוע הקרוב.</p>
        <div class="lead" id="leadBox">
          <div class="lead__why" id="leadWhy"></div>
          <form id="leadForm" novalidate>
            <div class="fld">
              <label for="lName">איך קוראים לך?</label>
              <input id="lName" name="name" type="text" autocomplete="name" placeholder="השם שלך" required>
              <div class="fld__err" id="lErrName"></div>
            </div>
            <div class="fld">
              <label for="lPhone">לאיזה טלפון לחזור?</label>
              <input id="lPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05X-XXXXXXX" required>
              <div class="fld__err" id="lErr"></div>
            </div>
            <button type="submit" class="btn btn--primary btn--block" id="lSend">אשמח שטוהר תחזור אליי</button>
          </form>
          <p class="lead__note">הפרטים נשלחים לטוהר בלבד. בלי דיוור, בלי שיתוף.</p>
          <div class="lead__or"><span>או</span></div>
          <a class="btn btn--wa btn--block" id="btnMeet2" href="#" target="_blank" rel="noopener">לכתוב לטוהר בוואטסאפ עכשיו</a>
        </div>`;

    case 'closing': {
      const g = GUIDE.closing;
      return `<div class="closing">
        <h2>${esc(g.title)}</h2>
        <div class="copy">${paras(g.copy)}</div>
        ${pull(g.pull)}
        <div class="copy">${paras(g.copy2)}</div>
        <div class="closing__logo"><img src="assets/logo.png" alt="טוהר אקנין" width="420" height="420"></div>
        <a class="btn btn--wa btn--block" id="btnMeet3" href="#" target="_blank" rel="noopener" style="margin-top:18px">דברי איתי בוואטסאפ</a>
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
  wireQuick();
  const nm = $('#repName');
  if (nm) nm.value = state.name || '';
}

/** הדפסת הדוח בלבד. הדפדפן הוא מנוע ה-PDF — html2canvas מדביק מילים בעברית. */
function printReport(){
  document.body.classList.add('print-report');
  setTimeout(() => window.print(), 80);
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-report'));

function wireQuick(){
  $$('.qc').forEach(box => {
    const k = box.dataset.k;
    $$('.qc__opt', box).forEach(btn => {
      btn.classList.toggle('on', state.quick[k] === btn.dataset.v);
      btn.addEventListener('click', () => {
        // נגיעה שנייה על אותה בחירה מבטלת אותה
        state.quick[k] = state.quick[k] === btn.dataset.v ? null : btn.dataset.v;
        $$('.qc__opt', box).forEach(b => b.classList.toggle('on', state.quick[k] === b.dataset.v));
        save(); renderReport();
      });
    });
  });
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
function markFilled(ta){
  const v = ta.value.trim();
  ta.classList.toggle('filled', v.length > 0);
  // גרסת ההדפסה: טקסט זורם במקום תיבה
  const pr = ta.nextElementSibling;
  if (pr && pr.classList.contains('q__print')){
    pr.textContent = v;
    pr.classList.toggle('empty', v.length === 0);
  }
}

function wireScores(){
  $$('input[data-score]').forEach(r => {
    const i = +r.dataset.score;
    if (state.scores[i] != null) r.value = state.scores[i];
    paintScore(r, i);
    const commit = () => {
      state.scores[i] = +r.value;
      paintScore(r, i);
      save(); renderReport();
    };
    r.addEventListener('input', commit);
    // מקלדת ומגע שלא מייצרים input נחשבים גם הם כדירוג
    r.addEventListener('change', commit);
    r.addEventListener('keydown', e => { if (/^Arrow|Home|End|Page/.test(e.key)) setTimeout(commit, 0); });
  });
}

/** מצב "טרם דורג" מוצג במפורש. אסור להראות מספר שהמערכת לא סופרת. */
function paintScore(r, i){
  const rated = state.scores[i] != null;
  const wrap  = r.closest('.score');
  if (wrap) wrap.classList.toggle('rated', rated);
  const out = $(`[data-out="${i}"]`);
  if (out) out.textContent = rated ? state.scores[i] : '—';
  r.style.setProperty('--pct', rated ? ((r.value - r.min) / (r.max - r.min)) * 100 + '%' : '0%');
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
  else if (s.type === 'quickcheck') where = 'אבחון קצר';
  else if (s.type === 'diagnostic') where = 'הדוח שלך';
  else if (s.type === 'contact')    where = 'הצעד הבא';
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
    const nx = STEPS[i + 1].type;
    next.textContent = i === 0 ? 'בואי נתחיל'
                     : nx === 'quickcheck' ? 'עוד שלוש שאלות'
                     : nx === 'diagnostic' ? 'לדוח שלי'
                     : nx === 'contact' ? 'לצעד הבא'
                     : 'הבא';
  }

  // teacher context refresh
  refreshSuggestions();

  // היסטוריה: כל שלב הוא כניסה משלו, כדי שכפתור "אחורה" של הדפדפן
  // יחזיר אותה שלב אחד ולא יזרוק אותה מהמדריך.
  if (opts.push)       history.pushState({ i }, '', '#' + i);
  else if (!opts.keep) history.replaceState({ i }, '', '#' + i);

  if (!opts.silent) window.scrollTo({ top:0, behavior: prev === i ? 'auto' : 'smooth' });
  if (s.type === 'diagnostic') renderReport();
  if (s.type === 'contact') renderLeadWhy();
  save();
}

/** ניווט שיזמה המשתמשת — נכנס להיסטוריה */
function nav(i){
  i = Math.min(Math.max(i, 0), LAST);
  if (i === cur) return;
  const from = STEPS[cur];
  if (from.type === 'work' && i > cur && state.scores[from.f] == null){
    toast('לא דירגת את היסוד הזה. אפשר לחזור בכל רגע.');
  }
  go(i, { push:true });
}
function hashIndex(){
  const n = parseInt((location.hash || '').replace('#',''), 10);
  return Number.isInteger(n) && n >= 0 && n <= LAST ? n : null;
}

/* ══════════════ REPORT ENGINE ══════════════ */
/* עומק תשובה. לא שיפוט על איכות הכתיבה — מדד גס לכמה היא באמת ירדה לפרטים. */
function depth(txt){
  const n = String(txt || '').trim().length;
  if (n === 0)   return 0;
  if (n < 12)    return .25;
  if (n < 45)    return .5;
  if (n < 120)   return .75;
  return 1;
}

function statFor(i){
  const f = GUIDE.foundations[i];
  const key = qi => 'f' + f.n + 'q' + (qi + 1);
  const cells = f.questions.map((q, qi) => ({ q, a: String(state.answers[key(qi)] || '').trim() }));
  const work  = cells.reduce((a, c) => a + depth(c.a), 0) / cells.length;
  const self  = state.scores[i];
  // 60% מה שהיא מרגישה, 40% מה שהיא באמת הצליחה לנסח. שני הצדדים נחוצים.
  const score = self == null ? null : Math.round(self * 10 * .6 + work * 100 * .4);
  const best  = cells.filter(c => c.a.length >= 25).sort((a, b) => b.a.length - a.a.length)[0] || null;
  return {
    i, f, self, score,
    work: Math.round(work * 100),
    written: cells.filter(c => c.a).length,
    totalQ: cells.length,
    blanks: cells.filter(c => !c.a).map(c => c.q),
    best
  };
}

function buildReport(){
  const stats = GUIDE.foundations.map((_, i) => statFor(i));
  const rated = stats.filter(s => s.score != null).length;
  if (rated < 5) return { ready:false, stats, rated };

  const total = Math.round(stats.reduce((a, s) => a + s.score, 0) / 5);
  const band  = REPORT.bands.find(b => total <= b.max) || REPORT.bands[REPORT.bands.length - 1];

  // תיקו → היסוד המוקדם. המודל נבנה מלמטה למעלה, אז מתחילים למטה.
  const asc  = stats.slice().sort((a, b) => a.score - b.score || a.i - b.i);
  const desc = stats.slice().sort((a, b) => b.score - a.score || a.i - b.i);
  const weak = asc.slice(0, 2);
  // היסוד החלש ביותר לא יכול להופיע גם כחוזקה. זו תהיה סתירה.
  const strengths = desc.filter(s => s.score >= 50 && s.i !== asc[0].i).slice(0, 2);

  const blanks = stats.flatMap(s => s.blanks.map(q => ({ name:s.f.short, q })));
  const spread = Math.max(...stats.map(s => s.score)) - Math.min(...stats.map(s => s.score));

  return { ready:true, stats, total, band, weak, strengths, blanks, spread, asc, desc };
}

/* טבעת הציון — SVG, נדפסת נקי */
function ring(total){
  const R = 52, C = 2 * Math.PI * R;
  const on = (total / 100) * C;
  return `<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="ציון כולל ${total} מתוך 100">
    <circle class="ring__bg" cx="64" cy="64" r="${R}"></circle>
    <circle class="ring__on" cx="64" cy="64" r="${R}"
      stroke-dasharray="${on.toFixed(1)} ${(C - on).toFixed(1)}"></circle>
  </svg>`;
}

function renderReport(){
  const box = $('#report');
  if (!box) return;
  const r = buildReport();

  const forLine = $('#repFor');
  if (forLine) forLine.textContent = state.name.trim() ? 'עבור ' + state.name.trim() : '';

  if (!r.ready){
    box.innerHTML = `<div class="verdict empty">
      <div class="verdict__tag">עוד רגע</div>
      <div class="verdict__name">דרגי את כל חמשת היסודות</div>
      <div class="verdict__body">דירגת <bdi>${r.rated} מתוך 5</bdi>. הדוח נבנה מהחמישה יחד, אז ברגע שתסגרי את השאר הוא ייפתח כאן במלואו.</div>
    </div>`;
    return;
  }

  const H = [];

  /* ─── 1. הציון ─── */
  H.push(`<section class="rep rep--score">
    <div class="scorecard">
      <div class="scorecard__ring">
        ${ring(r.total)}
        <div class="scorecard__num"><b>${r.total}</b><small>מתוך 100</small></div>
      </div>
      <div class="scorecard__txt">
        <div class="scorecard__tag">הציון הכולל שלך</div>
        <div class="scorecard__band">${esc(r.band.name)}</div>
        <p>${esc(r.band.body)}</p>
      </div>
    </div>
    <p class="rep__method"><b>איך הציון מחושב</b>${esc(REPORT.method)}</p>
  </section>`);

  /* ─── 2. המפה ─── */
  H.push(`<section class="rep">
    <h3 class="rep__h">התמונה לפי יסוד</h3>
    <div class="chart">${r.stats.map(s => `
      <div class="bar${s.i === r.asc[0].i ? ' weakest' : ''}">
        <div class="bar__top">
          <span class="bar__name">${esc(s.f.short)}</span>
          <span class="bar__score">${s.score} / 100</span>
        </div>
        <div class="bar__track"><div class="bar__fill" style="width:${s.score}%"></div></div>
        <div class="bar__sub">דירוג עצמי <bdi>${s.self}/10</bdi> · ענית על <bdi>${s.written} מתוך ${s.totalQ}</bdi> שאלות</div>
      </div>`).join('')}</div>
    ${r.spread >= 30 ? `<p class="rep__note">הפער בין היסוד החזק לחלש שלך הוא <bdi>${r.spread} נקודות</bdi>. פער כזה הוא בדרך כלל מה שגורם לשיווק להרגיש לא עקבי, כי היסודות עובדים כמערכת ולא בנפרד.</p>` : ''}
  </section>`);

  /* ─── 3. מה את עושה טוב ─── */
  H.push(`<section class="rep">
    <h3 class="rep__h rep__h--good">${esc(REPORT.strengthsTitle)}</h3>
    ${r.strengths.length ? r.strengths.map(s => `
      <div class="item item--good">
        <div class="item__head"><b>${esc(s.f.short)}</b><span>${s.score} / 100</span></div>
        <p>${esc(s.f.strength)}</p>
        ${s.best ? `<div class="quote">
          <div class="quote__q">${esc(REPORT.strengthQuote)}</div>
          <blockquote>${esc(s.best.a.length > 260 ? s.best.a.slice(0, 260).trim() + '…' : s.best.a)}</blockquote>
          <cite>${esc(s.best.q)}</cite>
        </div>` : ''}
      </div>`).join('')
      : `<div class="item"><p>${esc(REPORT.strengthsNone)}</p></div>`}
  </section>`);

  /* ─── 4. מה לשפר עכשיו ─── */
  H.push(`<section class="rep">
    <h3 class="rep__h rep__h--fix">${esc(REPORT.improveTitle)}</h3>
    <p class="rep__lede">${esc(REPORT.improveLede)}</p>
    ${r.spread <= 5 ? `<p class="rep__note" style="margin-top:0;margin-bottom:16px">${esc(REPORT.tieNote)}</p>` : ''}
    ${r.weak.map((s, n) => `
      <div class="item item--fix">
        <div class="item__head"><b>${n + 1}. ${esc(s.f.short)}</b><span>${s.score} / 100</span></div>
        <p>${esc(s.f.gap)}</p>
        <p class="item__rx"><b>הצעד הראשון:</b> ${esc(s.f.rx)}</p>
        <div class="item__acts">
          <div class="item__acts-t">${esc(REPORT.actionsTitle)}</div>
          <ul>${s.f.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        </div>
      </div>`).join('')}
  </section>`);

  /* ─── 5. שאלות ריקות ─── */
  const shown = r.blanks.slice(0, 6);
  H.push(`<section class="rep">
    <h3 class="rep__h">${esc(REPORT.blanksTitle)}</h3>
    ${r.blanks.length ? `
      <p class="rep__lede">${esc(REPORT.blanksLede)}</p>
      <ul class="blanks">${shown.map(b => `<li><span>${esc(b.name)}</span>${esc(b.q)}</li>`).join('')}</ul>
      ${r.blanks.length > shown.length ? `<p class="rep__note">ועוד <bdi>${r.blanks.length - shown.length}</bdi> שאלות. כולן מחכות לך במדריך, אפשר לחזור אליהן בכל רגע.</p>` : ''}`
    : `<p class="rep__lede">${esc(REPORT.blanksNone)}</p>`}
  </section>`);

  /* ─── 6. תוכנית שבועיים ─── */
  const w1 = r.weak[0].f.actions.slice(0, 3);
  const w2 = r.weak[1].f.actions.slice(0, 2);
  H.push(`<section class="rep">
    <h3 class="rep__h">${esc(REPORT.planTitle)}</h3>
    <p class="rep__lede">${esc(REPORT.planLede)}</p>
    <div class="plan">
      <div class="plan__wk">
        <div class="plan__t">${esc(REPORT.week1)}<span>${esc(r.weak[0].f.short)}</span></div>
        <ul>${w1.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>
      <div class="plan__wk">
        <div class="plan__t">${esc(REPORT.week2)}<span>${esc(r.weak[1].f.short)}</span></div>
        <ul>${w2.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`);

  /* ─── 7. ההמלצה האישית של טוהר ─── */
  H.push(recoBlock(r));

  /* ─── 8. סיום ─── */
  H.push(`<section class="rep rep--end">
    <h3 class="rep__h">${esc(REPORT.closingTitle)}</h3>
    <p>${esc(REPORT.closing)}</p>
  </section>`);

  box.innerHTML = H.join('');
}

/* ── ההמלצה האישית של טוהר, בקול שלה ── */
function recoBlock(r){
  const w = r.weak[0];
  const avg10 = (r.stats.reduce((a, s) => a + s.self, 0) / 5);
  const band  = avg10 <= 4.5 ? 'low' : (avg10 >= 7.5 ? 'high' : 'mid');

  const bits = [RECO_OPENER[band]];
  if (r.spread >= 30){
    bits.push(`<strong>${esc(w.f.short)}</strong> מושך למטה את כל השאר, כי היסודות לא עובדים בנפרד אלא כמערכת.`);
  }
  if (state.quick.pain && RECO_PAIN[state.quick.pain]) bits.push(RECO_PAIN[state.quick.pain]);
  if (state.quick.need && RECO_NEED[state.quick.need]) bits.push(RECO_NEED[state.quick.need]);

  return `<section class="rep"><div class="reco">
    <div class="reco__head">
      <img src="assets/tohar-avatar.jpg" alt="טוהר אקנין">
      <div><div class="reco__name">ההמלצה האישית שלי אלייך</div><div class="reco__role">טוהר · תהליכי שיווק</div></div>
    </div>
    ${bits.map(b => `<p>${b}</p>`).join('')}
    <div class="reco__cta">
      <p>הדבר הזה נסגר הכי מהר בשיחה. בפגישת אבחון קצרה נעבור יחד על <strong>${esc(w.f.short)}</strong> בעסק שלך ספציפית, ותצאי עם צעד ברור לשבוע הקרוב.</p>
    </div>
  </div></section>`;
}

/* פרופיל קצר — משמש להודעת הוואטסאפ ולשבב שבטופס הליד */
function profile(){
  const r = buildReport();
  if (!r.ready) return null;
  return {
    idx: r.asc[0].i,
    f: r.asc[0].f,
    total: r.total,
    band: r.band,
    avg: r.stats.reduce((a, s) => a + s.self, 0) / 5
  };
}

/* ── לכידת ליד ── */
// מקבל 05X-XXXXXXX, +9725X..., 9725X... ומחזיר פורמט בינלאומי
function normalizePhone(raw){
  const d = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (/^05\d{8}$/.test(d))      return '972' + d.slice(1);
  if (/^9725\d{8}$/.test(d))    return d;
  if (/^5\d{8}$/.test(d))       return '972' + d;
  return null;
}

function renderLeadWhy(){
  const nameIn = $('#lName');
  if (nameIn && !nameIn.value.trim() && state.name.trim()) nameIn.value = state.name.trim();
  const box = $('#leadWhy');
  if (!box) return;
  const p = profile();
  if (!p){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="lead__chip">היסוד שנעבור עליו: <b>${esc(p.f.short)}</b></div>`;
}

async function submitLead(e){
  e.preventDefault();
  const name  = $('#lName').value.trim();
  const phone = normalizePhone($('#lPhone').value);
  const errN  = $('#lErrName');
  const err   = $('#lErr');
  const btn   = $('#lSend');

  errN.textContent = ''; err.textContent = '';
  if (name.length < 2){ errN.textContent = 'רק שם, כדי שטוהר תדע למי היא חוזרת'; $('#lName').focus(); return; }
  if (!phone){ err.textContent = 'המספר לא נראה תקין. נסי בפורמט 05X-XXXXXXX'; $('#lPhone').focus(); return; }

  btn.disabled = true; btn.textContent = 'שולח...';
  const p = profile();

  try{
    const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/guide-lead', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + CFG.SUPABASE_ANON },
      body: JSON.stringify({
        sid: state.sid, name, phone,
        scores: state.scores, quick: state.quick,
        weakest: p ? p.f.short : null,
        avg: p ? +p.avg.toFixed(1) : null,
        total: p ? p.total : null,
        band: p ? p.band.name : null
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    leadSent(name);
  }catch(_){
    // הבקאנד לא זמין. אסור להגיד לה שנשלח — הליד יאבד בשקט.
    leadNeedsSend(name);
  }
}

/** נשלח באמת */
function leadSent(name){
  const box = $('#leadBox');
  if (!box) return;
  box.innerHTML = `<div class="lead__done">
      <div class="lead__tick">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h3>קיבלתי, ${esc(name)}</h3>
      <p>טוהר תחזור אלייך בקרוב עם תיאום לשיחה. בינתיים אפשר לשמור את המדריך שלך.</p>
      <button class="btn btn--ghost btn--block" id="btnPrint2" style="margin-top:16px">שמירת המדריך שלי כ־PDF</button>
    </div>`;
  toast('הפרטים נשלחו לטוהר');
}

/** לא נשלח. אומרים את האמת ומבקשים ממנה את הפעולה שכן עובדת. */
function leadNeedsSend(name){
  const box = $('#leadBox');
  if (!box) return;
  box.innerHTML = `<div class="lead__done">
      <div class="lead__tick lead__tick--wait">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
      </div>
      <h3>כמעט, ${esc(name)}</h3>
      <p>נשאר צעד אחד: לשלוח את זה לטוהר. ההודעה כבר מוכנה עם התוצאות שלך, רק ללחוץ ולשלוח.</p>
      <a class="btn btn--wa btn--block" href="${buildMeetingWa()}" target="_blank" rel="noopener" style="margin-top:16px">
        לשלוח לטוהר בוואטסאפ
      </a>
      <button class="btn btn--ghost btn--block" id="btnPrint2" style="margin-top:10px">שמירת המדריך שלי כ־PDF</button>
    </div>`;
  toast('נשאר רק לשלוח');
}

/* ── הודעת קביעת פגישה ── */
function buildMeetingWa(){
  const r = buildReport();
  const who = state.name.trim() ? ' אני ' + state.name.trim() + '.' : '';
  const L = ['היי טוהר, סיימתי את מודל היסודות השיווקיים ואשמח לקבוע איתך שיחת אבחון.' + who, ''];
  if (r.ready){
    L.push('הדוח שיצא לי: ' + r.total + '/100 — ' + r.band.name, '');
    r.stats.forEach(s => L.push('• ' + s.f.short + ': ' + s.score + '/100'));
    L.push('', 'היסוד להתחיל ממנו: ' + r.weak[0].f.short);
  } else {
    L.push('עוד לא דירגתי את כל היסודות, אבל אשמח לדבר.');
  }
  const Q = QUICKCHECK.reduce((m,q) => (m[q.k]=q, m), {});
  const label = (k) => {
    const v = state.quick[k]; if (!v) return null;
    const o = Q[k].opts.find(x => x.v === v); return o ? o.t : null;
  };
  const extra = [['stage','העסק שלי'], ['pain','מה הכי מתסכל'], ['need','מה יעזור לי']]
    .map(([k,t]) => { const l = label(k); return l ? `${t}: ${l}` : null; }).filter(Boolean);
  if (extra.length){ L.push('', ...extra); }
  L.push('', 'מתי נוח לך?');
  return 'https://wa.me/' + CFG.WA_TOHAR + '?text=' + encodeURIComponent(L.join('\n'));
}

function buildWa(){
  const r = buildReport();
  const L = ['היי טוהר, סיימתי את מודל היסודות השיווקיים.', ''];
  if (r.ready){
    L.push('הציון שלי: ' + r.total + '/100 — ' + r.band.name);
    r.stats.forEach(s => L.push('• ' + s.f.short + ': ' + s.score + '/100'));
    L.push('', 'היסוד להתחיל ממנו: ' + r.weak[0].f.short);
  } else {
    L.push('עוד לא דירגתי את כל היסודות, אבל אשמח לדבר.');
  }
  L.push('', 'אשמח לשמוע איך ממשיכים מכאן.');
  return 'https://wa.me/' + CFG.WA_TOHAR + '?text=' + encodeURIComponent(L.join('\n'));
}

/* ══════════════ COMPANION (המלווה) ══════════════ */
const T = { history:[], busy:false, greeted:false, online:null }; // null = טרם נבדק

async function probeTeacher(){
  try{
    const r = await fetch(CFG.TEACHER_URL, {
      method:'OPTIONS',
      headers:{ 'Authorization':'Bearer ' + CFG.SUPABASE_ANON }
    });
    T.online = r.ok;
  }catch(_){ T.online = false; }

  applyTeacherState();
}

/** כשהליווי לא זמין — אומרים את זה מיד, לא אחרי שהיא כתבה וחיכתה. */
function applyTeacherState(){
  const off = T.online === false;
  const btn = $('#teach');
  if (btn) btn.classList.toggle('is-off', off);
  const inp = $('#tinput'), snd = $('#tsend'), sug = $('#tsug'), note = $('#tnote');
  if (inp){ inp.disabled = off; inp.placeholder = off ? COMPANION.offPlaceholder : COMPANION.placeholder; }
  if (snd)  snd.disabled = off;
  if (sug)  sug.style.display = off ? 'none' : '';
  if (note) note.textContent = off ? COMPANION.offNote : '';
}

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
  if (s.type === 'diagnostic' || s.type === 'closing' || s.type === 'quickcheck'){
    ctx.allScores = GUIDE.foundations.map((f2, i) => ({ name:f2.short, score:state.scores[i] }));
    const Q = QUICKCHECK.reduce((m,q) => (m[q.k]=q, m), {});
    ctx.quickCheck = Object.entries(state.quick).filter(([,v]) => v).map(([k,v]) => {
      const o = Q[k] && Q[k].opts.find(x => x.v === v);
      return o ? { question: Q[k].q, answer: o.t } : null;
    }).filter(Boolean);
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
  const key = COMPANION_PROMPTS[s.type] ? s.type : 'other';
  const list = COMPANION_PROMPTS[key];
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
    const hello = T.online === false
      ? COMPANION.helloOff
      : (f ? COMPANION.helloAt(esc(f.short)) : COMPANION.hello);
    addMsg('t', `<p>${hello}</p>`);
  }
  applyTeacherState();
  if (T.online !== false) setTimeout(() => $('#tinput').focus(), 320);
}
function closeTeacher(){ $('#tsheet').classList.remove('on'); }

async function ask(question){
  if (T.busy || !question.trim() || T.online === false) return;
  T.busy = true;
  $('#tsend').disabled = true;
  addMsg('user', `<p>${esc(question)}</p>`);
  T.history.push({ role:'user', content:question });

  const typing = addMsg('t', `<div class="dots3"><i></i><i></i><i></i></div>`);

  try{
    const res = await fetch(CFG.TEACHER_URL, {
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
    typing.innerHTML = `<p>אני עוד לא מחוברת כאן. בינתיים אפשר להמשיך בשאלות העבודה, וכל מה שאת כותבת נשמר.</p>`;
    T.online = false;
    applyTeacherState();
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
      answers: state.answers,
      quick: state.quick,
      name: state.name
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

// שמות המלווה מגיעים מ-content.js. ה-HTML מחזיק רק ברירת מחדל.
(function nameCompanion(){
  const set = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  set('#teachLabel', COMPANION.button);
  set('#tName',      COMPANION.name);
  set('#tRole',      COMPANION.role);
  const inp = $('#tinput'); if (inp) inp.placeholder = COMPANION.placeholder;
  const btn = $('#teach'); if (btn) btn.setAttribute('aria-label', COMPANION.button);
})();

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
document.addEventListener('submit', e => {
  if (e.target.id === 'leadForm') submitLead(e);
});

document.addEventListener('click', e => {
  if (e.target.closest('#btnMeet2')) e.target.closest('#btnMeet2').href = buildMeetingWa();
  if (e.target.closest('#btnMeet3')) e.target.closest('#btnMeet3').href = buildMeetingWa();
  if (e.target.closest('#btnPrintReport')) printReport();
  if (e.target.closest('#btnPrint2')) printReport();
  if (e.target.closest('#btnPrint')){
    $$('textarea[data-k]').forEach(autosize);
    setTimeout(() => window.print(), 120);
  }
  if (e.target.closest('#btnWa'))   e.target.closest('#btnWa').href   = buildWa();
  if (e.target.closest('#btnMeet')) e.target.closest('#btnMeet').href = buildMeetingWa();
  if (e.target.closest('#btnReset')){
    if (!confirm('למחוק את כל התשובות והציונים ולהתחיל מחדש?')) return;
    try { localStorage.removeItem(CFG.STORE); } catch(err){}
    state = { answers:{}, scores:[null,null,null,null,null], quick:{}, name:'', step:0, sid:newSid() };
    const nm = $('#repName'); if (nm) nm.value = '';
    $$('.qc__opt').forEach(b => b.classList.remove('on'));
    $$('textarea[data-k]').forEach(ta => { ta.value=''; autosize(ta); markFilled(ta); });
    $$('input[data-score]').forEach(r => { r.value = 5; paintScore(r, +r.dataset.score); });
    renderReport();
    nav(0);
    toast('הכול נוקה. אפשר להתחיל מחדש.');
  }
});

// השם על הדוח — מתעדכן חי בכותרת, ומזין מראש את טופס הליד
document.addEventListener('input', e => {
  if (e.target.id !== 'repName') return;
  state.name = e.target.value;
  const line = $('#repFor');
  if (line) line.textContent = state.name.trim() ? 'עבור ' + state.name.trim() : '';
  save();
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
probeTeacher();
})();
