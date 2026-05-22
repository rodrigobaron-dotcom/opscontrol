// api/notify.js — Vercel Serverless Function
// Recibe POST con {agente, mensaje} y envía DM por Slack

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

async function findSlackUser(nombre) {
  // Buscar usuario por nombre completo o display name
  const res = await fetch('https://slack.com/api/users.list', {
    headers: { 'Authorization': 'Bearer ' + SLACK_TOKEN }
  });
  const data = await res.json();
  if (!data.ok) return null;

  const nombreLower = nombre.toLowerCase().trim();
  const nombrePartes = nombreLower.split(' ');

  // Buscar coincidencia por nombre real o display name
  const user = data.members.find(function(m) {
    if (m.deleted || m.is_bot) return false;
    const realName    = (m.real_name || '').toLowerCase();
    const displayName = (m.profile?.display_name || '').toLowerCase();
    const firstName   = (m.profile?.first_name || '').toLowerCase();
    const lastName    = (m.profile?.last_name || '').toLowerCase();

    // Coincidencia exacta
    if (realName === nombreLower) return true;
    if (displayName === nombreLower) return true;

    // Coincidencia por nombre y apellido
    if (nombrePartes.length >= 2) {
      const fn = nombrePartes[0];
      const ln = nombrePartes[nombrePartes.length - 1];
      if (firstName.includes(fn) && lastName.includes(ln)) return true;
      if (realName.includes(fn) && realName.includes(ln)) return true;
    }

    // Coincidencia parcial por primera parte del nombre
    if (realName.startsWith(nombrePartes[0])) return true;

    return false;
  });

  return user ? user.id : null;
}

async function sendDM(userId, mensaje) {
  // Abrir conversación DM
  const openRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ users: userId })
  });
  const openData = await openRes.json();
  if (!openData.ok) return { ok: false, error: openData.error };

  const channelId = openData.channel.id;

  // Enviar mensaje
  const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: channelId,
      text: mensaje,
      unfurl_links: false
    })
  });
  const msgData = await msgRes.json();
  return msgData;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { agente, mensaje, tipo } = req.body;

    if (!agente || !mensaje) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: agente y mensaje son requeridos' });
    }

    if (!SLACK_TOKEN) {
      return res.status(500).json({ ok: false, error: 'Token de Slack no configurado' });
    }

    // Buscar usuario en Slack
    const userId = await findSlackUser(agente);
    if (!userId) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Usuario no encontrado en Slack: ' + agente,
        agente: agente
      });
    }

    // Enviar DM
    const result = await sendDM(userId, mensaje);
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error, agente: agente });
    }

    return res.status(200).json({ 
      ok: true, 
      agente: agente,
      userId: userId,
      tipo: tipo || 'alerta'
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
