-- Drop old tables if they exist from previous iteration
drop table if exists players cascade;
drop table if exists rooms cascade;
drop table if exists boards cascade;

-- Boards: templates + user-created boards
create table boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  player_count smallint not null check (player_count between 2 and 4),
  board_size smallint not null default 9,
  cells jsonb not null default '[]',
  rules jsonb default '{}',
  is_template boolean not null default false,
  created_at timestamptz not null default now()
);

alter table boards enable row level security;

create policy "boards_select" on boards for select to anon using (true);
create policy "boards_insert" on boards for insert to anon with check (true);
create policy "boards_update" on boards for update to anon using (true);
create policy "boards_delete" on boards for delete to anon using (true);

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  board_id uuid not null references boards(id),
  host_id text not null,
  player_count smallint not null default 2,
  max_players smallint not null default 4,
  game_state jsonb not null default '{}',
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rooms enable row level security;

create policy "rooms_select" on rooms for select to anon using (true);
create policy "rooms_insert" on rooms for insert to anon with check (true);
create policy "rooms_update" on rooms for update to anon using (true);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  color text not null,
  player_index smallint not null,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now()
);

alter table players enable row level security;

create policy "players_select" on players for select to anon using (true);
create policy "players_insert" on players for insert to anon with check (true);
create policy "players_update" on players for update to anon using (true);
create policy "players_delete" on players for delete to anon using (true);

-- Indexes
create index if not exists idx_rooms_code on rooms(code);
create index if not exists idx_players_room on players(room_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_rooms_updated_at on rooms;
create trigger trg_rooms_updated_at before update on rooms
  for each row execute function update_updated_at();

-- Realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
