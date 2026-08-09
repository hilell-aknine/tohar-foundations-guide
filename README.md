# מודל היסודות השיווקיים — טוהר אקנין

מסע אינטראקטיבי בחמישה יסודות לבניית שיווק יציב.

**חי: https://tohar-foundations-guide.vercel.app/**

## מבנה
- `index.html` — מעטפת ועיצוב
- `content.js` — כל התוכן. **שינוי טקסט נעשה כאן בלבד.**
- `app.js` — מנוע: 22 שלבים, ניווט, שמירת מצב, אבחון, לכידת ליד, המורה
- `api/teacher.js` — המורה כפונקציית שרת ב-Vercel
- `supabase/` — סכמה ופונקציות ללכידת לידים (ממתין לטוקן גישה)

## פריסה
```bash
# נתיב עברי שובר את ה-CLI. עובדים מ-ASCII.
# שם התיקייה חייב להיות זהה לשם הפרויקט ב-Vercel, אחרת נוצר פרויקט כפול
rm -rf /c/temp/tohar-foundations-guide && mkdir -p /c/temp/tohar-foundations-guide
cp -r index.html app.js content.js vercel.json .vercelignore api assets /c/temp/tohar-foundations-guide/
cd /c/temp/tohar-foundations-guide
npx vercel@50.3.1 deploy --prod --yes --token "$VERCEL_TOKEN"
```

## אבטחה
`ANTHROPIC_API_KEY` הוא משתנה סביבה של Vercel בלבד ולעולם לא בקוד הצד-לקוח.
מפתח ה-anon של Supabase ציבורי בהגדרתו; כל הטבלאות ב-RLS deny-all וכל כתיבה עוברת Edge Function.

## פתוח
- קרדיט בחשבון אנתרופיק — המפתח תקף, החשבון ריק, ולכן המורה מחזירה "עוד לא זמינה".
- טוקן גישה לסופרבייס של טוהר — בלעדיו אין שמירת לידים, והטופס נופל לוואטסאפ.
