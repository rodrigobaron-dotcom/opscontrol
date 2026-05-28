// api/agentes.js
// GET    /api/agentes              → listar todos
// POST   /api/agentes              → crear uno
// POST   /api/agentes?bulk=true    → carga masiva CSV
// PATCH  /api/agentes?id=xxx       → actualizar
// DELETE /api/agentes?id=xxx       → eliminar (desactivar)

import { from, insert, update } from './_supabase.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SECRET_KEY;

async function getAll() {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/agentes?select=*&order=apellido.asc`,
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  );
  return res.json();
}

async function upsertMany(agentes) {
  const res = await fetch(`${SUPA_URL}/rest/v1/agentes`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(agentes)
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — listar agentes
    if (req.method === 'GET') {
      const agentes = await getAll();
      return res.status(200).json({ ok: true, agentes });
    }

    // POST — crear uno o carga masiva
    if (req.method === 'POST') {
      const isBulk = req.query.bulk === 'true';

      if (isBulk) {
        // Carga masiva: array de agentes
        const { agentes } = req.body;
        if (!Array.isArray(agentes) || !agentes.length) {
          return res.status(400).json({ ok: false, error: 'Se requiere array de agentes' });
        }
        // Normalizar campos
        const normalized = agentes.map(a => ({
          nombre:         (a.nombre || '').trim(),
          apellido:       (a.apellido || '').trim(),
          email:          (a.email || '').toLowerCase().trim(),
          documento:      (a.documento || '').trim() || null,
          linea_atencion: (a.linea_atencion || a.cola || '').trim() || null,
          nivel:          (a.nivel || '').trim() || null,
          conexion:       (a.conexion || 'Oficina').trim(),
          rol:            (a.rol || 'agente').trim(),
          fecha_ingreso:  a.fecha_ingreso || null,
          activo:         true
        })).filter(a => a.nombre && a.apellido && a.email);

        const result = await upsertMany(normalized);
        return res.status(200).json({ ok: true, insertados: normalized.length, agentes: result });
      }

      // Crear uno solo
      const { nombre, apellido, email, documento, linea_atencion, nivel, conexion, rol, fecha_ingreso } = req.body;
      if (!nombre || !apellido || !email) {
        return res.status(400).json({ ok: false, error: 'nombre, apellido y email son requeridos' });
      }
      const nuevo = await insert('agentes', {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.toLowerCase().trim(),
        documento: documento || null,
        linea_atencion: linea_atencion || null,
        nivel: nivel || null,
        conexion: conexion || 'Oficina',
        rol: rol || 'agente',
        fecha_ingreso: fecha_ingreso || null
      });
      return res.status(200).json({ ok: true, agente: nuevo[0] });
    }

    // PATCH — actualizar agente
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'Se requiere id' });
      const result = await update('agentes', { id }, req.body);
      return res.status(200).json({ ok: true, agente: result[0] });
    }

    // DELETE — desactivar agente (soft delete)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'Se requiere id' });
      await update('agentes', { id }, { activo: false });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
