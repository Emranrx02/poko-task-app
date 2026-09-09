# Poko GitHub ও Vercel setup

## Computer-এ প্রথমে চালাও

Poko folder-এ Terminal খুলে:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell হলে `cp .env.example .env.local`-এর বদলে চালাবে:

```powershell
Copy-Item .env.example .env.local
```

তারপর browser-এ `http://localhost:3000` খুলো। শুধু `npm run` দিলে app চালু হয় না; command হবে `npm run dev`।

## Supabase

Supabase-এ নতুন project বানিয়ে **SQL Editor**-এ `supabase/schema.sql` file-এর সব code paste করে Run করবে। **Project Settings → API** থেকে Project URL এবং `service_role` key নিয়ে `.env.local` file-এ বসাবে:

```env
NEXT_PUBLIC_SUPABASE_URL=তোমার_PROJECT_URL
SUPABASE_SERVICE_ROLE_KEY=তোমার_SERVICE_ROLE_KEY
```

`service_role` key কখনো GitHub-এ upload করবে না। `.gitignore` file `.env.local` আটকে দেবে।

## GitHub push

GitHub-এ `poko-task-app` নামে Private repository বানাও। README initialize করবে না। এরপর Terminal-এ:

```bash
git init
git add .
git commit -m "Build Poko task companion"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/poko-task-app.git
git push -u origin main
```

## Vercel

Vercel → **Add New → Project** → GitHub-এর `poko-task-app` import করো। Settings → Environment Variables-এ Supabase-এর দুইটি value বসিয়ে Deploy করো।

Vercel link PC এবং mobile-এ খুলো। প্রথমবার Poko একটি private sync code চাইবে। দুই device-এ একই code দিলে একই task দেখাবে।
