# iSpeak MVP (Web App)
Mobile-first glossary + practice app for interpreters (EN ↔ TR) with login (Supabase).

## What you get
- Email/password auth (Supabase)
- Starter deck ("terms") + user glossary ("user_terms")
- Practice: Flashcards + Multiple Choice
- Glossary: search + add/edit/delete your own entries

## Quick start
1) Create a Supabase project
2) Run SQL from `supabase/schema.sql` in Supabase SQL editor
3) Copy `.env.example` to `.env.local` and fill values
4) Install & run:
   - `npm install`
   - `npm run dev`
5) Seed starter terms:
   - Option A (recommended): Supabase Dashboard → Table editor → `terms` → Import data → upload `data/terms_seed.csv`
   - Option B (script): `npm run seed` (requires Service Role key; see `.env.example`)

## Notes
- This app is designed to be extended (Premium AI explainer, subscriptions, invoice tools).
- We'll keep policy content as guidance only (e.g., ethics/conflict reminders), not as reproduced manual text. 
