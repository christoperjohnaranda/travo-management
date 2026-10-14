-- Jalankan skrip ini sekali di Supabase Dashboard → SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  plate_number text not null unique,
  color text not null,
  photo_url text,
  annual_tax_due date not null,
  stnk_five_year_due date not null,
  kir_status text not null default 'active',
  kir_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Dapat dijalankan ulang untuk memperbarui proyek yang tabel kendaraannya sudah dibuat.
alter table public.vehicles add column if not exists kir_status text not null default 'active';
alter table public.vehicles alter column kir_due drop not null;
alter table public.vehicles drop constraint if exists vehicles_kir_status_date_check;
alter table public.vehicles add constraint vehicles_kir_status_date_check check (
  (kir_status = 'active' and kir_due is not null)
  or (kir_status in ('missing', 'lost') and kir_due is null)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles
for each row execute procedure public.set_updated_at();

alter table public.vehicles enable row level security;

-- Proyek Supabase baru dapat menonaktifkan grant Data API otomatis.
-- Berikan akses minimum yang dibutuhkan aplikasi hanya kepada pengguna login.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;
revoke all on table public.vehicles from anon;

drop policy if exists "Authenticated users can view vehicles" on public.vehicles;
create policy "Authenticated users can view vehicles" on public.vehicles
for select to authenticated using (true);

drop policy if exists "Authenticated users can add vehicles" on public.vehicles;
create policy "Authenticated users can add vehicles" on public.vehicles
for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update vehicles" on public.vehicles;
create policy "Authenticated users can update vehicles" on public.vehicles
for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete vehicles" on public.vehicles;
create policy "Authenticated users can delete vehicles" on public.vehicles
for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage upsert memerlukan akses SELECT dan UPDATE selain INSERT.
drop policy if exists "Authenticated users can view vehicle photos" on storage.objects;
create policy "Authenticated users can view vehicle photos" on storage.objects
for select to authenticated using (bucket_id = 'vehicle-photos');

drop policy if exists "Authenticated users can upload vehicle photos" on storage.objects;
create policy "Authenticated users can upload vehicle photos" on storage.objects
for insert to authenticated with check (bucket_id = 'vehicle-photos');

drop policy if exists "Authenticated users can update vehicle photos" on storage.objects;
create policy "Authenticated users can update vehicle photos" on storage.objects
for update to authenticated using (bucket_id = 'vehicle-photos') with check (bucket_id = 'vehicle-photos');

drop policy if exists "Authenticated users can delete vehicle photos" on storage.objects;
create policy "Authenticated users can delete vehicle photos" on storage.objects
for delete to authenticated using (bucket_id = 'vehicle-photos');
