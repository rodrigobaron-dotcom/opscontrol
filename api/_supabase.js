// api/_supabase.js — cliente Supabase reutilizable
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

export async function query(sql, params = []) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  return res.json();
}

// GET de tabla con filtros
export async function from(table, filters = {}, select = '*') {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `&${k}=eq.${encodeURIComponent(v)}`;
  });
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  });
  return res.json();
}

// INSERT en tabla
export async function insert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

// UPDATE en tabla
export async function update(table, filters, data) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `${k}=eq.${encodeURIComponent(v)}&`;
  });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

// DELETE en tabla
export async function remove(table, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `${k}=eq.${encodeURIComponent(v)}&`;
  });
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  });
  return res.ok;
}
