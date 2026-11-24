-- Run in the FLSHD Supabase project SQL editor.
begin;
create table if not exists public.flshd_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('progress','image','checkpoints')),
  record_id text not null check (length(record_id) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  changed_at timestamptz not null,
  primary key (user_id, kind, record_id),
  constraint flshd_payload_limit check (octet_length(payload::text) <= 650000)
);
alter table public.flshd_records enable row level security;
revoke all on public.flshd_records from anon, public;
grant select, insert, update on public.flshd_records to authenticated;
drop policy if exists flshd_read_own on public.flshd_records;
create policy flshd_read_own on public.flshd_records for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists flshd_insert_own on public.flshd_records;
create policy flshd_insert_own on public.flshd_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists flshd_update_own on public.flshd_records;
create policy flshd_update_own on public.flshd_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Retry-safe, per-record last-write-wins; checkpoint passes are monotonic.
create or replace function public.flshd_put_record(
  p_kind text, p_record_id text, p_payload jsonb, p_changed_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_changed_at is null then raise exception 'Timestamp required'; end if;
  if p_kind = 'checkpoints' and (p_record_id <> 'checkpoints-v3' or exists (
    select 1 from jsonb_each(p_payload) as x(k,v) where v <> 'true'::jsonb
  )) then raise exception 'Invalid checkpoint payload'; end if;
  insert into public.flshd_records as r(user_id,kind,record_id,payload,changed_at)
    values(auth.uid(),p_kind,p_record_id,p_payload,p_changed_at)
    on conflict(user_id,kind,record_id) do update set
      payload = case when excluded.kind = 'checkpoints'
        then r.payload || excluded.payload else excluded.payload end,
      changed_at = greatest(r.changed_at,excluded.changed_at)
    where excluded.kind = 'checkpoints' or excluded.changed_at >= r.changed_at;
end;
$$;
revoke all on function public.flshd_put_record(text,text,jsonb,timestamptz) from public, anon;
grant execute on function public.flshd_put_record(text,text,jsonb,timestamptz) to authenticated;
commit;
