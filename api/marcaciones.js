// api/marcaciones.js
// POST /api/marcaciones  → registrar marcación
// GET  /api/marcaciones?agente_id=xxx&fecha=YYYY-MM-DD → historial

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SECRET_KEY;

async function getTurno(agente_id, fecha) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/turnos?agente_id=eq.${agente_id}&fecha=eq.${fecha}&select=*`,
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  );
  const data = await res.json();
  return data && data.length ? data[0] : null;
}

function calcAdherencia(horaMarcada, horaProgramada, toleranciaMin = 5) {
  if (!horaProgramada) return { diferencia: null, adherente: null };
  const [hM, mM] = horaMarcada.split(':').map(Number);
  const [hP, mP] = horaProgramada.split(':').map(Number);
  const marcadaMins    = hM * 60 + mM;
  const programadaMins = hP * 60 + mP;
  const diferencia     = marcadaMins - programadaMins;
  return {
    diferencia,
    adherente: Math.abs(diferencia) <= toleranciaMin
  };
}

function getHoraProgramada(turno, tipo) {
  if (!turno) return null;
  const map = {
    'inicio_turno':       turno.ingreso,
    'descanso_corto':     turno.descanso1,
    'fin_descanso_corto': turno.descanso1,
    'descanso_largo':     turno.descanso2,
    'fin_descanso_largo': turno.descanso2,
    'fin_turno':          turno.salida,
    'pausa':              null,
    'fin_pausa':          null
  };
  return map[tipo] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — historial de marcaciones
    if (req.method === 'GET') {
      const { agente_id, fecha, desde, hasta } = req.query;
      let url = `${SUPA_URL}/rest/v1/marcaciones?select=*,agentes(nombre,apellido,email,linea_atencion)&order=created_at.desc`;
      if (agente_id) url += `&agente_id=eq.${agente_id}`;
      if (fecha)     url += `&fecha=eq.${fecha}`;
      if (desde)     url += `&fecha=gte.${desde}`;
      if (hasta)     url += `&fecha=lte.${hasta}`;

      const res2 = await fetch(url, {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      const data = await res2.json();
      return res.status(200).json({ ok: true, marcaciones: data });
    }

    // POST — registrar marcación
    if (req.method === 'POST') {
      const { agente_id, tipo, hora_marcada, fecha, conexion, notas } = req.body;

      if (!agente_id || !tipo || !hora_marcada) {
        return res.status(400).json({ ok: false, error: 'agente_id, tipo y hora_marcada son requeridos' });
      }

      const fechaUso = fecha || new Date().toISOString().slice(0, 10);

      // Buscar turno del agente para calcular adherencia
      const turno = await getTurno(agente_id, fechaUso);
      const horaProg = getHoraProgramada(turno, tipo);
      const { diferencia, adherente } = calcAdherencia(hora_marcada, horaProg);

      // Insertar marcación
      const body = {
        agente_id,
        turno_id:         turno ? turno.id : null,
        fecha:            fechaUso,
        tipo,
        hora_marcada,
        hora_programada:  horaProg,
        diferencia_min:   diferencia,
        adherente,
        conexion:         conexion || null,
        notas:            notas || null
      };

      const insertRes = await fetch(`${SUPA_URL}/rest/v1/marcaciones`, {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(body)
      });
      const data = await insertRes.json();

      return res.status(200).json({
        ok: true,
        marcacion: data[0],
        adherente,
        diferencia_min: diferencia,
        hora_programada: horaProg,
        mensaje: adherente === false
          ? (diferencia > 0 ? `Tarde ${diferencia} min` : `Adelantado ${Math.abs(diferencia)} min`)
          : adherente === true ? 'A tiempo ✓' : 'Registrado'
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
