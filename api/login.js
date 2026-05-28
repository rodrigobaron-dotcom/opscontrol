// api/login.js
// POST /api/login { email, password }
// Valida agente y devuelve token de sesión

import { from, insert } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });

    // Buscar agente por email
    const agentes = await from('agentes', { email: email.toLowerCase().trim() });
    if (!agentes || !agentes.length) {
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });
    }

    const agente = agentes[0];
    if (!agente.activo) {
      return res.status(401).json({ ok: false, error: 'Tu cuenta está desactivada. Contacta a tu supervisor.' });
    }

    // Verificar contraseña (por ahora usamos documento como password temporal)
    // En producción usar bcrypt
    const passValida = password === agente.documento || password === agente.password_hash;
    if (!passValida) {
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });
    }

    // Crear sesión
    const sesion = await insert('sesiones', { agente_id: agente.id });
    if (!sesion || !sesion.length) {
      return res.status(500).json({ ok: false, error: 'Error al crear sesión' });
    }

    return res.status(200).json({
      ok: true,
      token: sesion[0].token,
      agente: {
        id:             agente.id,
        nombre:         agente.nombre,
        apellido:       agente.apellido,
        email:          agente.email,
        rol:            agente.rol,
        linea_atencion: agente.linea_atencion,
        nivel:          agente.nivel,
        conexion:       agente.conexion
      }
    });

  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
