// ============================================================
// "המורה" — המנטור של מדריך היסודות השיווקיים
//
// חוק ברזל: ANTHROPIC_API_KEY חי כאן בלבד, כ-secret של הפונקציה.
// הוא לעולם לא מגיע לדפדפן. הפרונט מדבר רק מול הפונקציה הזו.
// ============================================================

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MODEL      = 'claude-sonnet-5';
const MAX_TOKENS = 700;

// מקורות מותרים. הוסף כאן את הדומיין החי כשהמדריך עולה.
const ALLOWED = [
  'https://hilell-aknine.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

function cors(origin: string | null) {
  const ok = origin && ALLOWED.some(a => origin === a || origin.startsWith(a));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' }
  });

// ─────────── rate limit בזיכרון, פר-מפגש ───────────
const hits = new Map<string, number[]>();
const LIMIT = 25;              // שאלות
const WINDOW = 10 * 60 * 1000; // בעשר דקות

function tooMany(sid: string) {
  const now = Date.now();
  const arr = (hits.get(sid) ?? []).filter(t => now - t < WINDOW);
  arr.push(now);
  hits.set(sid, arr);
  if (hits.size > 5000) hits.clear(); // בלם זיכרון
  return arr.length > LIMIT;
}

// ─────────── הפרסונה ───────────
function systemPrompt(ctx: any) {
  const lines: string[] = [];

  lines.push(`את "המורה" של מודל היסודות השיווקיים של טוהר אקנין.
טוהר היא יועצת שיווק שמלווה בעלות עסקים. התפיסה שלה: שיווק הוא לא אוסף טיפים אלא מערכת, ולפני כל פוסט או קמפיין צריכים להיות ברורים חמישה יסודות.

חמשת היסודות:
1. זהות עסקית — מי אני?
2. הלקוחה — למי אני מדברת?
3. ההבטחה — איזה שינוי אני יוצרת?
4. אמון — למה שיאמינו לי?
5. המסלול — איך אני מובילה אותה מהיכרות לרכישה?

מי מולך: בעלת עסק שעוברת עכשיו את המדריך. פני אליה בלשון נקבה תמיד.

איך את מלמדת:
- עברית מדוברת וחמה. בלי ז'רגון שיווקי, בלי אנגלית מיותרת.
- קצר. שתיים עד ארבע פסקאות קטנות, לא יותר.
- השיטה של טוהר היא להבין למה, לא לקבל הוראות. לכן במקום לתת לה תשובה מוכנה, החזירי לה שאלה טובה שתעזור לה להגיע לתשובה בעצמה. תני דוגמה קונקרטית רק כדי להראות כיוון.
- אם היא מבקשת שתבדקי תשובה שכתבה: אמרי מה חזק בה, ואז הצביעי על דבר אחד ספציפי שיחדד אותה. לא רשימה של הערות.
- אם היא תקועה, פרקי את השאלה לשאלה קטנה יותר שקל לענות עליה.
- בלי מקף ארוך בטקסט.
- בלי אימוג'ים.

גבולות:
- אל תמציאי עובדות על טוהר, על המחירים שלה, על השירותים או על לקוחות שלה. את יודעת רק מה שכתוב במדריך.
- אם שואלים אותך משהו שלא קשור לשיווק או למדריך, החזירי בעדינות למקום שבו היא נמצאת.
- אם היא רוצה לעבוד עם טוהר, אמרי לה שהיא מוזמנת לפנות אליה בוואטסאפ מהכפתור בסוף המדריך.`);

  if (ctx?.foundation) {
    lines.push(`\nאיפה היא נמצאת עכשיו: יסוד ${ctx.foundation.n} — ${ctx.foundation.name}. השאלה המנחה: ${ctx.foundation.question}`);
  }
  const where: Record<string, string> = {
    idea:  'היא בשלב הלימוד של היסוד. היא בדיוק קראה את הרעיון ואת ההסבר הפסיכולוגי.',
    story: 'היא בשלב שבו טוהר מספרת דוגמה אישית מהעסק שלה.',
    work:  'היא בשלב שאלות העבודה. כאן היא כותבת על העסק שלה עצמה.',
    diagnostic: 'היא בסוף המסע ורואה את האבחון שלה.',
    closing: 'היא סיימה את המסע.'
  };
  if (ctx?.stepType && where[ctx.stepType]) lines.push(where[ctx.stepType]);

  if (ctx?.material) {
    lines.push(`\nהחומר שהיא קראה בשלב הזה (לצורך הקשר בלבד, אל תצטטי אותו כמו שהוא):\n${String(ctx.material).slice(0, 2600)}`);
  }

  if (Array.isArray(ctx?.herAnswers) && ctx.herAnswers.length) {
    const a = ctx.herAnswers
      .slice(0, 8)
      .map((x: any) => `שאלה: ${x.question}\nמה שהיא כתבה: ${String(x.answer).slice(0, 600)}`)
      .join('\n\n');
    lines.push(`\nמה שהיא כבר כתבה בשלב הזה. התייחסי לזה ישירות, בשמה, כשזה רלוונטי:\n${a}`);
  }
  if (typeof ctx?.herScore === 'number') {
    lines.push(`\nהציון שהיא נתנה לעצמה ביסוד הזה: ${ctx.herScore} מתוך 10.`);
  }
  if (Array.isArray(ctx?.allScores)) {
    const s = ctx.allScores.filter((x: any) => x.score != null)
      .map((x: any) => `${x.name}: ${x.score}/10`).join(', ');
    if (s) lines.push(`\nהציונים שלה בכל היסודות: ${s}`);
  }

  return lines.join('\n');
}

