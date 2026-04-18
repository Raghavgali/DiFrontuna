create type public.ticket_severity as enum ('emergency', 'urgent', 'standard');
create type public.ticket_status as enum ('new', 'in_progress', 'resolved');
create type public.ticket_language as enum ('english', 'spanish', 'mandarin');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  caller_name text not null,
  caller_phone text,
  location text,
  severity public.ticket_severity not null default 'standard',
  language public.ticket_language not null default 'english',
  category text not null,
  summary text not null,
  transcript text not null,
  routing text not null,
  assigned_to text,
  status public.ticket_status not null default 'new',
  description text
);

alter table public.tickets enable row level security;

create policy "Anyone can view tickets"
  on public.tickets for select
  using (true);

create policy "Anyone can insert tickets"
  on public.tickets for insert
  with check (true);

create policy "Anyone can update tickets"
  on public.tickets for update
  using (true);

create policy "Anyone can delete tickets"
  on public.tickets for delete
  using (true);