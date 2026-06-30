-- Migracion base para Prestamos Keydi.
-- Ejecutar en Supabase SQL Editor con un usuario propietario del proyecto.

alter table clientes
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists fecha_creacion timestamptz default now(),
  add column if not exists fecha_actualizacion timestamptz default now();

alter table avales
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists fecha_creacion timestamptz default now(),
  add column if not exists fecha_actualizacion timestamptz default now();

alter table prestamos
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists cliente_id uuid references clientes(id),
  add column if not exists aval_id uuid references avales(id),
  add column if not exists monto numeric(14,2) default 0,
  add column if not exists interes_porcentaje numeric(8,2) default 0,
  add column if not exists interes_total numeric(14,2) default 0,
  add column if not exists plazo_meses integer default 1,
  add column if not exists frecuencia text default 'MENSUAL',
  add column if not exists frecuencia_pago text default 'MENSUAL',
  add column if not exists fecha_contrato date default current_date,
  add column if not exists fecha_inicio date default current_date,
  add column if not exists fecha_inicio_pago date default current_date,
  add column if not exists mora_periodo numeric(14,2) default 0,
  add column if not exists total_pagar numeric(14,2) default 0,
  add column if not exists saldo numeric(14,2) default 0,
  add column if not exists estado text default 'ACTIVO',
  add column if not exists estado_documental text default 'BORRADOR',
  add column if not exists firma_acreedora_url text,
  add column if not exists firma_acreedora_alto integer default 96,
  add column if not exists firma_deudor_url text,
  add column if not exists firma_aval_url text,
  add column if not exists fecha_creacion timestamptz default now(),
  add column if not exists fecha_actualizacion timestamptz default now();

alter table cuotas
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists prestamo_id uuid references prestamos(id) on delete cascade,
  add column if not exists numero integer default 1,
  add column if not exists fecha_vencimiento date,
  add column if not exists capital numeric(14,2) default 0,
  add column if not exists interes numeric(14,2) default 0,
  add column if not exists total numeric(14,2) default 0,
  add column if not exists pagado numeric(14,2) default 0,
  add column if not exists estado text default 'PENDIENTE',
  add column if not exists fecha_pago date,
  add column if not exists fecha_creacion timestamptz default now(),
  add column if not exists fecha_actualizacion timestamptz default now();

alter table pagos
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists prestamo_id uuid references prestamos(id) on delete cascade,
  add column if not exists cuota_id uuid references cuotas(id) on delete set null,
  add column if not exists fecha date default current_date,
  add column if not exists monto numeric(14,2) default 0,
  add column if not exists metodo text default 'EFECTIVO',
  add column if not exists observacion text,
  add column if not exists fecha_creacion timestamptz default now(),
  add column if not exists fecha_actualizacion timestamptz default now();

create table if not exists configuracion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre text not null default 'KEYDI SIOMARA IRIAS GARCÍA',
  identidad text not null default '0801199215516',
  direccion text,
  telefono text,
  ciudad text,
  correo text,
  cuenta_bancaria text,
  logo_url text,
  firma_url text,
  firma_alto integer default 96,
  mostrar_firma_acreedora boolean default true,
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

alter table configuracion
  add column if not exists firma_alto integer default 96,
  add column if not exists mostrar_firma_acreedora boolean default true;

create index if not exists clientes_user_id_idx on clientes(user_id);
create index if not exists avales_user_id_idx on avales(user_id);
create index if not exists prestamos_user_id_idx on prestamos(user_id);
create index if not exists cuotas_user_id_idx on cuotas(user_id);
create index if not exists pagos_user_id_idx on pagos(user_id);
create index if not exists cuotas_prestamo_id_idx on cuotas(prestamo_id);
create index if not exists pagos_prestamo_id_idx on pagos(prestamo_id);

alter table clientes enable row level security;
alter table avales enable row level security;
alter table prestamos enable row level security;
alter table cuotas enable row level security;
alter table pagos enable row level security;
alter table configuracion enable row level security;

drop policy if exists clientes_por_usuario on clientes;
create policy clientes_por_usuario on clientes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists avales_por_usuario on avales;
create policy avales_por_usuario on avales
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists prestamos_por_usuario on prestamos;
create policy prestamos_por_usuario on prestamos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists cuotas_por_usuario on cuotas;
create policy cuotas_por_usuario on cuotas
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists pagos_por_usuario on pagos;
create policy pagos_por_usuario on pagos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists configuracion_por_usuario on configuracion;
create policy configuracion_por_usuario on configuracion
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

drop policy if exists firmas_por_usuario on storage.objects;
create policy firmas_por_usuario on storage.objects
  for all to authenticated
  using (bucket_id = 'firmas' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'firmas' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists documentos_por_usuario on storage.objects;
create policy documentos_por_usuario on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documentos' and auth.uid()::text = (storage.foldername(name))[1]);
