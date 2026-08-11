# פריסת הבקאנד — מוכן להרצה

**פרויקט:** `llhgjyskcuedommznwqg` (הפרויקט הייעודי של טוהר)

## חסר כדי להריץ
| מה | מאיפה |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens — **בחשבון שבו נפתח הפרויקט**. אף אחד מ-14 הטוקנים ב-`.secrets` לא רואה אותו. |
| קרדיט בחשבון אנתרופיק | המפתח **תקף** (אומת 9.8.2026) אבל החשבון מחזיר `credit balance is too low`. |

## הרצה
נתיב עברי שובר את ה-CLI של Supabase. לעבוד מנתיב ASCII:

```bash
mkdir -p /c/temp/tohar-guide
cp -r "…/interactive-guide/supabase" /c/temp/tohar-guide/
cd /c/temp/tohar-guide

export SUPABASE_ACCESS_TOKEN=sbp_…
npx supabase link --project-ref llhgjyskcuedommznwqg
npx supabase db push

# סודות — לעולם לא בפרונט
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-… --project-ref llhgjyskcuedommznwqg
npx supabase secrets set TOHAR_NOTIFY_PHONE=972547471300 --project-ref llhgjyskcuedommznwqg
# אופציונלי, להתראות וואטסאפ (המופע פג — הליד נשמר גם בלי זה):
# npx supabase secrets set GREEN_API_URL=… GREEN_API_INSTANCE=… GREEN_API_TOKEN=…

npx supabase functions deploy guide-progress --no-verify-jwt --project-ref llhgjyskcuedommznwqg
npx supabase functions deploy guide-lead     --no-verify-jwt --project-ref llhgjyskcuedommznwqg
```

## אימות אחרי הפריסה
2. למלא את טופס הליד עם מספר אמיתי → לוודא שורה ב-`guide_sessions` עם `is_lead = true`.
3. לוודא שהטלפון נשמר בפורמט `9725XXXXXXXX`.

## חוקי ברזל
- 🔴 `ANTHROPIC_API_KEY` הוא secret של Edge Function בלבד. **לעולם לא ב-`app.js`.**
- כל הטבלאות ב-RLS deny-all. anon לא קורא ולא כותב ישירות.
- `ALLOWED` בכל פונקציה מגביל את ה-CORS. להוסיף דומיין חדש שם אם המדריך עובר כתובת.
