// api/malla.js — Lee y guarda la malla en GitHub como malla.json
// GET /api/malla → devuelve la malla actual
// POST /api/malla → guarda la malla nueva

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO || 'rodrigobaron-dotcom/opscontrol';
const FILE_PATH    = 'malla.json';
const BRANCH       = 'main';

async function getFile() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (!res.ok) return { content: '[]', sha: null };
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function saveFile(content, sha) {
  const body = {
    message: 'Actualizar malla - ' + new Date().toISOString().slice(0,10),
    content: Buffer.from(content).toString('base64'),
    branch:  BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
    {
      method:  'PUT',
      headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
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

  if (!GITHUB_TOKEN) return res.status(500).json({ ok: false, error: 'GITHUB_TOKEN no configurado' });

  try {
    if (req.method === 'GET') {
      const { content } = await getFile();
      return res.status(200).json({ ok: true, malla: JSON.parse(content) });
    }

    if (req.method === 'POST') {
      const { malla } = req.body;
      if (!Array.isArray(malla)) return res.status(400).json({ ok: false, error: 'malla debe ser un array' });
      const { sha } = await getFile();
      const saved = await saveFile(JSON.stringify(malla, null, 2), sha);
      return res.status(200).json({ ok: saved });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
