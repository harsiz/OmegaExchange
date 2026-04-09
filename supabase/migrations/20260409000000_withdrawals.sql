create table if not exists public.withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references public.users(id),
  amount          numeric(18,8) not null check (amount > 0),
  paypal_address  text not null,
  status          text not null default 'pending' check (status in ('pending','completed','rejected')),
  admin_note      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.withdrawals enable row level security;
