create table if not exists public.tasks (
  id uuid primary key,
  user_id text not null,
  title text not null,
  note text not null default '',
  task_date date not null,
  starts_at bigint,
  status text not null default 'pending' check (status in ('pending','active','completed')),
  completed_at bigint,
  created_at bigint not null,
  updated_at bigint not null,
  version integer not null default 1
);
create index if not exists idx_tasks_user_date on public.tasks(user_id,task_date);
alter table public.tasks enable row level security;