// ─────────── לוג (לא חוסם את התשובה) ───────────
async function logMessage(row: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/teacher_messages`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
  } catch { /* לוג שנכשל לא מפיל שיחה */ }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405, origin);

  if (!ANTHROPIC_KEY) {
    console.error('ANTHROPIC_API_KEY חסר');
    return json({ error: 'not configured' }, 503, origin);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: 'bad json' }, 400, origin); }

  const sid      = typeof body?.sid === 'string' ? body.sid.slice(0, 64) : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const ctx      = body?.context ?? {};
  const history  = Array.isArray(body?.history) ? body.history : [];

  if (!sid)                    return json({ error: 'missing sid' }, 400, origin);
  if (!question)               return json({ error: 'missing question' }, 400, origin);
  if (question.length > 1500)  return json({ error: 'question too long' }, 400, origin);
  if (tooMany(sid))            return json({ error: 'rate limited', reply: 'שאלת הרבה שאלות ברצף. קחי רגע, ותכף אפשר להמשיך.' }, 429, origin);

  const messages = history
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .slice(-8)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (!messages.length || messages[messages.length - 1].content !== question) {
    messages.push({ role: 'user', content: question });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(ctx),
        messages
      })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('anthropic', r.status, t.slice(0, 400));
      return json({ error: 'upstream', reply: 'משהו השתבש אצלי לרגע. תנסי לשאול שוב.' }, 502, origin);
    }

    const data = await r.json();
    const reply = (data?.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();

    if (!reply) return json({ error: 'empty', reply: 'לא הצלחתי לנסח תשובה. תנסי לשאול אחרת.' }, 502, origin);

    logMessage({
      sid,
      step_type:  ctx?.stepType ?? null,
      foundation: ctx?.foundation?.n ?? null,
      question,
      reply,
      tokens_in:  data?.usage?.input_tokens ?? null,
      tokens_out: data?.usage?.output_tokens ?? null
    });

    return json({ reply }, 200, origin);

  } catch (e) {
    console.error('teacher', e);
    return json({ error: 'internal', reply: 'משהו השתבש אצלי לרגע. תנסי לשאול שוב.' }, 500, origin);
  }
});
