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

// Crea la fila del mes SOLO si no existe. Nunca pisa un estado ya guardado.
//
// Antes hacía `ON DUPLICATE KEY UPDATE estado = VALUES(estado)`, y con eso un
// POST con 'Pendiente' borraba un mes que ya estaba 'Pagado': el pago seguía en
// la tabla `pagos` pero el mes aparecía impago, y terminaba cobrándose dos
// veces. El estado de pago lo calcula pagoModel sumando los pagos del mes, y
// los estados manuales ('Suspendido') se ponen con actualizarEstadoMensual.
// Este endpoint sólo inicializa meses que faltan.
export const crearEstadoMensual = async (registro) => {
  const { cliente_id, mes, anio, estado } = registro;
  const db = await connectDB();
  const sql = `
    INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id
  `;
  const [result] = await db.execute(sql, [cliente_id, mes, anio, estado]);
  // affectedRows vale 1 si insertó y 0 si la fila ya existía y quedó intacta.
  return { id: result.insertId || 0, creado: result.affectedRows === 1 };
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
