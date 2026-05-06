-- Run this in your Supabase SQL Editor to set up the database

create table if not exists settings (
  id serial primary key,
  psa_cost decimal(10,2) not null default 25.00,
  updated_at timestamptz default now()
);

insert into settings (psa_cost) values (25.00)
  on conflict do nothing;

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  player text not null,
  year integer,
  set_name text,
  card_number text,
  variant text,
  sport text not null default 'Other',
  purchase_price decimal(10,2) not null,
  purchase_fees decimal(10,2) not null default 0,
  purchase_date date not null,
  source text,
  strategy text not null default 'flip',
  status text not null default 'owned',
  submitted_date date,
  returned_date date,
  psa_grade text,
  sale_price decimal(10,2),
  sale_fees decimal(10,2),
  sale_shipping decimal(10,2),
  platform text,
  sold_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cards_updated_at
  before update on cards
  for each row execute function update_updated_at();

create trigger settings_updated_at
  before update on settings
  for each row execute function update_updated_at();
