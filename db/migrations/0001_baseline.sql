-- Baseline: the schema as it stood before migrations were versioned.
-- Every statement is idempotent so existing databases pass through untouched
-- and a fresh database for a new factory is created from scratch.

create table if not exists people (
  id serial primary key,
  name text not null,
  role text not null,
  dept text not null
);

create table if not exists inquiries (
  id serial primary key,
  code text not null,
  buyer text not null,
  from_email text,
  subject text,
  body text not null,
  style text,
  fabric text,
  quantity integer,
  ship_date date,
  target_price double precision,
  fields jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  confirmed_by integer,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id serial primary key,
  code text not null,
  inquiry_id integer,
  buyer text not null,
  style text not null,
  quantity integer not null,
  rev integer not null default 1,
  fabric_kg double precision not null default 0,
  fabric_rate double precision not null default 0,
  cm_minutes double precision not null default 0,
  cm_rate double precision not null default 0,
  trims double precision not null default 0,
  overhead double precision not null default 0,
  fob double precision not null default 0,
  floor_margin double precision not null default 16,
  status text not null default 'draft',
  released_by integer,
  released_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id serial primary key,
  code text not null,
  quote_id integer,
  buyer text not null,
  style text not null,
  fabric text,
  quantity integer not null,
  sizes jsonb not null default '{}'::jsonb,
  ship_date date not null,
  fob double precision not null,
  stage text not null default 'order',
  tna_committed boolean not null default false,
  pp_signed_by integer,
  pp_signed_at timestamptz,
  realised_amount double precision,
  btb_settled double precision,
  air_freight double precision,
  discount double precision,
  realised_at date,
  closed_at timestamptz,
  plan_lines integer not null default 4,
  plan_per_line_day integer not null default 900,
  plan_fabric_lead_days integer not null default 25,
  created_at timestamptz not null default now()
);

create table if not exists lc_amendments (
  id serial primary key,
  lc_id integer not null,
  order_id integer not null,
  no integer not null,
  field text not null,
  old_value text,
  new_value text not null,
  reason text not null,
  created_by integer,
  created_at timestamptz not null default now()
);

create table if not exists bond_ledger (
  id serial primary key,
  order_id integer not null,
  ud_id integer not null,
  kind text not null,
  material text not null,
  qty_kg double precision not null,
  ref text not null,
  on_date date not null,
  created_by integer,
  created_at timestamptz not null default now()
);

create table if not exists cartons (
  id serial primary key,
  order_id integer not null,
  carton_from integer not null,
  carton_to integer not null,
  size text not null,
  pcs_per_carton integer not null,
  net_kg double precision not null,
  gross_kg double precision not null,
  cbm double precision not null,
  created_by integer,
  created_at timestamptz not null default now()
);

create table if not exists tech_packs (
  id serial primary key,
  order_id integer not null,
  body text not null,
  data jsonb not null,
  reader text not null default 'ai',
  trims_added boolean not null default false,
  created_by integer,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id serial primary key,
  order_id integer not null,
  number text not null,
  issued_on date not null,
  quantity integer not null,
  unit_price double precision not null,
  amount double precision not null,
  description text not null,
  exp text,
  status text not null default 'draft',
  created_by integer,
  created_at timestamptz not null default now()
);

create table if not exists tna (
  id serial primary key,
  order_id integer not null,
  name text not null,
  owner_dept text not null,
  due_date date not null,
  done_at date,
  sort integer not null default 0
);

create table if not exists lcs (
  id serial primary key,
  kind text not null,
  number text not null,
  order_id integer,
  master_id integer,
  amount double precision not null,
  tenor_days integer not null default 0,
  bank text,
  status text not null default 'requested',
  opened_at date,
  latest_shipment date,
  port_loading text,
  port_discharge text,
  description text,
  quantity integer,
  maturity date,
  settled_amount double precision,
  created_at timestamptz not null default now()
);

create table if not exists ud (
  id serial primary key,
  number text not null,
  order_id integer not null,
  yarn_permitted_kg double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists bom (
  id serial primary key,
  order_id integer not null,
  material text not null,
  qty double precision not null,
  unit text not null,
  rate double precision not null default 0,
  supplier text,
  source text not null default 'import',
  status text not null default 'pending',
  btb_id integer,
  booked_by integer,
  booked_at timestamptz
);

create table if not exists lays (
  id serial primary key,
  order_id integer not null,
  lay_no integer not null,
  plies integer not null,
  marker_eff double precision not null,
  ratio jsonb not null default '{}'::jsonb,
  status text not null default 'running',
  bundle_from integer not null,
  bundle_to integer not null,
  created_at timestamptz not null default now()
);

create table if not exists sewing (
  id serial primary key,
  order_id integer not null,
  line integer not null,
  hour_at timestamptz not null,
  target integer not null,
  actual integer not null,
  downtime_min integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists defects (
  id serial primary key,
  order_id integer not null,
  line integer not null,
  code text not null,
  label text not null,
  count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists lots (
  id serial primary key,
  order_id integer not null,
  lot_size integer not null,
  aql double precision not null,
  sample integer not null,
  major integer not null,
  accept_max integer not null,
  result text not null,
  decided_by integer,
  created_at timestamptz not null default now()
);

create table if not exists bl (
  id serial primary key,
  order_id integer not null,
  lc_id integer,
  port_loading text not null,
  port_discharge text not null,
  quantity integer not null,
  description text not null,
  on_board date not null,
  status text not null default 'draft',
  released_by integer,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists machines (
  id serial primary key,
  code text not null,
  line integer not null,
  kind text not null,
  status text not null default 'running'
);

create table if not exists tickets (
  id serial primary key,
  machine_id integer not null,
  issue text not null,
  mechanic text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  downtime_min integer
);

create table if not exists employees (
  id serial primary key,
  code text not null,
  name text not null,
  grade integer not null,
  section text not null,
  line integer,
  days_present integer not null default 26,
  ot_hours double precision not null default 0
);

create table if not exists audit (
  id serial primary key,
  at timestamptz not null default now(),
  actor_id integer,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id integer,
  detail text
);
