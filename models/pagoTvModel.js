// src/models/pagoTvModel.js
import connectDB from '../config/db.js';

/* ============================
   Utilidades de fecha / validación
   ============================ */

// Determinar a qué mes aplica el pago (si no se especifica, usa la fecha de pago)
const determinarMesAplicado = (fechaPago, mesPagoEspecifico = null, anioPagoEspecifico = null) => {
  const toInt = v => (v === null || v === undefined || v === '' ? null : parseInt(v, 10));
  const m = toInt(mesPagoEspecifico);
  const y = toInt(anioPagoEspecifico);

  if (m && y) return { mes: m, anio: y };

  const d = new Date(fechaPago);
  if (Number.isNaN(d.getTime())) throw new Error('fecha_pago inválida');
  return { mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() };
};

// Validar que el mes aplicado no sea futuro
const validarMesAplicado = (mes, anio, { permitirFuturos = false, maxMesesFuturo = 60 } = {}) => {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return false;

  const now = new Date();
  const currentUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const appliedUTC = new Date(Date.UTC(anio, mes - 1, 1));

  if (!permitirFuturos) return appliedUTC <= currentUTC;

  const maxUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + maxMesesFuturo, 1));
  return appliedUTC <= maxUTC;
};

/* ============================
   Helpers de negocio (adaptados para TV)
   ============================ */

// Validar que el cliente existe
const validarClienteTvExiste = async (conn, clientetv_id) => {
  const [[cliente]] = await conn.execute(
    'SELECT id FROM clientestv WHERE id = ?',
    [clientetv_id]
  );
  return !!cliente;
};

// Lee suspensión desde estado_mensual_tv
const estaClienteSuspendidoEnPeriodo = async (conn, clientetv_id, mes, anio, { usarFallback = true } = {}) => {
  const [[exacto]] = await conn.execute(
    `SELECT estado
       FROM estado_mensual_tv
      WHERE clientetv_id = ? AND mes = ? AND anio = ?
      LIMIT 1`,
    [clientetv_id, mes, anio]
  );
  if (exacto) return exacto.estado === 'Suspendido';
  if (!usarFallback) return false;

  const [[previo]] = await conn.execute(
    `SELECT estado
       FROM estado_mensual_tv
      WHERE clientetv_id = ?
        AND (anio < ? OR (anio = ? AND mes <= ?))
      ORDER BY anio DESC, mes DESC
      LIMIT 1`,
    [clientetv_id, anio, anio, mes]
  );
  return (previo?.estado === 'Suspendido');
};

const buscarUltimoMesPendienteNoSuspendido = async (conn, clientetv_id) => {
  const [[cli]] = await conn.execute(
    `SELECT pt.precio_mensual
       FROM clientestv ct JOIN planestv pt ON pt.id = ct.plantv_id
      WHERE ct.id = ?`,
    [clientetv_id]
  );
  if (!cli) throw new Error(`Cliente TV ${clientetv_id} sin plan asociado`);
  const precioMensual = Number(cli.precio_mensual ?? 0);

  const [rows] = await conn.execute(
    `SELECT em.mes, em.anio, em.estado,
            (SELECT COALESCE(SUM(pg.monto),0)
               FROM pagostv pg
              WHERE pg.clientetv_id = em.clientetv_id
                AND pg.mes_aplicado = em.mes
                AND pg.anio_aplicado = em.anio
                AND (pg.anulado IS NULL OR pg.anulado = 0)
            ) AS total_pagado
       FROM estado_mensual_tv em
      WHERE em.clientetv_id = ?
        AND (em.anio < YEAR(UTC_DATE()) OR (em.anio = YEAR(UTC_DATE()) AND em.mes <= MONTH(UTC_DATE())))
      ORDER BY em.anio DESC, em.mes DESC`,
    [clientetv_id]
  );

  for (const r of rows) {
    if (r.estado === 'Suspendido') continue;
    const total = Number(r.total_pagado || 0);
    const completo = precioMensual > 0 ? total >= precioMensual : total > 0;
    if (!completo) return { mes: r.mes, anio: r.anio };
  }
  return null;
};

// Obtener estado_mensual_tv para un mes/año
const obtenerEstadoMensualFila = async (conn, clientetv_id, mes, anio) => {
  const [[row]] = await conn.execute(
    `SELECT * FROM estado_mensual_tv WHERE clientetv_id = ? AND mes = ? AND anio = ?`,
    [clientetv_id, mes, anio]
  );
  return row || null;
};

