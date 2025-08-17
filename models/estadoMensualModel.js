import connectDB from '../config/db.js';

export const obtenerEstadosMensuales = async () => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM estado_mensual');
  return rows;
};

export const obtenerEstadoPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM estado_mensual WHERE id = ?', [id]);
  return rows[0];
};

// SIEMPRE devuelve 12 meses (rellena faltantes con 'Pendiente')
export const obtenerEstadoPorClienteYAno = async (clienteId, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(
    `SELECT mes, anio, estado
     FROM estado_mensual
     WHERE cliente_id = ? AND anio = ?
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

// UPSERT idempotente para evitar ER_DUP_ENTRY
export const crearEstadoMensual = async (registro) => {
  const { cliente_id, mes, anio, estado } = registro;
  const db = await connectDB();
  const sql = `
    INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE estado = VALUES(estado)
  `;
  const [result] = await db.execute(sql, [cliente_id, mes, anio, estado]);
  // insertId solo si creó; con upsert puede ser 0, devolvemos algo coherente
  return result.insertId || 0;
};

export const actualizarEstadoMensual = async (id, data) => {
  const { estado } = data;
  const db = await connectDB();
  const query = 'UPDATE estado_mensual SET estado = ? WHERE id = ?';
  const [result] = await db.execute(query, [estado, id]);
  return result;
};

export const eliminarEstadoMensual = async (id) => {
  const db = await connectDB();
  const [result] = await db.execute('DELETE FROM estado_mensual WHERE id = ?', [id]);
  return result;
};
