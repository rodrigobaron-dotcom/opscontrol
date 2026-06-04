// api/malla.js — Lee y guarda la malla en Supabase (tabla turnos)
// GET  /api/malla          → devuelve todos los turnos
// POST /api/malla          → guarda/actualiza turnos (bulk)
// DELETE /api/malla?id=xxx → elimina un turno

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: devolver malla completa ──────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('turnos')
        .select(`
          id,
          fecha,
          turno,
          ingreso,
          descanso1,
          descanso2,
          salida,
          agente_id,
          agentes (
            nombre,
            apellido,
            email,
            linea_atencion,
            nivel
          )
        `)
        .order('fecha', { ascending: true })
        .order('ingreso', { ascending: true });

      if (error) throw error;

      // Convertir al formato que espera el frontend
      const malla = data.map(function(t) {
        return {
          id:             t.id,
          fecha:          t.fecha,
          turno:          t.turno || '',
          ingreso:        t.ingreso   ? t.ingreso.slice(0,5)   : '',
          descanso1:      t.descanso1 ? t.descanso1.slice(0,5) : '',
          descanso2:      t.descanso2 ? t.descanso2.slice(0,5) : '',
          salida:         t.salida    ? t.salida.slice(0,5)    : '',
          agente_id:      t.agente_id,
          nombre:         t.agentes ? t.agentes.nombre + ' ' + t.agentes.apellido : '',
          email:          t.agentes ? t.agentes.email : '',
          cola:           t.agentes ? t.agentes.linea_atencion : '',
          nivel:          t.agentes ? t.agentes.nivel : '',
        };
      });

      return res.json({ ok: true, malla });
    }

    // ── POST: guardar turnos en bulk ──────────────────────────
    if (req.method === 'POST') {
      const { malla } = req.body;
      if (!Array.isArray(malla)) {
        return res.status(400).json({ ok: false, error: 'malla debe ser un array' });
      }

      let insertados = 0, actualizados = 0, errores = [];

      for (const turno of malla) {
        if (!turno.agente_id || !turno.fecha || !turno.ingreso || !turno.salida) {
          errores.push({ turno: turno.nombre || turno.email, error: 'Faltan campos requeridos' });
          continue;
        }

        // Calcular turno automáticamente si no viene
        const turnoNombre = turno.turno || calcTurno(turno.ingreso);

        const record = {
          agente_id:  turno.agente_id,
          fecha:      turno.fecha,
          turno:      turnoNombre,
          ingreso:    turno.ingreso,
          descanso1:  turno.descanso1 || null,
          descanso2:  turno.descanso2 || null,
          salida:     turno.salida,
        };

        // Upsert por agente_id + fecha (unique constraint)
        const { error } = await supabase
          .from('turnos')
          .upsert(record, { onConflict: 'agente_id,fecha' });

        if (error) {
          errores.push({ turno: turno.nombre || turno.email, error: error.message });
        } else {
          insertados++;
        }
      }

      return res.json({
        ok: true,
        insertados,
        errores: errores.length ? errores : undefined
      });
    }

    // ── DELETE: eliminar un turno por id ──────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'id requerido' });

      const { error } = await supabase
        .from('turnos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  } catch(e) {
    console.error('malla API error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function calcTurno(ingreso) {
  if (!ingreso) return '';
  const [h] = ingreso.split(':').map(Number);
  if (h >= 6  && h < 12) return 'Mañana';
  if (h >= 12 && h < 18) return 'Tarde';
  return 'Noche';
}
