import connectDB from '../config/db.js';

const getMesAnio = (dateStr) => {
  const d = new Date(dateStr);
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
};

const calcularEstadoMensual = async (conn, cliente_id, mes, anio) => {
  // 1) Traer precio del plan del cliente
  const [[cli]] = await conn.execute(
    `SELECT p.precio_mensual
     FROM clientes c
     JOIN planes p ON p.id = c.plan_id
     WHERE c.id = ?`,
    [cliente_id]
  );
  const precioMensual = Number(cli?.precio_mensual ?? 0);

  // 2) Acumulado del mes
  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) as total
     FROM pagos
     WHERE cliente_id = ?
       AND MONTH(fecha_pago) = ?
       AND YEAR(fecha_pago) = ?`,
    [cliente_id, mes, anio]
  );
  const acumulado = Number(sumRow.total);

  // 3) Determinar estado
  let estado = 'Pendiente';
  if (precioMensual > 0) {
    if (acumulado >= precioMensual) estado = 'Pagado';
    else if (acumulado > 0) estado = 'Pagado Parcial';
  } else {
    estado = acumulado > 0 ? 'Pagado' : 'Pendiente';
  }

  return estado;
};

const upsertEstadoMensual = async (conn, cliente_id, mes, anio, estado) => {
  await conn.execute(
    `INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
    [cliente_id, mes, anio, estado]
  );
};

export const obtenerPagos = async () => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc 
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    ORDER BY p.id DESC
  `);
  return rows;
};

export const obtenerMetodosPago = async () => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM metodos_pago');
  return rows;
}

export const obtenerPagoPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc 
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    WHERE p.id = ?
  `, [id]);
  return rows[0];
};

export const crearPago = async (pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Insertar pago
    const [r1] = await conn.execute(
      `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cliente_id, monto, fecha_pago, metodo_id, referencia ?? null, observacion ?? null]
    );

    // 2) Calcular estado mensual y upsert
    const { mes, anio } = getMesAnio(fecha_pago);
    const estado = await calcularEstadoMensual(conn, cliente_id, mes, anio);
    await upsertEstadoMensual(conn, cliente_id, mes, anio, estado);

    await conn.commit();
    return r1.insertId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

export const actualizarPago = async (id, pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observaciones } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener pago actual (para saber mes/año previo)
    const [oldRows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new Error('Pago no encontrado');

    const old = oldRows[0];
    const { mes: oldMes, anio: oldAnio } = getMesAnio(old.fecha_pago);

    // 2) Actualizar pago
    await conn.execute(
      `UPDATE pagos
       SET cliente_id = ?, monto = ?, fecha_pago = ?, metodo_id = ?, referencia = ?, observacion = ?
       WHERE id = ?`,
      [cliente_id, monto, fecha_pago, metodo_id, referencia ?? null, observacion ?? null, id]
    );

    // 3) Recalcular estado del mes/anio previo
    const estadoPrevio = await calcularEstadoMensual(conn, old.cliente_id, oldMes, oldAnio);
    await upsertEstadoMensual(conn, old.cliente_id, oldMes, oldAnio, estadoPrevio);

    // 4) Si cambió de mes/año, recalcular también el nuevo
    const { mes: newMes, anio: newAnio } = getMesAnio(fecha_pago);
    if (oldMes !== newMes || oldAnio !== newAnio || old.cliente_id !== cliente_id) {
      const estadoNuevo = await calcularEstadoMensual(conn, cliente_id, newMes, newAnio);
      await upsertEstadoMensual(conn, cliente_id, newMes, newAnio, estadoNuevo);
    }

    await conn.commit();
    return { affectedRows: 1 };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

export const eliminarPago = async (id) => {
  const db = await connectDB();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener pago para saber qué mes/anio recalcular
    const [rows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Pago no encontrado');
    const pago = rows[0];
    const { mes, anio } = getMesAnio(pago.fecha_pago);

    // 2) Eliminar
    const [result] = await conn.execute('DELETE FROM pagos WHERE id = ?', [id]);

    // 3) Recalcular estado mensual
    const estado = await calcularEstadoMensual(conn, pago.cliente_id, mes, anio);
    await upsertEstadoMensual(conn, pago.cliente_id, mes, anio, estado);

    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};
