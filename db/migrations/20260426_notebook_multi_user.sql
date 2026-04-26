-- Notebook multi-user migration
-- 1) Support idempotent guest-note migration
alter table notes
  add column if not exists client_note_id text;

create unique index if not exists notes_user_client_note_unique_idx
  on notes(user_id, client_note_id)
  where client_note_id is not null;

-- 2) Move note access control to RLS
alter table notes enable row level security;

drop policy if exists notes_select_own on notes;
create policy notes_select_own
  on notes
  for select
  using (auth.uid() = user_id);

drop policy if exists notes_insert_own on notes;
create policy notes_insert_own
  on notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists notes_update_own on notes;
create policy notes_update_own
  on notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notes_delete_own on notes;
create policy notes_delete_own
  on notes
  for delete
  using (auth.uid() = user_id);
