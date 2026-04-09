-- ═══════════════════════════════════════════════════════
--  OmegaExchange — Initial Schema
--  Migration: 20260408000000_initial_schema
-- ═══════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── USERS ──────────────────────────────────────────────
create table if not exists public.users (
    id          text primary key,
    username    text not null,
    avatar_url  text,
    is_admin    boolean default false,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- ─── REPUTATION ─────────────────────────────────────────
create table if not exists public.reputation (
    user_id           text primary key references public.users(id) on delete cascade,
    total_trades      int     default 0,
    successful_trades int     default 0,
    disputed_trades   int     default 0,
    rating            numeric default 5.0,
    updated_at        timestamptz default now()
);

-- ─── BALANCES (on-site USD) ──────────────────────────────
create table if not exists public.balances (
    user_id     text primary key references public.users(id) on delete cascade,
    usd_balance numeric default 0 check (usd_balance >= 0),
    updated_at  timestamptz default now()
);

-- ─── CRYPTO HOLDINGS ────────────────────────────────────
create table if not exists public.crypto_holdings (
    id          uuid primary key default gen_random_uuid(),
    user_id     text references public.users(id) on delete cascade,
    currency    text not null,
    amount      numeric default 0 check (amount >= 0),
    updated_at  timestamptz default now(),
    unique (user_id, currency)
);

-- ─── DEPOSITS ────────────────────────────────────────────
create table if not exists public.deposits (
    id          uuid primary key default gen_random_uuid(),
    user_id     text references public.users(id) on delete cascade,
    amount      numeric not null check (amount > 0),
    method      text not null check (method in ('paypal', 'giftcard')),
    reference   text not null,
    status      text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
    notes       text,
    reviewed_by text references public.users(id),
    reviewed_at timestamptz,
    created_at  timestamptz default now()
);

-- ─── SELL OFFERS ─────────────────────────────────────────
create table if not exists public.offers (
    id                   uuid primary key default gen_random_uuid(),
    seller_id            text not null references public.users(id) on delete cascade,
    currency             text not null default 'BTC',
    price                numeric not null check (price > 0),
    min_amount           numeric not null check (min_amount > 0),
    max_amount           numeric not null check (max_amount >= min_amount),
    available_amount     numeric not null check (available_amount >= 0),
    payment_methods      text[] default '{}',
    payment_instructions text default '',
    is_active            boolean default true,
    trades_count         int default 0,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now()
);

create index if not exists offers_currency_idx on public.offers(currency);
create index if not exists offers_seller_idx   on public.offers(seller_id);
create index if not exists offers_active_idx   on public.offers(is_active) where is_active = true;

-- ─── TRADES ──────────────────────────────────────────────
create table if not exists public.trades (
    id            uuid primary key default gen_random_uuid(),
    offer_id      uuid references public.offers(id),
    buyer_id      text not null references public.users(id),
    seller_id     text not null references public.users(id),
    currency      text not null default 'BTC',
    amount        numeric not null check (amount > 0),
    usd_amount    numeric,
    price         numeric not null check (price > 0),
    status        text not null default 'pending'
                    check (status in ('pending', 'paid', 'completed', 'disputed', 'cancelled')),
    escrow_locked boolean default false,
    tatum_escrow_id text,
    paid_at       timestamptz,
    completed_at  timestamptz,
    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
);

create index if not exists trades_buyer_idx  on public.trades(buyer_id);
create index if not exists trades_seller_idx on public.trades(seller_id);
create index if not exists trades_status_idx on public.trades(status);
create index if not exists trades_offer_idx  on public.trades(offer_id);

-- ─── TRADE MESSAGES ──────────────────────────────────────
create table if not exists public.trade_messages (
    id          uuid primary key default gen_random_uuid(),
    trade_id    uuid not null references public.trades(id) on delete cascade,
    sender_id   text not null references public.users(id),
    message     text not null check (length(message) <= 2000),
    created_at  timestamptz default now()
);

create index if not exists messages_trade_idx on public.trade_messages(trade_id);

-- ─── DISPUTES ────────────────────────────────────────────
create table if not exists public.disputes (
    id          uuid primary key default gen_random_uuid(),
    trade_id    uuid not null references public.trades(id) on delete cascade,
    opened_by   text not null references public.users(id),
    reason      text not null,
    status      text not null default 'open' check (status in ('open', 'resolved', 'closed')),
    resolution  text,
    resolved_by text references public.users(id),
    created_at  timestamptz default now(),
    resolved_at timestamptz
);

create index if not exists disputes_trade_idx  on public.disputes(trade_id);
create index if not exists disputes_status_idx on public.disputes(status);

-- ─── NOTIFICATIONS ───────────────────────────────────────
create table if not exists public.notifications (
    id           uuid primary key default gen_random_uuid(),
    user_id      text not null references public.users(id) on delete cascade,
    title        text not null,
    message      text not null,
    type         text,
    reference_id text,
    read         boolean default false,
    created_at   timestamptz default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(user_id, read);

-- ─── SUPPORTED CURRENCIES ───────────────────────────────
create table if not exists public.supported_currencies (
    symbol       text primary key,
    name         text not null,
    is_active    boolean default true,
    coingecko_id text
);

insert into public.supported_currencies (symbol, name, coingecko_id) values
    ('BTC',  'Bitcoin',  'bitcoin'),
    ('ETH',  'Ethereum', 'ethereum'),
    ('LTC',  'Litecoin', 'litecoin'),
    ('SOL',  'Solana',   'solana'),
    ('USDT', 'Tether',   'tether'),
    ('XRP',  'XRP',      'ripple')
on conflict (symbol) do nothing;

-- ═══════════════════════════════════════════════════════
--  FUNCTIONS
-- ═══════════════════════════════════════════════════════

create or replace function increment_trade_stats(p_user_id text)
returns void language plpgsql as $$
begin
    insert into public.reputation (user_id, total_trades, successful_trades)
    values (p_user_id, 1, 1)
    on conflict (user_id) do update
        set total_trades      = reputation.total_trades + 1,
            successful_trades = reputation.successful_trades + 1,
            updated_at        = now();
end;
$$;

create or replace function increment_crypto_balance(p_user_id text, p_currency text, p_amount numeric)
returns void language plpgsql as $$
begin
    insert into public.crypto_holdings (user_id, currency, amount)
    values (p_user_id, p_currency, p_amount)
    on conflict (user_id, currency) do update
        set amount     = crypto_holdings.amount + p_amount,
            updated_at = now();
end;
$$;

create or replace function restore_offer_amount(p_offer_id uuid, p_amount numeric)
returns void language plpgsql as $$
begin
    update public.offers
    set available_amount = available_amount + p_amount,
        updated_at       = now()
    where id = p_offer_id;
end;
$$;

create or replace function approve_deposit(p_deposit_id uuid, p_admin_id text)
returns void language plpgsql as $$
declare
    v_deposit public.deposits%rowtype;
begin
    select * into v_deposit from public.deposits
    where id = p_deposit_id and status = 'pending';
    if not found then
        raise exception 'Deposit not found or already processed';
    end if;

    update public.deposits
    set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
    where id = p_deposit_id;

    insert into public.balances (user_id, usd_balance)
    values (v_deposit.user_id, v_deposit.amount)
    on conflict (user_id) do update
        set usd_balance = balances.usd_balance + v_deposit.amount,
            updated_at  = now();
end;
$$;

-- ═══════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  All tables have RLS enabled. No anon/authenticated
--  policies are defined — the public can read nothing.
--  All data access goes through the server (service_role
--  key), which bypasses RLS entirely.
-- ═══════════════════════════════════════════════════════
alter table public.users              enable row level security;
alter table public.reputation         enable row level security;
alter table public.balances           enable row level security;
alter table public.offers             enable row level security;
alter table public.trades             enable row level security;
alter table public.trade_messages     enable row level security;
alter table public.disputes           enable row level security;
alter table public.notifications      enable row level security;
alter table public.deposits           enable row level security;
alter table public.crypto_holdings    enable row level security;
alter table public.supported_currencies enable row level security;

-- Allow anyone to read supported currencies (public data)
create policy "public can read currencies"
    on public.supported_currencies for select
    using (true);
