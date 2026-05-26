// api/estados.js
// GET  /api/estados?fecha=YYYY-MM-DD  → devuelve estados del día
// POST /api/estados                   → guarda estado de un agente

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO || 'rodrigobaron-dotcom/opscontrol';
const BRANCH       = 'main';

function fileName(fecha) {
  return `estados/estados-${fecha}.json`;
}

async function getFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (!res.ok) return { content: '{}', sha: null };
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function saveFile(path, content, sha) {
  const body = {
    message: 'Estado agente - ' + new Date().toISOString(),
    content: Buffer.from(content).toString('base64'),
    branch:  BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    {
      method:  'PUT',
      headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
      body:    JSON.stringify(body)
    }
  );
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!GITHUB_TOKEN) return res.status(500).json({ ok: false, error: 'Sin token' });

  try {
    const today = req.query.fecha || new Date().toISOString().slice(0, 10);
    const fpath = fileName(today);

    if (req.method === 'GET') {
      const { content } = await getFile(fpath);
      return res.status(200).json({ ok: true, estados: JSON.parse(content) });
    }

    if (req.method === 'POST') {
      const { nombre, estado, hora } = req.body;
      if (!nombre || !estado) return res.status(400).json({ ok: false, error: 'Faltan datos' });

      // Cargar estados actuales
      const { content, sha } = await getFile(fpath);
      const estados = JSON.parse(content);

      // Actualizar estado del agente
      if (!estados[nombre]) estados[nombre] = { historial: [] };
      estados[nombre].estado  = estado;
      estados[nombre].hora    = hora || new Date().toTimeString().slice(0,5);
      estados[nombre].ts      = Date.now();
      estados[nombre].historial.push({ estado, hora: estados[nombre].hora, ts: estados[nombre].ts });

      const saved = await saveFile(fpath, JSON.stringify(estados, null, 2), sha);
      return res.status(200).json({ ok: saved, nombre, estado });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
