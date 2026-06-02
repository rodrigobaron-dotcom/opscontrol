// api/autobreak.js
// Cierra breaks pendientes que superaron su tiempo límite
// Se llama desde el cliente al cargar, y puede llamarse desde un cron

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const METAS = {
  descanso_corto: 10,
  descanso_largo: 30
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const hoy = new Date().toISOString().split('T')[0];

    // Buscar marcaciones de descanso de hoy sin fin registrado
    const { data: marcaciones, error } = await supabase
      .from('marcaciones')
      .select('*')
      .eq('fecha', hoy)
      .in('tipo', ['descanso_corto', 'descanso_largo'])
      .order('hora_marcada', { ascending: true });

    if (error) throw error;

    const ahora = new Date();
    const nowMins = ahora.getHours() * 60 + ahora.getMinutes();
    const cerrados = [];

    for (const marc of marcaciones) {
      const tipoFin = marc.tipo === 'descanso_corto' ? 'fin_descanso_corto' : 'fin_descanso_largo';
      const meta    = METAS[marc.tipo];

      // Verificar si ya tiene fin registrado
      const { data: finExiste } = await supabase
        .from('marcaciones')
        .select('id')
        .eq('agente_id', marc.agente_id)
        .eq('tipo', tipoFin)
        .eq('fecha', hoy)
        .gte('hora_marcada', marc.hora_marcada)
        .limit(1);

      if (finExiste && finExiste.length > 0) continue; // ya tiene fin

      // Calcular tiempo transcurrido
      const [h, m] = marc.hora_marcada.split(':').map(Number);
      const inicioMins = h * 60 + m;
      const transcurrido = nowMins - inicioMins;

      if (transcurrido >= meta) {
        // Registrar fin automático a la hora exacta de meta
        const horaFin = new Date(ahora);
        horaFin.setHours(Math.floor((inicioMins + meta) / 60));
        horaFin.setMinutes((inicioMins + meta) % 60);
        const horaFinStr = String(horaFin.getHours()).padStart(2,'0') + ':' + String(horaFin.getMinutes()).padStart(2,'0');

        await supabase.from('marcaciones').insert({
          agente_id:      marc.agente_id,
          tipo:           tipoFin,
          hora_marcada:   horaFinStr,
          fecha:          hoy,
          notas:          'Cerrado automáticamente por el sistema'
        });

        cerrados.push({
          agente_id: marc.agente_id,
          tipo:      tipoFin,
          hora_fin:  horaFinStr,
          duracion:  transcurrido
        });
      }
    }

    return res.json({ ok: true, cerrados, total: cerrados.length });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
}
