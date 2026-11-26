-- Makes the system configurable per factory and garment-agnostic:
-- factory profile and branding, settings, custom roles, a floor plan,
-- atomic document numbering, and units/categories instead of knit-only columns.

create table if not exists factory (
  id integer primary key default 1 check (id = 1),
  name text not null,
  name_en text,
  tagline text,
  address text,
  phone text,
  email text,
  website text,
  bin text,
  erc text,
  irc text,
  membership text,
  accent text not null default 'indigo',
  logo bytea,
  logo_type text,
  logo_version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by integer,
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id serial primary key,
  key text not null unique,
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  is_owner boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists floors (
  id serial primary key,
  name text not null,
  building text,
  sort integer not null default 0
);

create table if not exists lines (
  id serial primary key,
  floor_id integer not null,
  name text not null,
  kind text not null default 'sewing',
  hourly_target integer not null default 100,
  operators integer not null default 0,
  active boolean not null default true,
  sort integer not null default 0
);

create table if not exists counters (
  key text primary key,
  value integer not null
);

-- Staff accounts
alter table people add column if not exists email text;
alter table people add column if not exists phone text;
alter table people add column if not exists active boolean not null default true;
alter table people add column if not exists user_id text;
create unique index if not exists people_user_id_key on people (user_id) where user_id is not null;
create unique index if not exists people_email_key on people (lower(email)) where email is not null;

-- Garment-agnostic columns
alter table inquiries add column if not exists category text;
alter table quotes add column if not exists category text;
alter table quotes add column if not exists fabric_unit text not null default 'kg';
alter table orders add column if not exists category text;
alter table bom add column if not exists kind text not null default 'trim';
alter table ud add column if not exists material text not null default 'সুতা';
alter table ud add column if not exists permitted_unit text not null default 'kg';
alter table bond_ledger add column if not exists unit text not null default 'kg';
alter table lots add column if not exists level text not null default 'II';
alter table tna add column if not exists label text;
alter table machines alter column line drop not null;

-- Milestone and defect labels are snapshotted on the row so editing a template never rewrites history.
update tna set label = case name
  when 'lab dip approval' then 'ল্যাব ডিপ অনুমোদন'
  when 'master lc received' then 'মাস্টার এলসি প্রাপ্তি'
  when 'btb lc opened' then 'বিটুবি এলসি খোলা'
  when 'fabric booking' then 'কাপড় বুকিং'
  when 'trims booking' then 'ট্রিমস বুকিং'
  when 'fabric in-house' then 'কাপড় কারখানায় পৌঁছানো'
  when 'pp sample approval' then 'পিপি স্যাম্পল অনুমোদন'
  when 'pp meeting' then 'পিপি মিটিং'
  when 'bulk cutting start' then 'বাল্ক কাটিং শুরু'
  when 'sewing start' then 'সেলাই শুরু'
  when 'sewing complete' then 'সেলাই সম্পন্ন'
  when 'final inspection' then 'চূড়ান্ত পরিদর্শন'
  when 'ex-factory' then 'এক্স-ফ্যাক্টরি'
  else name end
where label is null;

update defects set label = case code
  when 'D01' then 'সেলাই খোলা'
  when 'D02' then 'ফোঁড় বাদ পড়া'
  when 'D03' then 'সেলাই ছেঁড়া'
  when 'D04' then 'হেম অসমান'
  when 'D05' then 'তেলের দাগ'
  when 'D06' then 'রঙের তারতম্য'
  when 'D07' then 'মাপ ভুল'
  when 'D08' then 'কুঁচকানো'
  when 'D09' then 'লেবেল ভুল জায়গায়'
  else label end
where label ~ '^[a-z ]+$';

update bom set kind = 'fabric' where kind = 'trim' and unit in ('kg', 'yd', 'm', 'lb');

update orders set category = case
  when concat_ws(' ', style, fabric) ~* '(denim|jean)' then 'denim'
  when concat_ws(' ', style, fabric) ~* '(chino|trouser|pant|twill)' then 'woven-bottom'
  when concat_ws(' ', style, fabric) ~* '(sweatshirt|fleece|hoodie)' then 'knit-fleece'
  when concat_ws(' ', style, fabric) ~* '(sweater|cardigan|pullover)' then 'sweater'
  when concat_ws(' ', style, fabric) ~* '(jacket|parka|coat)' then 'outerwear'
  else 'knit-top' end
where category is null;

update quotes set category = case
  when style ~* '(denim|jean)' then 'denim'
  when style ~* '(chino|trouser|pant|twill)' then 'woven-bottom'
  when style ~* '(sweatshirt|fleece|hoodie)' then 'knit-fleece'
  when style ~* '(sweater|cardigan|pullover)' then 'sweater'
  when style ~* '(jacket|parka|coat)' then 'outerwear'
  else 'knit-top' end
where category is null;

update inquiries set category = case
  when concat_ws(' ', style, fabric, subject, body) ~* '(denim|jean)' then 'denim'
  when concat_ws(' ', style, fabric, subject, body) ~* '(chino|trouser|pant|twill)' then 'woven-bottom'
  when concat_ws(' ', style, fabric, subject, body) ~* '(sweatshirt|fleece|hoodie)' then 'knit-fleece'
  when concat_ws(' ', style, fabric, subject, body) ~* '(sweater|cardigan|pullover)' then 'sweater'
  when concat_ws(' ', style, fabric, subject, body) ~* '(jacket|parka|coat)' then 'outerwear'
  else 'knit-top' end
where category is null;

-- Existing installs: give the factory a profile, and turn the bare line numbers
-- used by machines, output, defects and workers into real lines on a first floor.
insert into factory (id, name, name_en)
select 1, 'নমুনা অ্যাপারেলস লিমিটেড', 'Sample Apparels Ltd.'
where exists (select 1 from people)
on conflict (id) do nothing;

insert into floors (id, name, sort)
select 1, 'ফ্লোর ১', 0
where not exists (select 1 from floors)
  and exists (
    select 1 from machines
    union all select 1 from sewing
    union all select 1 from defects
    union all select 1 from employees where line is not null
  );

insert into lines (id, floor_id, name, kind, hourly_target, sort)
select l, 1, 'লাইন ' || translate(l::text, '0123456789', '০১২৩৪৫৬৭৮৯'), 'sewing', 120, l
from (
  select line as l from machines where line is not null
  union select line from sewing
  union select line from defects
  union select line from employees where line is not null
) used
where exists (select 1 from floors where id = 1)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('floors', 'id'), greatest((select coalesce(max(id), 0) from floors), 1), (select count(*) > 0 from floors));
select setval(pg_get_serial_sequence('lines', 'id'), greatest((select coalesce(max(id), 0) from lines), 1), (select count(*) > 0 from lines));

