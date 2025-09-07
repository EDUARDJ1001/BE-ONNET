import connectDB from '../config/db.js';

// Función para determinar a qué mes aplica el pago
const determinarMesAplicado = (fechaPago, mesPagoEspecifico = null, anioPagoEspecifico = null) => {
  if (mesPagoEspecifico && anioPagoEspecifico) {
    return { mes: parseInt(mesPagoEspecifico), anio: parseInt(anioPagoEspecifico) };
  }
  
  const fechaPagoDate = new Date(fechaPago);
  return { 
    mes: fechaPagoDate.getMonth() + 1, 
    anio: fechaPagoDate.getFullYear() 
  };
};

// Función para calcular estado mensual
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

  // 2) Acumulado del mes específico
  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) as total
     FROM pagos
     WHERE cliente_id = ?
       AND mes_aplicado = ?
       AND anio_aplicado = ?`,
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

// Función para upsert estado mensual
const upsertEstadoMensual = async (conn, cliente_id, mes, anio, estado) => {
  await conn.execute(
    `INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
    [cliente_id, mes, anio, estado]
  );
};

// Validar que el mes aplicado no sea futuro
const validarMesAplicado = (mes, anio) => {
  const hoy = new Date();
  const mesAplicadoDate = new Date(anio, mes - 1, 1);
  return mesAplicadoDate <= hoy;
};

// Obtener todos los pagos
export const obtenerPagos = async () => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    ORDER BY p.fecha_pago DESC, p.id DESC
  `);
  return rows;
};

// Obtener métodos de pago
export const obtenerMetodosPago = async () => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM metodos_pago ORDER BY descripcion');
  return rows;
};

// Obtener pago por ID
export const obtenerPagoPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre,
           c.plan_id, pl.nombre as plan_nombre
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    LEFT JOIN planes pl ON c.plan_id = pl.id
    WHERE p.id = ?
  `, [id]);
  return rows[0];
};

// Obtener pagos por cliente
export const obtenerPagosPorCliente = async (cliente_id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    WHERE p.cliente_id = ?
    ORDER BY p.fecha_pago DESC, p.id DESC
  `, [cliente_id]);
  return rows;
};

// Obtener pagos por mes y año
export const obtenerPagosPorMes = async (mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre
    FROM pagos p 
    LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.mes_aplicado = ? AND p.anio_aplicado = ?
    ORDER BY p.fecha_pago DESC, p.id DESC
  `, [mes, anio]);
  return rows;
};

// Crear nuevo pago
export const crearPago = async (pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // Determinar a qué mes aplica el pago
    const { mes: mesAplicado, anio: anioAplicado } = determinarMesAplicado(
      fecha_pago, 
      mes_aplicado, 
      anio_aplicado
    );

    // Validar que el mes aplicado no sea futuro
    if (!validarMesAplicado(mesAplicado, anioAplicado)) {
      throw new Error('No se pueden registrar pagos para meses futuros');
    }

    // 1) Insertar pago con mes aplicado
    const [result] = await conn.execute(
      `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cliente_id, monto, fecha_pago, metodo_id, referencia ?? null, observacion ?? null, mesAplicado, anioAplicado]
    );

    // 2) Calcular estado mensual y upsert
    const estado = await calcularEstadoMensual(conn, cliente_id, mesAplicado, anioAplicado);
    await upsertEstadoMensual(conn, cliente_id, mesAplicado, anioAplicado, estado);

    await conn.commit();
    return { 
      id: result.insertId, 
      mes_aplicado: mesAplicado, 
      anio_aplicado: anioAplicado 
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Crear pagos para múltiples meses
export const crearPagosMultiplesMeses = async (pagosData) => {
  const { cliente_id, monto_total, fecha_pago, metodo_id, referencia, observacion, meses } = pagosData;
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // Validar que todos los meses no sean futuros
    for (const mesData of meses) {
      if (!validarMesAplicado(mesData.mes, mesData.anio)) {
        throw new Error(`No se pueden registrar pagos para meses futuros: ${mesData.mes}/${mesData.anio}`);
      }
    }

    const resultados = [];
    const montoPorMes = monto_total / meses.length;

    for (const mesData of meses) {
      // 1) Insertar pago para cada mes
      const [result] = await conn.execute(
        `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cliente_id, 
          montoPorMes, 
          fecha_pago, 
          metodo_id, 
          referencia ?? null, 
          observacion ?? null, 
          mesData.mes, 
          mesData.anio
        ]
      );

      // 2) Calcular estado mensual y upsert para cada mes
      const estado = await calcularEstadoMensual(conn, cliente_id, mesData.mes, mesData.anio);
      await upsertEstadoMensual(conn, cliente_id, mesData.mes, mesData.anio, estado);

      resultados.push({
        id: result.insertId,
        mes_aplicado: mesData.mes,
        anio_aplicado: mesData.anio,
        monto: montoPorMes
      });
    }

    await conn.commit();
    return resultados;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Actualizar pago existente
