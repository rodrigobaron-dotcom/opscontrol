-- ============================================================
--  OpsControl — Schema FINAL
--  Ejecuta esto en Supabase SQL Editor
-- ============================================================

-- Limpiar tablas anteriores si existen
drop table if exists cambios_turno cascade;
drop table if exists marcaciones cascade;
drop table if exists sesiones cascade;
drop table if exists turnos cascade;
drop table if exists agentes cascade;
drop view  if exists turnos_hoy cascade;
drop view  if exists resumen_adherencia cascade;

-- ── AGENTES ──────────────────────────────────────────────
create table agentes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  apellido        text not null,
  email           text unique not null,
  documento       text,
  linea_atencion  text,                    -- cola: Soporte, Ventas, etc.
  nivel           text,                    -- Nivel 1, Nivel 2, etc.
  conexion        text default 'Oficina',  -- Remoto / Oficina
  rol             text default 'agente',   -- admin, supervisor, agente
  activo          boolean default true,
  fecha_ingreso   date,                    -- opcional
  created_at      timestamptz default now()
);

-- ── TURNOS (malla semanal/mensual) ────────────────────────
create table turnos (
  id              uuid primary key default gen_random_uuid(),
  agente_id       uuid references agentes(id) on delete cascade,
  fecha           date not null,
  dia_semana      text generated always as (
    to_char(fecha, 'Day')
  ) stored,
  turno           text,                    -- Mañana, Tarde, Noche (calculado)
  ingreso         time not null,
  descanso1       time,                    -- break corto
  descanso2       time,                    -- lunch largo
  salida          time not null,
  created_at      timestamptz default now(),
  unique(agente_id, fecha)
);

-- ── MARCACIONES (log de cada acción del agente) ───────────
create table marcaciones (
  id                uuid primary key default gen_random_uuid(),
  agente_id         uuid references agentes(id) on delete cascade,
  turno_id          uuid references turnos(id) on delete set null,
  fecha             date not null default current_date,
  tipo              text not null,
  -- tipos: inicio_turno, pausa, fin_pausa, descanso_corto,
  --        fin_descanso_corto, descanso_largo, fin_descanso_largo, fin_turno
  hora_marcada      time not null,
  hora_programada   time,                  -- según la malla
  diferencia_min    integer,               -- + tarde, - adelantado
  adherente         boolean,               -- true si ±5 min
  conexion          text,                  -- Remoto / Oficina al momento
  notas             text,
  created_at        timestamptz default now()
);

-- ── CAMBIOS DE TURNO ─────────────────────────────────────
create table cambios_turno (
  id                uuid primary key default gen_random_uuid(),
  solicitante_id    uuid references agentes(id),
  receptor_id       uuid references agentes(id),
  turno_solicitante uuid references turnos(id),
  turno_receptor    uuid references turnos(id),
  fecha_solicitud   date not null default current_date,
  estado            text default 'pendiente', -- pendiente, aprobado, rechazado
  aprobado_por      uuid references agentes(id),
  motivo            text,
  created_at        timestamptz default now()
);

-- ── SESIONES (login tokens) ───────────────────────────────
create table sesiones (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid references agentes(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  expira_at   timestamptz default now() + interval '12 hours',
  created_at  timestamptz default now()
);

-- ── ÍNDICES ───────────────────────────────────────────────
create index idx_turnos_fecha      on turnos(fecha);
create index idx_turnos_agente     on turnos(agente_id);
create index idx_marcaciones_fecha on marcaciones(fecha);
create index idx_marcaciones_agente on marcaciones(agente_id);
create index idx_sesiones_token    on sesiones(token);
create index idx_agentes_email     on agentes(email);
create index idx_agentes_linea     on agentes(linea_atencion);

-- ── VISTA: turno de hoy con info del agente ───────────────
create view turnos_hoy as
select
  t.id          as turno_id,
  t.fecha,
  t.dia_semana,
  a.id          as agente_id,
  a.nombre,
  a.apellido,
  a.nombre || ' ' || a.apellido as nombre_completo,
  a.email,
  a.linea_atencion,
  a.nivel,
  a.conexion,
  a.rol,
  t.turno,
  t.ingreso,
  t.descanso1,
  t.descanso2,
  t.salida
from turnos t
join agentes a on a.id = t.agente_id
where t.fecha = current_date
  and a.activo = true
order by t.ingreso;

-- ── VISTA: resumen de adherencia ──────────────────────────
create view resumen_adherencia as
select
  a.nombre || ' ' || a.apellido as nombre_completo,
  a.email,
  a.linea_atencion,
  a.nivel,
  m.fecha,
  count(*) filter (where m.tipo = 'inicio_turno')                    as total_inicios,
  count(*) filter (where m.tipo = 'inicio_turno' and m.adherente)    as inicios_a_tiempo,
  count(*) filter (where m.tipo = 'inicio_turno' and not m.adherente) as inicios_tarde,
  avg(m.diferencia_min) filter (where m.tipo = 'inicio_turno')       as promedio_diferencia_min,
  count(*) filter (where m.tipo = 'fin_turno')                       as total_salidas,
  round(
    count(*) filter (where m.adherente)::numeric /
    nullif(count(*), 0) * 100, 1
  ) as porcentaje_adherencia
from marcaciones m
join agentes a on a.id = m.agente_id
group by a.nombre, a.apellido, a.email, a.linea_atencion, a.nivel, m.fecha
order by m.fecha desc, a.apellido;

-- ── VISTA: log completo del día ───────────────────────────
create view log_dia as
select
  m.fecha,
  m.tipo,
  a.nombre || ' ' || a.apellido as agente,
  a.linea_atencion,
  a.conexion,
  m.hora_marcada,
  m.hora_programada,
  m.diferencia_min,
  case
    when m.adherente then 'A tiempo'
    when m.diferencia_min > 0 then 'Tarde ' || m.diferencia_min || ' min'
    else 'Adelantado ' || abs(m.diferencia_min) || ' min'
  end as estado_adherencia,
  m.notas
from marcaciones m
join agentes a on a.id = m.agente_id
order by m.fecha desc, m.hora_marcada;

-- ── Desactivar RLS por ahora ──────────────────────────────
alter table agentes       disable row level security;
alter table turnos        disable row level security;
alter table marcaciones   disable row level security;
alter table cambios_turno disable row level security;
alter table sesiones      disable row level security;

select 'OpsControl DB FINAL lista ✅' as resultado;