// Resuelve mes/año final aplicando política de suspensión y futuros
const resolverMesAplicadoConPolitica = async (conn, clientetv_id, fecha_pago, mes_expl, anio_expl) => {
  let { mes, anio } = determinarMesAplicado(fecha_pago, mes_expl, anio_expl);

  const esExplicito = Number.isInteger(mes_expl) && Number.isInteger(anio_expl);
  const okRango = validarMesAplicado(mes, anio, { permitirFuturos: esExplicito, maxMesesFuturo: 60 });
  if (!okRango) throw new Error('Mes/año aplicado inválido o fuera de rango permitido');

  if (!esExplicito) {
    const suspendido = await estaClienteSuspendidoEnPeriodo(conn, clientetv_id, mes, anio, { usarFallback: true });
    if (suspendido) {
      const ultimo = await buscarUltimoMesPendienteNoSuspendido(conn, clientetv_id);
      if (!ultimo) {
        throw new Error('El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago');
      }
      mes = ultimo.mes;
      anio = ultimo.anio;
    }
  }

  return { mes, anio };
};

/* ============================
   Cálculo / Upsert de estado mensual TV
   ============================ */

const calcularEstadoMensualTv = async (conn, clientetv_id, mes, anio) => {
  const [[cli]] = await conn.execute(
    `SELECT pt.precio_mensual
       FROM clientestv ct
       JOIN planestv pt ON pt.id = ct.plantv_id
      WHERE ct.id = ?`,
    [clientetv_id]
  );
  if (!cli) {
    throw new Error(`Cliente TV ${clientetv_id} sin plan asociado`);
  }
  const precioMensual = Number(cli.precio_mensual ?? 0);

  // Acumulado del mes específico
  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) as total
       FROM pagostv
      WHERE clientetv_id = ?
        AND mes_aplicado = ?
        AND anio_aplicado = ?`,
    [clientetv_id, mes, anio]
  );
  const acumulado = Number(sumRow.total);

  // Determinar estado
  let estado = 'Pendiente';
  if (precioMensual > 0) {
    if (acumulado >= precioMensual) estado = 'Pagado';
    else if (acumulado > 0) estado = 'Pagado Parcial';
  } else {
    estado = acumulado > 0 ? 'Pagado' : 'Pendiente';
  }

  return estado;
};

const upsertEstadoMensualTv = async (conn, clientetv_id, mes, anio, estado) => {
  await conn.execute(
    `INSERT INTO estado_mensual_tv (clientetv_id, mes, anio, estado)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
    [clientetv_id, mes, anio, estado]
  );
};

/* ============================
   Queries de lectura TV
   ============================ */

// Obtener todos los pagos TV
export const obtenerPagosTv = async () => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, c.nombre as cliente_nombre, c.usuario
      FROM pagostv p 
 LEFT JOIN clientestv c ON p.clientetv_id = c.id
  ORDER BY p.fecha_pago DESC, p.id DESC
  `);
  return rows;
};

// Obtener pago TV por ID
export const obtenerPagoTvPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, c.nombre as cliente_nombre, c.usuario,
           c.plantv_id, pt.nombre as plan_nombre, pt.precio_mensual as precio
      FROM pagostv p 
 LEFT JOIN clientestv c ON p.clientetv_id = c.id
 LEFT JOIN planestv pt ON c.plantv_id = pt.id
     WHERE p.id = ?
  `, [id]);
  return rows[0];
};

// Obtener pagos por cliente TV
export const obtenerPagosPorClienteTv = async (clientetv_id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, c.nombre as cliente_nombre, c.usuario
      FROM pagostv p 
 LEFT JOIN clientestv c ON p.clientetv_id = c.id
     WHERE p.clientetv_id = ?
  ORDER BY p.fecha_pago DESC, p.id DESC
  `, [clientetv_id]);
  return rows;
};

// Obtener pagos por mes y año (basado en fecha_pago)
export const obtenerPagosTvPorMes = async (mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, c.nombre as cliente_nombre, c.usuario
      FROM pagostv p 
 LEFT JOIN clientestv c ON p.clientetv_id = c.id
     WHERE MONTH(p.fecha_pago) = ? AND YEAR(p.fecha_pago) = ?
  ORDER BY p.fecha_pago DESC, p.id DESC
  `, [mes, anio]);
  return rows;
};

/* ============================
   Crear / Actualizar / Eliminar pagos TV
   ============================ */