-- Codes must never collide, even under concurrent writes.
create unique index if not exists inquiries_code_key on inquiries (code);
create unique index if not exists quotes_code_key on quotes (code);
create unique index if not exists orders_code_key on orders (code);
create unique index if not exists invoices_number_key on invoices (number);
create unique index if not exists employees_code_key on employees (code);
create unique index if not exists machines_code_key on machines (code);

-- Foreign-key lookups that every order page and dashboard makes.
create index if not exists tna_order_id_idx on tna (order_id);
create index if not exists bom_order_id_idx on bom (order_id);
create index if not exists lcs_order_id_idx on lcs (order_id);
create index if not exists ud_order_id_idx on ud (order_id);
create index if not exists lays_order_id_idx on lays (order_id);
create index if not exists sewing_order_id_idx on sewing (order_id);
create index if not exists sewing_hour_at_idx on sewing (hour_at);
create index if not exists defects_order_id_idx on defects (order_id);
create index if not exists lots_order_id_idx on lots (order_id);
create index if not exists bl_order_id_idx on bl (order_id);
create index if not exists lc_amendments_lc_id_idx on lc_amendments (lc_id);
create index if not exists bond_ledger_order_id_idx on bond_ledger (order_id);
create index if not exists cartons_order_id_idx on cartons (order_id);
create index if not exists invoices_order_id_idx on invoices (order_id);
create index if not exists tech_packs_order_id_idx on tech_packs (order_id);
create index if not exists tickets_machine_id_idx on tickets (machine_id);
create index if not exists machines_line_idx on machines (line);
create index if not exists lines_floor_id_idx on lines (floor_id);
create index if not exists audit_at_idx on audit (at desc);