export const actualizarPago = async (id, pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // 1) Obtener pago actual
    const [oldRows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new Error('Pago no encontrado');
    const old = oldRows[0];

    // Determinar nuevo mes aplicado
    const { mes: newMesAplicado, anio: newAnioAplicado } = determinarMesAplicado(
      fecha_pago, 
      mes_aplicado, 
      anio_aplicado
    );

    // Validar que el mes aplicado no sea futuro
    if (!validarMesAplicado(newMesAplicado, newAnioAplicado)) {
      throw new Error('No se pueden registrar pagos para meses futuros');
    }

    // 2) Actualizar pago
    await conn.execute(
      `UPDATE pagos
       SET cliente_id = ?, monto = ?, fecha_pago = ?, metodo_id = ?, referencia = ?, 
           observacion = ?, mes_aplicado = ?, anio_aplicado = ?
       WHERE id = ?`,
      [
        cliente_id, monto, fecha_pago, metodo_id, referencia ?? null, 
        observacion ?? null, newMesAplicado, newAnioAplicado, id
      ]
    );

    // 3) Recalcular todos los meses afectados
    const mesesAActualizar = new Set();
    
    // Mes original del pago
    mesesAActualizar.add(`${old.mes_aplicado}-${old.anio_aplicado}-${old.cliente_id}`);
    
    // Nuevo mes del pago
    mesesAActualizar.add(`${newMesAplicado}-${newAnioAplicado}-${cliente_id}`);
    
    // Si cambió el cliente, recalcular el mes original para el cliente anterior
    if (old.cliente_id !== cliente_id) {
      mesesAActualizar.add(`${old.mes_aplicado}-${old.anio_aplicado}-${old.cliente_id}`);
    }

    // Recalcular cada mes afectado
    for (const mesKey of mesesAActualizar) {
      const [mesStr, anioStr, clienteIdStr] = mesKey.split('-');
      const mesRecalc = parseInt(mesStr);
      const anioRecalc = parseInt(anioStr);
      const clienteRecalc = parseInt(clienteIdStr);
      
      const estado = await calcularEstadoMensual(conn, clienteRecalc, mesRecalc, anioRecalc);
      await upsertEstadoMensual(conn, clienteRecalc, mesRecalc, anioRecalc, estado);
    }

    await conn.commit();
    return { 
      affectedRows: 1, 
      mes_aplicado: newMesAplicado, 
      anio_aplicado: newAnioAplicado 
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Eliminar pago
export const eliminarPago = async (id) => {
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // 1) Obtener pago para saber qué mes/anio recalcular
    const [rows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Pago no encontrado');
    const pago = rows[0];

    // 2) Eliminar pago
    const [result] = await conn.execute('DELETE FROM pagos WHERE id = ?', [id]);

    // 3) Recalcular estado mensual del mes afectado
    const estado = await calcularEstadoMensual(conn, pago.cliente_id, pago.mes_aplicado, pago.anio_aplicado);
    await upsertEstadoMensual(conn, pago.cliente_id, pago.mes_aplicado, pago.anio_aplicado, estado);

    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Obtener resumen de pagos por cliente y mes
export const obtenerResumenPagosCliente = async (cliente_id, mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT 
      c.nombre,
      p.precio_mensual,
      COALESCE(SUM(pg.monto), 0) as total_pagado,
      CASE 
        WHEN COALESCE(SUM(pg.monto), 0) >= p.precio_mensual THEN 'Pagado'
        WHEN COALESCE(SUM(pg.monto), 0) > 0 THEN 'Pagado Parcial'
        ELSE 'Pendiente'
      END as estado
    FROM clientes c
    JOIN planes p ON c.plan_id = p.id
    LEFT JOIN pagos pg ON c.id = pg.cliente_id 
      AND pg.mes_aplicado = ? 
      AND pg.anio_aplicado = ?
    WHERE c.id = ?
    GROUP BY c.id, p.precio_mensual
  `, [mes, anio, cliente_id]);
  
  return rows[0] || null;
};

// Obtener meses pendientes de pago para un cliente
export const obtenerMesesPendientes = async (cliente_id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT 
      em.mes,
      em.anio,
      em.estado,
      p.precio_mensual,
      (SELECT COALESCE(SUM(monto), 0) 
       FROM pagos 
       WHERE cliente_id = ? 
         AND mes_aplicado = em.mes 
         AND anio_aplicado = em.anio) as total_pagado
    FROM estado_mensual em
    JOIN clientes c ON em.cliente_id = c.id
    JOIN planes p ON c.plan_id = p.id
    WHERE em.cliente_id = ?
    ORDER BY em.anio DESC, em.mes DESC
  `, [cliente_id, cliente_id]);
  
  return rows;
};