// Crear nuevo pago TV
export const crearPagoTv = async (pago) => {
  const { clientetv_id, monto, fecha_pago, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Validar que el cliente existe
    const clienteExiste = await validarClienteTvExiste(conn, clientetv_id);
    if (!clienteExiste) {
      throw new Error(`Cliente TV ${clientetv_id} no existe`);
    }

    const { mes, anio } = await resolverMesAplicadoConPolitica(
      conn, clientetv_id, fecha_pago, mes_aplicado, anio_aplicado
    );

    const [result] = await conn.execute(
      `INSERT INTO pagostv (clientetv_id, monto, fecha_pago, observacion, mes_aplicado, anio_aplicado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientetv_id, monto, fecha_pago, observacion ?? null, mes, anio]
    );

    const estado = await calcularEstadoMensualTv(conn, clientetv_id, mes, anio);
    await upsertEstadoMensualTv(conn, clientetv_id, mes, anio, estado);

    await conn.commit();
    return { id: result.insertId, mes_aplicado: mes, anio_aplicado: anio };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Reparto exacto de un total en N partes (redondeo a centavos)
const repartirMonto = (total, n) => {
  const cents = Math.round(Number(total) * 100);
  const base = Math.floor(cents / n);
  let remainder = cents - base * n;
  const parts = Array.from({ length: n }, () => base);
  for (let i = 0; i < remainder; i++) parts[i] += 1;
  return parts.map(c => c / 100);
};

// Crear pagos múltiples TV
export const crearPagosMultiplesMesesTv = async (pagosData) => {
  // Normaliza el nombre del campo ID del cliente
  const clientetv_id =
    pagosData.clientetv_id ??
    pagosData.clienteTv_id ??
    pagosData.cliente_id ?? null;

  const { monto_total, fecha_pago, observacion, meses } = pagosData;

  const db = await connectDB();
  const conn = await db.getConnection();

  const esMesAnioValido = (mes, anio) =>
    Number.isInteger(mes) &&
    mes >= 1 &&
    mes <= 12 &&
    Number.isInteger(anio) &&
    anio >= 2000 &&
    anio <= 9999;

  try {
    await conn.beginTransaction();

    // Validaciones iniciales fuertes
    if (!clientetv_id || clientetv_id <= 0) {
      throw new Error('clientetv_id es requerido y debe ser > 0.');
    }

    // Validar que el cliente existe
    const clienteExiste = await validarClienteTvExiste(conn, clientetv_id);
    if (!clienteExiste) {
      throw new Error(`Cliente TV ${clientetv_id} no existe`);
    }

    if (monto_total == null || Number.isNaN(Number(monto_total))) {
      throw new Error('monto_total es requerido y debe ser numérico.');
    }
    if (!fecha_pago) {
      throw new Error('fecha_pago es requerida.');
    }
    if (!Array.isArray(meses) || meses.length === 0) {
      throw new Error('Debe especificar al menos un mes para el pago (arreglo meses).');
    }

    // Normalizar meses
    const mesesNormalizados = [];
    for (const item of meses) {
      const m = parseInt(String(item.mes), 10);
      const a = parseInt(String(item.anio), 10);

      if (!esMesAnioValido(m, a)) {
        throw new Error(`Mes/Año inválidos: ${item.mes}/${item.anio}`);
      }

      mesesNormalizados.push({ mes: m, anio: a });
    }

    // Filtrar meses suspendidos
    const mesesNoSuspendidos = [];
    for (const { mes, anio } of mesesNormalizados) {
      const fila = await obtenerEstadoMensualFila(conn, clientetv_id, mes, anio);
      if (fila?.estado === 'Suspendido') continue;
      mesesNoSuspendidos.push({ mes, anio });
    }

    if (mesesNoSuspendidos.length === 0) {
      throw new Error(
        'Los meses seleccionados están suspendidos. No hay meses disponibles para aplicar el pago.'
      );
    }

    // Repartir el monto total entre meses
    const montos = repartirMonto(monto_total, mesesNoSuspendidos.length);

    const resultados = [];
    for (let i = 0; i < mesesNoSuspendidos.length; i++) {
      const { mes, anio } = mesesNoSuspendidos[i];
      const montoPorMes = montos[i];

      const [result] = await conn.execute(
        `INSERT INTO pagostv (clientetv_id, monto, fecha_pago, observacion, mes_aplicado, anio_aplicado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          clientetv_id,
          montoPorMes,
          fecha_pago,
          observacion ?? null,
          mes,
          anio,
        ]
      );

      const estado = await calcularEstadoMensualTv(conn, clientetv_id, mes, anio);
      await upsertEstadoMensualTv(conn, clientetv_id, mes, anio, estado);

      resultados.push({
        id: result.insertId,
        mes_aplicado: mes,
        anio_aplicado: anio,
        monto: montoPorMes,
      });
    }

    await conn.commit();
    return resultados;
  } catch (e) {
    await conn.rollback();
    console.error('Error al registrar pagos múltiples Tv:', e);
    throw e;
  } finally {
    conn.release();
  }
};

