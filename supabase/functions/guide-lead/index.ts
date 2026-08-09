// ============================================================
// לכידת ליד ממדריך היסודות + התראה לטוהר
//
// נקראת רק אחרי שהמשתמשת עברה את המסע וקיבלה את האבחון שלה.
// anon לא נוגע בטבלה — הפונקציה כותבת עם service_role אחרי ולידציה.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Green API — התראה לטוהר. אופציונלי: בלעדיו הליד עדיין נשמר.
const GREEN_URL      = Deno.env.get('GREEN_API_URL') ?? '';
const GREEN_INSTANCE = Deno.env.get('GREEN_API_INSTANCE') ?? '';
const GREEN_TOKEN    = Deno.env.get('GREEN_API_TOKEN') ?? '';
const NOTIFY_PHONE   = Deno.env.get('TOHAR_NOTIFY_PHONE') ?? '';

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
const json = (b: unknown, s: number, o: string | null) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** מקבל רק נייד ישראלי. קו נייח או מספר שבור נדחה — טלפון לא תקין לא נשלח. */
function normalizePhone(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (/^05\d{8}$/.test(d))   return '972' + d.slice(1);
  if (/^9725\d{8}$/.test(d)) return d;
  if (/^5\d{8}$/.test(d))    return '972' + d;
  return null;
}

// bucket פשוט נגד הצפה, פר-מפגש
const seen = new Map<string, number>();

async function notifyTohar(text: string) {
  if (!GREEN_URL || !GREEN_INSTANCE || !GREEN_TOKEN || !NOTIFY_PHONE) {
    console.log('Green API לא מוגדר — מדלג על ההתראה. הליד נשמר.');
    return;
  }
  try {
    const r = await fetch(`${GREEN_URL}/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${NOTIFY_PHONE}@c.us`, message: text })
    });
    if (!r.ok) console.error('green', r.status, (await r.text()).slice(0, 200));
  } catch (e) {
    console.error('notify', e); // התראה שנכשלה לא מפילה את שמירת הליד
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405, origin);
  if (!SERVICE_ROLE)            return json({ error: 'not configured' }, 503, origin);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }

  const sid = String(body?.sid ?? '');
  if (!UUID.test(sid)) return json({ error: 'bad sid' }, 400, origin);

  const name  = String(body?.name ?? '').trim().slice(0, 80);
  const phone = normalizePhone(body?.phone);
  if (name.length < 2) return json({ error: 'bad name' }, 400, origin);
  if (!phone)          return json({ error: 'bad phone' }, 400, origin);

  const now = Date.now();
  const last = seen.get(sid) ?? 0;
  if (now - last < 20000) return json({ ok: true, dedup: true }, 200, origin);
  seen.set(sid, now);
  if (seen.size > 5000) seen.clear();

  const scores: (number | null)[] = Array.isArray(body?.scores)
    ? body.scores.slice(0, 5).map((v: any) => {
        const n = parseInt(v, 10);
        return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
      })
    : [];
  const weakest = typeof body?.weakest === 'string' ? body.weakest.slice(0, 40) : null;
  const avg = Number.isFinite(+body?.avg) ? Math.round(+body.avg * 10) / 10 : null;

  const ALLOW: Record<string, string[]> = {
    stage: ['start','moving','steady'],
    pain:  ['time','words','silence','closing'],
    need:  ['order','voice','plan','partner']
  };
  const quick: Record<string, string> = {};
  if (body?.quick && typeof body.quick === 'object') {
    for (const [k, v] of Object.entries(body.quick)) {
      if (ALLOW[k] && typeof v === 'string' && ALLOW[k].includes(v)) quick[k] = v;
    }
  }

  const row = {
    sid, name, phone, is_lead: true, weakest, avg_score: avg,
    scores: scores.filter(s => s != null).length === 5 ? scores : [],
    answers: { __quick: quick },
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300)
  };

  try {
    // merge-duplicates: המפגש כבר קיים מהסנכרון השוטף, מוסיפים לו את הפרטים
    const r = await fetch(`${SUPABASE_URL}/rest/v1/guide_sessions?on_conflict=sid`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('lead upsert', r.status, t.slice(0, 300));
      return json({ error: 'db' }, 502, origin);
    }
  } catch (e) {
    console.error('lead', e);
    return json({ error: 'internal' }, 500, origin);
  }

  const HE: Record<string, string> = {
    start:'בהתחלת הדרך', moving:'רץ אבל לא יציב', steady:'יציב ורוצה לצמוח',
    time:'אין זמן', words:'לא יודעת מה להגיד', silence:'מעלה ולא קורה כלום', closing:'פניות שלא נסגרות',
    order:'סדר ואסטרטגיה', voice:'המילים', plan:'תוכנית תוכן', partner:'ליווי'
  };
  const lines = [
    '🎯 ליד חדש ממדריך היסודות',
    '',
    `שם: ${name}`,
    `טלפון: 0${phone.slice(3)}`,
  ];
  if (weakest) lines.push(`היסוד החלש: ${weakest}`);
  if (avg != null) lines.push(`ממוצע: ${avg}/10`);
  if (quick.stage) lines.push(`מצב העסק: ${HE[quick.stage]}`);
  if (quick.pain)  lines.push(`התסכול: ${HE[quick.pain]}`);
  if (quick.need)  lines.push(`מה שתעזור לה: ${HE[quick.need]}`);
  lines.push('', 'היא ביקשה שיחת אבחון.');

  await notifyTohar(lines.join('\n'));

  return json({ ok: true }, 200, origin);
});
