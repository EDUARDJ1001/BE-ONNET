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

// SIEMPRE devuelve los 12 meses del año.
//
// Los meses que no tienen fila se completan al vuelo:
//   - anteriores a la instalación -> 'Sin servicio' (todavía no era cliente)
//   - de la instalación en adelante -> 'Pendiente'
//
// "Sin servicio" no se guarda en la tabla: se deduce de `fecha_instalacion`, así
// que no puede quedar desincronizado si esa fecha se corrige después. Los años
// anteriores a la instalación directamente no tienen filas, y así se muestran
// bien sin necesidad de crearlas.
//
// Si el mes SÍ tiene fila, se respeta lo guardado: un pago registrado o un
// 'Suspendido' puesto a mano manda sobre lo que se pueda deducir.
export const obtenerEstadoPorClienteYAno = async (clienteId, anio) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    `SELECT mes, anio, estado
     FROM estado_mensual
     WHERE cliente_id = ? AND anio = ?
     ORDER BY mes ASC`,
    [clienteId, anio]
  );

  // El año y el mes se piden ya separados a MySQL para no depender de cómo
  // JavaScript interprete la fecha (new Date('2026-08-01') corre el mes en
  // zonas horarias negativas como la nuestra).
  const [[instalacion]] = await db.execute(
    `SELECT YEAR(fecha_instalacion)  AS anio_inst,
            MONTH(fecha_instalacion) AS mes_inst
       FROM clientes
      WHERE id = ?`,
    [clienteId]
  );

  // Año y mes en un solo número, para comparar de una sola vez.
  const inicioServicio = instalacion?.anio_inst
    ? instalacion.anio_inst * 12 + instalacion.mes_inst
    : null;

  const mapa = new Map(rows.map(r => [r.mes, r.estado]));
  const completos = [];

  for (let m = 1; m <= 12; m++) {
    const guardado = mapa.get(m);
    if (guardado) {
      completos.push({ mes: m, anio, estado: guardado });
      continue;
    }

    const previoALaInstalacion =
      inicioServicio !== null && anio * 12 + m < inicioServicio;

    completos.push({
      mes: m,
      anio,
      estado: previoALaInstalacion ? 'Sin servicio' : 'Pendiente'
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
