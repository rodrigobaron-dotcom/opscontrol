-- ============================================================
--  OpsControl — Schema completo
--  Pega esto en Supabase SQL Editor y ejecuta
-- ============================================================

-- ── AGENTES ──────────────────────────────────────────────
create table if not exists agentes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  email       text unique not null,
  documento   text,
  cola        text,
  rol         text default 'agente', -- 'admin', 'supervisor', 'agente'
  activo      boolean default true,
  created_at  timestamptz default now()
);

-- ── TURNOS (malla) ────────────────────────────────────────
create table if not exists turnos (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid references agentes(id) on delete cascade,
  fecha       date not null,
  turno       text, -- Mañana, Tarde, Noche (calculado)
  cola        text,
  ingreso     time not null,
  descanso1   time,
  descanso2   time,
  salida      time not null,
  created_at  timestamptz default now(),
  unique(agente_id, fecha)
);

-- ── MARCACIONES (log de estados) ─────────────────────────
create table if not exists marcaciones (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid references agentes(id) on delete cascade,
  fecha       date not null default current_date,
  tipo        text not null, -- 'inicio_turno','pausa','descanso_corto','descanso_largo','fin_turno'
  hora_marcada    time not null default current_time,
  hora_programada time,      -- hora que debía marcar según malla
  diferencia_min  integer,   -- positivo=tarde, negativo=adelantado
  adherente   boolean,       -- true si llegó a tiempo (±5 min)
  notas       text,
  created_at  timestamptz default now()
);

-- ── CAMBIOS DE TURNO ─────────────────────────────────────
create table if not exists cambios_turno (
  id              uuid primary key default gen_random_uuid(),
  solicitante_id  uuid references agentes(id),
  receptor_id     uuid references agentes(id),
  fecha_original  date not null,
  fecha_nueva     date not null,
  turno_original  uuid references turnos(id),
  turno_nuevo     uuid references turnos(id),
  estado          text default 'pendiente', -- 'pendiente','aprobado','rechazado'
  aprobado_por    uuid references agentes(id),
  motivo          text,
  created_at      timestamptz default now()
);

-- ── SESIONES (para login) ─────────────────────────────────
create table if not exists sesiones (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid references agentes(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  expira_at   timestamptz default now() + interval '12 hours',
  created_at  timestamptz default now()
);

-- ── INDICES para rendimiento ──────────────────────────────
create index if not exists idx_turnos_fecha     on turnos(fecha);
create index if not exists idx_turnos_agente    on turnos(agente_id);
create index if not exists idx_marcaciones_fecha on marcaciones(fecha);
create index if not exists idx_marcaciones_agente on marcaciones(agente_id);
create index if not exists idx_sesiones_token   on sesiones(token);

-- ── VISTAS útiles ─────────────────────────────────────────

-- Vista: turno de hoy con info del agente
create or replace view turnos_hoy as
select
  t.id,
  t.fecha,
  a.nombre,
  a.email,
  a.cola,
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

-- Vista: resumen de adherencia por agente y fecha
create or replace view resumen_adherencia as
select
  a.nombre,
  a.email,
  a.cola,
  m.fecha,
  count(*) filter (where m.adherente = true)  as marcaciones_a_tiempo,
  count(*) filter (where m.adherente = false) as marcaciones_tarde,
  count(*)                                     as total_marcaciones,
  round(
    count(*) filter (where m.adherente = true)::numeric /
    nullif(count(*), 0) * 100, 1
  ) as porcentaje_adherencia
from marcaciones m
join agentes a on a.id = m.agente_id
group by a.nombre, a.email, a.cola, m.fecha
order by m.fecha desc, a.nombre;

-- ── Desactivar RLS para empezar (lo activamos después con roles) ──
alter table agentes       disable row level security;
alter table turnos        disable row level security;
alter table marcaciones   disable row level security;
alter table cambios_turno disable row level security;
alter table sesiones      disable row level security;

-- Mensaje de confirmación
select 'OpsControl DB creada correctamente 🚀' as resultado;
