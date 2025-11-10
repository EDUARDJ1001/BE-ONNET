import connectDB from '../config/db.js';

export const obtenerEstadosMensualesTv = async () => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM estado_mensual_tv');
  return rows;
};

export const obtenerEstadoTvPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM estado_mensual_tv WHERE id = ?', [id]);
  return rows[0];
};

// SIEMPRE devuelve 12 meses (rellena faltantes con 'Pendiente')
export const obtenerEstadoPorClienteYAnoTv = async (clienteId, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(
    `SELECT mes, anio, estado
     FROM estado_mensual_tv
     WHERE clientetv_id = ? AND anio = ?
     ORDER BY mes ASC`,
    [clienteId, anio]
  );

  const mapa = new Map(rows.map(r => [r.mes, r.estado]));
  const completos = [];
  for (let m = 1; m <= 12; m++) {
    completos.push({
      mes: m,
      anio,
      estado: mapa.get(m) || 'Pendiente'
    });
  }
  return completos;
};

export const actualizarEstadoMensualTv = async (id, data) => {
  const { estado } = data;
  const db = await connectDB();
  const query = 'UPDATE estado_mensual_tv SET estado = ? WHERE id = ?';
  const [result] = await db.execute(query, [estado, id]);
  return result;
};

export const eliminarEstadoMensualTv = async (id) => {
  const db = await connectDB();
  const [result] = await db.execute('DELETE FROM estado_mensual_tv WHERE id = ?', [id]);
  return result;
};
