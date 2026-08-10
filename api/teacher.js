// ============================================================
// "המורה" — פונקציית שרת ב-Vercel
//
// חוק ברזל: ANTHROPIC_API_KEY חי רק כמשתנה סביבה של הפרויקט ב-Vercel.
// הוא לעולם לא מגיע לדפדפן. הפרונט מדבר רק מול /api/teacher.
// ============================================================

const MODEL      = 'claude-sonnet-5';
const MAX_TOKENS = 700;

// מגבלת קצב בזיכרון. מתאפסת בקר-סטארט וזה בסדר — זו הגנה מפני הצפה, לא חשבונאות.
const hits = new Map();
const LIMIT = 25;
const WINDOW = 10 * 60 * 1000;

function tooMany(sid) {
  const now = Date.now();
  const arr = (hits.get(sid) || []).filter(t => now - t < WINDOW);
  arr.push(now);
  hits.set(sid, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > LIMIT;
}

const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function systemPrompt(ctx) {
  const L = [];

  L.push(`את "המלווה" של מודל היסודות השיווקיים של טוהר אקנין.
את לא מורה ואת לא מרצה. את לא מלמדת מלמעלה. את חושבת יחד עם האישה שמולך, משקפת לה מה שהיא כבר אמרה, ומכוונת אותה לתשובה שלה עצמה. אם היא שואלת מי את, אמרי שאת הליווי של המדריך ושאת נשענת על השיטה של טוהר. אל תציגי את עצמך כטוהר.
טוהר היא יועצת שיווק שמלווה בעלות עסקים. התפיסה שלה: שיווק הוא לא אוסף טיפים אלא מערכת, ולפני כל פוסט או קמפיין צריכים להיות ברורים חמישה יסודות.

חמשת היסודות:
1. זהות עסקית — מי אני?
2. הלקוחה — למי אני מדברת?
3. ההבטחה — איזה שינוי אני יוצרת?
4. אמון — למה שיאמינו לי?
5. המסלול — איך אני מובילה אותה מהיכרות לרכישה?

מי מולך: בעלת עסק שעוברת עכשיו את המדריך. פני אליה בלשון נקבה תמיד.

איך את מלווה:
- עברית מדוברת וחמה. בלי ז'רגון שיווקי, בלי אנגלית מיותרת.
- קצר. שתיים עד ארבע פסקאות קטנות, לא יותר.
- השיטה של טוהר היא להבין למה, לא לקבל הוראות. לכן במקום לתת תשובה מוכנה, החזירי לה שאלה טובה שתעזור לה להגיע לתשובה בעצמה. תני דוגמה קונקרטית רק כדי להראות כיוון.
- אם היא מבקשת שתבדקי תשובה שכתבה: אמרי מה חזק בה, ואז הצביעי על דבר אחד ספציפי שיחדד אותה. לא רשימת הערות.
- אם היא תקועה, פרקי את השאלה לשאלה קטנה יותר שקל לענות עליה.
- בלי מקף ארוך בטקסט. בלי אימוג'ים.

גבולות:
- אל תמציאי עובדות על טוהר, על המחירים שלה, על השירותים או על לקוחות שלה. את יודעת רק מה שכתוב במדריך.
- אם שואלים אותך משהו שלא קשור לשיווק או למדריך, החזירי בעדינות למקום שבו היא נמצאת.
- אם היא רוצה לעבוד עם טוהר, אמרי לה שהיא מוזמנת להשאיר פרטים בסוף המדריך או לכתוב לה בוואטסאפ.`);

  if (ctx?.foundation) {
    L.push(`\nאיפה היא נמצאת עכשיו: יסוד ${ctx.foundation.n} — ${ctx.foundation.name}. השאלה המנחה: ${ctx.foundation.question}`);
  }
  const where = {
    idea:  'היא בשלב הלימוד של היסוד. היא בדיוק קראה את הרעיון ואת ההסבר הפסיכולוגי.',
    story: 'היא בשלב שבו טוהר מספרת דוגמה אישית מהעסק שלה.',
    work:  'היא בשלב שאלות העבודה. כאן היא כותבת על העסק שלה עצמה.',
    quickcheck: 'היא באבחון הקצר בסוף.',
    diagnostic: 'היא רואה את הדוח האישי שלה: ציון כולל, חוזקות, מה לשפר ותוכנית שבועיים.',
    closing: 'היא סיימה את המסע.'
  };
  if (ctx?.stepType && where[ctx.stepType]) L.push(where[ctx.stepType]);

  if (ctx?.material) L.push(`\nהחומר שהיא קראה בשלב הזה (הקשר בלבד, אל תצטטי כמו שהוא):\n${strip(ctx.material).slice(0, 2600)}`);

  if (Array.isArray(ctx?.herAnswers) && ctx.herAnswers.length) {
    const a = ctx.herAnswers.slice(0, 8)
      .map(x => `שאלה: ${x.question}\nמה שהיא כתבה: ${String(x.answer).slice(0, 600)}`).join('\n\n');
    L.push(`\nמה שהיא כבר כתבה בשלב הזה. התייחסי לזה ישירות כשזה רלוונטי:\n${a}`);
  }
  if (typeof ctx?.herScore === 'number') L.push(`\nהציון שהיא נתנה לעצמה ביסוד הזה: ${ctx.herScore} מתוך 10.`);

  if (Array.isArray(ctx?.allScores)) {
    const s = ctx.allScores.filter(x => x.score != null).map(x => `${x.name}: ${x.score}/10`).join(', ');
    if (s) L.push(`\nהציונים שלה בכל היסודות: ${s}`);
  }
  if (Array.isArray(ctx?.quickCheck) && ctx.quickCheck.length) {
    L.push(`\nמה שסימנה באבחון הקצר:\n` + ctx.quickCheck.map(q => `${q.question} ${q.answer}`).join('\n'));
  }
  return L.join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'method not allowed' });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    console.error('ANTHROPIC_API_KEY חסר');
    return res.status(503).json({ error: 'not configured' });
  }

  const body     = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const sid      = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const ctx      = body.context || {};
  const history  = Array.isArray(body.history) ? body.history : [];

  if (!sid)                   return res.status(400).json({ error: 'missing sid' });
  if (!question)              return res.status(400).json({ error: 'missing question' });
  if (question.length > 1500) return res.status(400).json({ error: 'question too long' });
  if (tooMany(sid)) {
    return res.status(429).json({ error: 'rate limited', reply: 'שאלת הרבה שאלות ברצף. קחי רגע, ותכף אפשר להמשיך.' });
  }

  const messages = history
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .slice(-8)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (!messages.length || messages[messages.length - 1].content !== question) {
    messages.push({ role: 'user', content: question });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt(ctx), messages })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('anthropic', r.status, t.slice(0, 400));
      // חוסר קרדיט הוא מצב תפעולי, לא באג — אומרים לה את האמת בעדינות
      const noCredit = t.includes('credit balance');
      return res.status(502).json({
        error: 'upstream',
        reply: noCredit
          ? 'אני עוד לא זמינה כאן. בינתיים אפשר להמשיך במדריך, וכל מה שאת כותבת נשמר.'
          : 'משהו השתבש אצלי לרגע. תנסי לשאול שוב.'
      });
    }

    const data  = await r.json();
    const reply = (data?.content || []).filter(b => b?.type === 'text').map(b => b.text).join('\n').trim();
    if (!reply) return res.status(502).json({ error: 'empty', reply: 'לא הצלחתי לנסח תשובה. תנסי לשאול אחרת.' });

    return res.status(200).json({ reply });

  } catch (e) {
    console.error('teacher', e);
    return res.status(500).json({ error: 'internal', reply: 'משהו השתבש אצלי לרגע. תנסי לשאול שוב.' });
  }
}
