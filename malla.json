// api/malla.js — Malla en Supabase (tabla turnos)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

function headers(extra = {}) {
  return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', ...extra };
}

function calcTurno(h) {
  const hr = parseInt((h||'0').split(':')[0]);
  if (hr >= 6  && hr < 12) return 'Mañana';
  if (hr >= 12 && hr < 18) return 'Tarde';
  return 'Noche';
}

function sliceTime(t) { return t ? t.slice(0,5) : ''; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET ───────────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = `${SUPABASE_URL}/rest/v1/turnos?select=id,fecha,turno,turno_inicio,turno_fin,break_inicio,break_fin,lunch_inicio,lunch_fin,linea_atencion,agente_id,agentes(nombre,apellido,email,linea_atencion,nivel)&order=fecha.asc,turno_inicio.asc`;
      const resp = await fetch(url, { headers: headers() });
      const data = await resp.json();

      if (!Array.isArray(data)) {
        return res.json({ ok: false, error: data?.message || 'Error leyendo turnos' });
      }

      const malla = data.map(t => ({
        id:           t.id,
        fecha:        t.fecha,
        turno:        t.turno || '',
        ingreso:      sliceTime(t.turno_inicio),   // alias para frontend
        descanso1:    sliceTime(t.break_inicio),
        descanso2:    sliceTime(t.lunch_inicio),
        salida:       sliceTime(t.turno_fin),
        turno_inicio: sliceTime(t.turno_inicio),
        turno_fin:    sliceTime(t.turno_fin),
        break_inicio: sliceTime(t.break_inicio),
        break_fin:    sliceTime(t.break_fin),
        lunch_inicio: sliceTime(t.lunch_inicio),
        lunch_fin:    sliceTime(t.lunch_fin),
        agente_id:    t.agente_id,
        nombre:       t.agentes ? t.agentes.nombre + ' ' + t.agentes.apellido : '',
        email:        t.agentes ? t.agentes.email : '',
        cola:         t.agentes ? t.agentes.linea_atencion : '',
        nivel:        t.agentes ? t.agentes.nivel : '',
      }));

      return res.json({ ok: true, malla });
    }

    // ── POST: guardar turnos ──────────────────────────────────
    if (req.method === 'POST') {
      const { malla } = req.body || {};
      if (!Array.isArray(malla)) return res.status(400).json({ ok: false, error: 'malla debe ser un array' });

      let insertados = 0;
      const errores = [];

      for (const turno of malla) {
        // Aceptar tanto nombres nuevos como aliases
        const ti = turno.turno_inicio || turno.ingreso;
        const tf = turno.turno_fin    || turno.salida;
        const bi = turno.break_inicio || turno.descanso1;
        const bf = turno.break_fin    || null;
        const li = turno.lunch_inicio || turno.descanso2;
        const lf = turno.lunch_fin    || null;

        if (!turno.agente_id || !turno.fecha || !ti || !tf) {
          errores.push({ turno: turno.nombre || '?', error: 'Faltan campos: agente_id, fecha, turno_inicio, turno_fin' });
          continue;
        }

        const record = {
          agente_id:    turno.agente_id,
          fecha:        turno.fecha,
          turno:        turno.turno || calcTurno(ti),
          turno_inicio: ti,
          turno_fin:    tf,
          break_inicio: bi || null,
          break_fin:    bf,
          lunch_inicio: li || null,
          lunch_fin:    lf,
          linea_atencion: turno.cola || turno.linea_atencion || null,
        };

        // Verificar si existe para hacer UPDATE o INSERT
        const checkResp = await fetch(
          `${SUPABASE_URL}/rest/v1/turnos?agente_id=eq.${record.agente_id}&fecha=eq.${record.fecha}`,
          { headers: headers() }
        );
        const existing = await checkResp.json();

        let resp;
        if (Array.isArray(existing) && existing.length > 0) {
          resp = await fetch(
            `${SUPABASE_URL}/rest/v1/turnos?agente_id=eq.${record.agente_id}&fecha=eq.${record.fecha}`,
            { method: 'PATCH', headers: headers({ 'Prefer': 'return=minimal' }), body: JSON.stringify(record) }
          );
        } else {
          resp = await fetch(`${SUPABASE_URL}/rest/v1/turnos`, {
            method: 'POST',
            headers: headers({ 'Prefer': 'return=minimal' }),
            body: JSON.stringify(record)
          });
        }

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
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/turnos?id=eq.${id}`, { method: 'DELETE', headers: headers() });
      if (!resp.ok) return res.json({ ok: false, error: resp.statusText });
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    console.error('malla error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
