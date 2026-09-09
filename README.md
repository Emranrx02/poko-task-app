# Poko — Make Your Day Count

Vercel-ready personal task companion with light/night mode, mobile–PC sync, scheduled reminders, calm tunes, completion animation, and a floating desktop widget.

## Run on your computer

Install Node.js 20 or newer. Open Terminal inside this folder and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of the `cp` command.

Open `http://localhost:3000`. Task sync needs the Supabase setup below.

## Supabase setup

1. Create a free project at Supabase.
2. Open **SQL Editor**, paste everything from `supabase/schema.sql`, and press **Run**.
3. Open **Project Settings → API** and copy the Project URL and `service_role` key.
4. Put them in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Never commit `.env.local` or show the service role key publicly.

## Deploy to Vercel

1. Push this folder to a private GitHub repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Add the same two variables in **Settings → Environment Variables**.
4. Deploy.
5. Open the Vercel link on your PC and phone. Enter the exact same private Poko sync code on both devices.

## Reminder behavior

Poko plays a gentle three-note tune at the chosen time when sound is on. **Start task** closes the reminder. Completion plays a separate success chime and animation. Browser sound requires you to turn it on once. Keep Poko open for exact-time reminders; sleeping devices and suspended tabs may delay them.

Desktop Chrome and Edge support the always-on-top floating widget. Keep the original Poko tab open while using it.
