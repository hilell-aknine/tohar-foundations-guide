// ============================================================
// שמירת התקדמות במדריך היסודות
// upsert לפי sid. anon אף פעם לא נוגע בטבלה ישירות.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const FOUNDATIONS = ['זהות עסקית', 'הלקוחה', 'ההבטחה', 'אמון', 'המסלול'];

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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405, origin);
  if (!SERVICE_ROLE)            return json({ error: 'not configured' }, 503, origin);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }

  const sid = String(body?.sid ?? '');
  if (!UUID.test(sid)) return json({ error: 'bad sid' }, 400, origin);

  // ─── ולידציה קשיחה. שום דבר מהדפדפן לא נכנס כמו שהוא ───
  const step = Math.max(0, Math.min(40, parseInt(body?.step, 10) || 0));

  const scores: (number | null)[] = Array.isArray(body?.scores)
    ? body.scores.slice(0, 5).map((v: any) => {
        const n = parseInt(v, 10);
        return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
      })
    : [];

  const answers: Record<string, string> = {};
  if (body?.answers && typeof body.answers === 'object') {
    for (const [k, v] of Object.entries(body.answers)) {
      if (!/^f[1-5]q[1-9]$/.test(k)) continue;             // רק מפתחות מוכרים
      if (typeof v !== 'string') continue;
      answers[k] = v.slice(0, 4000);
    }
  }

  const filled = scores.filter(s => s != null) as number[];
  let weakest: string | null = null;
  let avg: number | null = null;
  if (filled.length === 5) {
    const min = Math.min(...filled);
    weakest = FOUNDATIONS[scores.indexOf(min)] ?? null;
    avg = Math.round((filled.reduce((a, b) => a + b, 0) / 5) * 10) / 10;
  }

  const row: Record<string, unknown> = {
    sid, step, answers, weakest, avg_score: avg,
    scores: filled.length === 5 ? scores : [],
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300)
  };

  try {
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
      console.error('upsert', r.status, t.slice(0, 300));
      return json({ error: 'db' }, 502, origin);
    }
    return json({ ok: true }, 200, origin);
  } catch (e) {
    console.error('progress', e);
    return json({ error: 'internal' }, 500, origin);
  }
});
