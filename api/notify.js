// api/notify.js — Vercel Serverless Function
// Busca usuario en Slack por EMAIL (principal) o nombre, y envía DM

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

async function findUserByEmail(email) {
  if (!email) return null;
  const res = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), {
    headers: { 'Authorization': 'Bearer ' + SLACK_TOKEN }
  });
  const data = await res.json();
  return data.ok ? data.user.id : null;
}

async function findUserByName(nombre) {
  const res = await fetch('https://slack.com/api/users.list', {
    headers: { 'Authorization': 'Bearer ' + SLACK_TOKEN }
  });
  const data = await res.json();
  if (!data.ok) return null;

  const nl = nombre.toLowerCase().trim();
  const parts = nl.split(' ');

  const user = data.members.find(function(m) {
    if (m.deleted || m.is_bot) return false;
    const rn = (m.real_name || '').toLowerCase();
    const dn = (m.profile?.display_name || '').toLowerCase();
    const fn = (m.profile?.first_name || '').toLowerCase();
    const ln = (m.profile?.last_name || '').toLowerCase();
    if (rn === nl || dn === nl) return true;
    if (parts.length >= 2) {
      const f = parts[0], l = parts[parts.length - 1];
      if (fn.includes(f) && ln.includes(l)) return true;
      if (rn.includes(f) && rn.includes(l)) return true;
    }
    return false;
  });

  return user ? user.id : null;
}

async function sendDM(userId, mensaje) {
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

  const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: openData.channel.id,
      text: mensaje,
      unfurl_links: false
    })
  });
  return await msgRes.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { agente, email, mensaje, tipo } = req.body;

    if (!agente || !mensaje) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros' });
    }
    if (!SLACK_TOKEN) {
      return res.status(500).json({ ok: false, error: 'Token de Slack no configurado' });
    }

    // Buscar por email primero (más confiable), luego por nombre
    let userId = null;
    if (email) {
      userId = await findUserByEmail(email);
    }
    if (!userId) {
      userId = await findUserByName(agente);
    }

    if (!userId) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado: ' + agente + (email ? ' (' + email + ')' : ''),
        agente: agente
      });
    }

    const result = await sendDM(userId, mensaje);
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    return res.status(200).json({ ok: true, agente: agente, userId: userId, tipo: tipo });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