// Actualizar pago TV
export const actualizarPagoTv = async (id, pago) => {
  const { clientetv_id, monto, fecha_pago, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    const [oldRows] = await conn.execute('SELECT * FROM pagostv WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new Error('Pago no encontrado');
    const old = oldRows[0];

    // Validar que el cliente existe
    const clienteExiste = await validarClienteTvExiste(conn, clientetv_id);
    if (!clienteExiste) {
      throw new Error(`Cliente TV ${clientetv_id} no existe`);
    }

    const { mes: newMesAplicado, anio: newAnioAplicado } = await resolverMesAplicadoConPolitica(
      conn, clientetv_id, fecha_pago, mes_aplicado, anio_aplicado
    );

    await conn.execute(
      `UPDATE pagostv
          SET clientetv_id = ?, monto = ?, fecha_pago = ?, observacion = ?, 
              mes_aplicado = ?, anio_aplicado = ?
        WHERE id = ?`,
      [clientetv_id, monto, fecha_pago, observacion ?? null, newMesAplicado, newAnioAplicado, id]
    );

    const claves = new Set([
      `${old.mes_aplicado}-${old.anio_aplicado}-${old.clientetv_id}`,
      `${newMesAplicado}-${newAnioAplicado}-${clientetv_id}`
    ]);
    if (old.clientetv_id !== clientetv_id) {
      claves.add(`${old.mes_aplicado}-${old.anio_aplicado}-${old.clientetv_id}`);
    }

    for (const key of claves) {
      const [mesStr, anioStr, clienteIdStr] = key.split('-');
      const mesRecalc = parseInt(mesStr);
      const anioRecalc = parseInt(anioStr);
      const clienteRecalc = parseInt(clienteIdStr);
      
      const estado = await calcularEstadoMensualTv(conn, clienteRecalc, mesRecalc, anioRecalc);
      await upsertEstadoMensualTv(conn, clienteRecalc, mesRecalc, anioRecalc, estado);
    }

    await conn.commit();
    return { affectedRows: 1, mes_aplicado: newMesAplicado, anio_aplicado: newAnioAplicado };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Eliminar pago TV
export const eliminarPagoTv = async (id) => {
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM pagostv WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Pago no encontrado');
    const pago = rows[0];

    const [result] = await conn.execute('DELETE FROM pagostv WHERE id = ?', [id]);

    const estado = await calcularEstadoMensualTv(conn, pago.clientetv_id, pago.mes_aplicado, pago.anio_aplicado);
    await upsertEstadoMensualTv(conn, pago.clientetv_id, pago.mes_aplicado, pago.anio_aplicado, estado);

    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/* ============================
   Resúmenes / Listas de meses TV
   ============================ */

export const obtenerResumenPagosClienteTv = async (clientetv_id, mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT 
      c.nombre,
      c.usuario,
      p.precio_mensual as precio,
      COALESCE(SUM(pg.monto), 0) as total_pagado,
      CASE 
        WHEN COALESCE(SUM(pg.monto), 0) >= p.precio_mensual THEN 'Pagado'
        WHEN COALESCE(SUM(pg.monto), 0) > 0 THEN 'Pagado Parcial'
        ELSE 'Pendiente'
      END as estado
      FROM clientestv c
      JOIN planestv p ON c.plantv_id = p.id
 LEFT JOIN pagostv pg ON c.id = pg.clientetv_id 
                    AND pg.mes_aplicado = ? 
                    AND pg.anio_aplicado = ?
     WHERE c.id = ?
  GROUP BY c.id, p.precio_mensual
  `, [mes, anio, clientetv_id]);
  
  return rows[0] || null;
};

// Meses pendientes TV
export const obtenerMesesPendientesTv = async (clientetv_id) => {
  const db = await connectDB();
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth() + 1;

  const [rows] = await db.execute(`
    SELECT 
      em.id,
      em.mes,
      em.anio,
      em.estado,
      p.precio_mensual,
      (SELECT COALESCE(SUM(monto), 0) 
         FROM pagostv 
        WHERE clientetv_id = ? 
          AND mes_aplicado = em.mes 
          AND anio_aplicado = em.anio) AS total_pagado
      FROM estado_mensual_tv em
      JOIN clientestv c ON em.clientetv_id = c.id
      JOIN planestv p   ON c.plantv_id = p.id
     WHERE em.clientetv_id = ?
       AND (em.anio < ? OR (em.anio = ? AND em.mes <= ?))
       AND em.estado NOT IN ('Pagado','Suspendido')
  ORDER BY em.anio DESC, em.mes DESC
  `, [clientetv_id, clientetv_id, y, y, m]);

  return rows;
};
