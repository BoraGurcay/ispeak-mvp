-- iSpeak MVP schema
-- Run this in Supabase SQL editor.

-- 1) Starter terms (seeded by admin/import)
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  source_lang text not null default 'en',
  target_lang text not null default 'tr',
  domain text not null check (domain in ('court','immigration','family')),
  difficulty int not null default 1 check (difficulty between 1 and 3),
  source_text text not null,
  target_text text not null,
  plain_meaning_en text,
  plain_meaning_tr text,
  example_en text,
  example_tr text,
  tags text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

-- Enable RLS for terms, but allow public read (auth or anon)
alter table public.terms enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='terms' and policyname='terms_read_all'
  ) then
    create policy terms_read_all on public.terms
      for select
      using (true);
  end if;
end $$;

-- Only service role should insert/update/delete terms (handled by Supabase)
-- (No explicit policy means normal users cannot write)

-- 2) User glossary terms
create table if not exists public.user_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('court','immigration','family')),
  source_text text not null,
  target_text text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_terms_user on public.user_terms(user_id);
create index if not exists idx_user_terms_domain on public.user_terms(domain);

alter table public.user_terms enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_terms' and policyname='user_terms_read_own'
  ) then
    create policy user_terms_read_own on public.user_terms
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_terms' and policyname='user_terms_insert_own'
  ) then
    create policy user_terms_insert_own on public.user_terms
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_terms' and policyname='user_terms_update_own'
  ) then
    create policy user_terms_update_own on public.user_terms
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_terms' and policyname='user_terms_delete_own'
  ) then
    create policy user_terms_delete_own on public.user_terms
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Auto-set user_id + updated_at
create or replace function public.set_user_terms_defaults()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    new.user_id := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  elsif (tg_op = 'UPDATE') then
    new.updated_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_user_terms_defaults on public.user_terms;
create trigger trg_user_terms_defaults
before insert or update on public.user_terms
for each row execute procedure public.set_user_terms_defaults();
