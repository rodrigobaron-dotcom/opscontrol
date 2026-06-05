// api/malla.js — Malla en Supabase (tabla turnos)
// GET    → devuelve todos los turnos con datos del agente
// POST   → guarda/actualiza turnos en bulk
// DELETE → elimina un turno por id

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

function headers(extra = {}) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

function calcTurno(ingreso) {
  if (!ingreso) return '';
  const h = parseInt(ingreso.split(':')[0]);
  if (h >= 6  && h < 12) return 'Mañana';
  if (h >= 12 && h < 18) return 'Tarde';
  return 'Noche';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET ───────────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = `${SUPABASE_URL}/rest/v1/turnos?select=id,fecha,turno,ingreso,descanso1,descanso2,salida,agente_id,agentes(nombre,apellido,email,linea_atencion,nivel)&order=fecha.asc,ingreso.asc`;
      const resp = await fetch(url, { headers: headers() });
      const data = await resp.json();

      if (!Array.isArray(data)) {
        console.error('turnos GET error:', data);
        return res.json({ ok: false, error: data?.message || 'Error leyendo turnos' });
      }

      const malla = data.map(t => ({
        id:        t.id,
        fecha:     t.fecha,
        turno:     t.turno || '',
        ingreso:   t.ingreso   ? t.ingreso.slice(0,5)   : '',
        descanso1: t.descanso1 ? t.descanso1.slice(0,5) : '',
        descanso2: t.descanso2 ? t.descanso2.slice(0,5) : '',
        salida:    t.salida    ? t.salida.slice(0,5)    : '',
        agente_id: t.agente_id,
        nombre:    t.agentes   ? t.agentes.nombre + ' ' + t.agentes.apellido : '',
        email:     t.agentes   ? t.agentes.email : '',
        cola:      t.agentes   ? t.agentes.linea_atencion : '',
        nivel:     t.agentes   ? t.agentes.nivel : '',
      }));

      return res.json({ ok: true, malla });
    }

    // ── POST: guardar turnos ──────────────────────────────────
    if (req.method === 'POST') {
      const { malla } = req.body || {};
      if (!Array.isArray(malla)) {
        return res.status(400).json({ ok: false, error: 'malla debe ser un array' });
      }

      let insertados = 0;
      const errores = [];

      for (const turno of malla) {
        if (!turno.agente_id || !turno.fecha || !turno.ingreso || !turno.salida) {
          errores.push({ turno: turno.nombre || turno.email || '?', error: 'Faltan campos requeridos' });
          continue;
        }

        const record = {
          agente_id:  turno.agente_id,
          fecha:      turno.fecha,
          turno:      turno.turno || calcTurno(turno.ingreso),
          ingreso:    turno.ingreso,
          descanso1:  turno.descanso1 || null,
          descanso2:  turno.descanso2 || null,
          salida:     turno.salida,
        };

        const resp = await fetch(`${SUPABASE_URL}/rest/v1/turnos`, {
          method: 'POST',
          headers: headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(record)
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          errores.push({ turno: turno.nombre || '?', error: err.message || resp.statusText });
        } else {
          insertados++;
        }
      }

      return res.json({ ok: true, insertados, errores: errores.length ? errores : undefined });
    }

    // ── DELETE ────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'id requerido' });

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/turnos?id=eq.${id}`, {
        method: 'DELETE',
        headers: headers()
      });

      if (!resp.ok) return res.json({ ok: false, error: resp.statusText });
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  } catch(e) {
    console.error('malla error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
