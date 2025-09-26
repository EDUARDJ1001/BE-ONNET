// src/models/pagoModel.js
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
   Helpers de negocio (nuevo)
   ============================ */

// Lee suspensión desde estado_mensual.
// Regla: si existe registro para ese (cliente, mes, anio) y su estado = 'Suspendido' => está suspendido.
// Si no hay registro EXACTO, opcionalmente puedes mirar el último estado <= ese mes (fallback).
const estaClienteSuspendidoEnPeriodo = async (conn, cliente_id, mes, anio, { usarFallback = true } = {}) => {
  const [[exacto]] = await conn.execute(
    `SELECT estado
       FROM estado_mensual
      WHERE cliente_id = ? AND mes = ? AND anio = ?
      LIMIT 1`,
    [cliente_id, mes, anio]
  );
  if (exacto) return exacto.estado === 'Suspendido';
  if (!usarFallback) return false;

  const [[previo]] = await conn.execute(
    `SELECT estado
       FROM estado_mensual
      WHERE cliente_id = ?
        AND (anio < ? OR (anio = ? AND mes <= ?))
      ORDER BY anio DESC, mes DESC
      LIMIT 1`,
    [cliente_id, anio, anio, mes]
  );
  return (previo?.estado === 'Suspendido');
};

const buscarUltimoMesPendienteNoSuspendido = async (conn, cliente_id) => {
  const [[cli]] = await conn.execute(
    `SELECT p.precio_mensual
       FROM clientes c JOIN planes p ON p.id = c.plan_id
      WHERE c.id = ?`,
    [cliente_id]
  );
  if (!cli) throw new Error(`Cliente ${cliente_id} sin plan asociado`);
  const precioMensual = Number(cli.precio_mensual ?? 0);

  const [rows] = await conn.execute(
    `SELECT em.mes, em.anio, em.estado,
            (SELECT COALESCE(SUM(pg.monto),0)
               FROM pagos pg
              WHERE pg.cliente_id = em.cliente_id
                AND pg.mes_aplicado = em.mes
                AND pg.anio_aplicado = em.anio
                AND (pg.anulado IS NULL OR pg.anulado = 0)
            ) AS total_pagado
       FROM estado_mensual em
      WHERE em.cliente_id = ?
        AND (em.anio < YEAR(UTC_DATE()) OR (em.anio = YEAR(UTC_DATE()) AND em.mes <= MONTH(UTC_DATE())))
      ORDER BY em.anio DESC, em.mes DESC`,
    [cliente_id]
  );

  for (const r of rows) {
    if (r.estado === 'Suspendido') continue; // saltar suspendidos
    const total = Number(r.total_pagado || 0);
    const completo = precioMensual > 0 ? total >= precioMensual : total > 0;
    if (!completo) return { mes: r.mes, anio: r.anio };
  }
  return null;
};

// Obtener estado_mensual para un mes/año
const obtenerEstadoMensualFila = async (conn, cliente_id, mes, anio) => {
  const [[row]] = await conn.execute(
    `SELECT * FROM estado_mensual WHERE cliente_id = ? AND mes = ? AND anio = ?`,
    [cliente_id, mes, anio]
  );
  return row || null;
};

// Devuelve el último mes (más reciente) pendiente NO suspendido hasta el mes actual
const getUltimoMesPendienteNoSuspendido = async (conn, cliente_id) => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth() + 1;

  const [rows] = await conn.execute(
    `SELECT em.mes, em.anio, em.estado
       FROM estado_mensual em
      WHERE em.cliente_id = ?
        AND (em.anio < ? OR (em.anio = ? AND em.mes <= ?))
        AND em.estado NOT IN ('Pagado', 'Suspendido')
      ORDER BY em.anio DESC, em.mes DESC
      LIMIT 1`,
    [cliente_id, y, y, m]
  );

  return rows[0] ? { mes: rows[0].mes, anio: rows[0].anio } : null;
};

// Resuelve mes/año final aplicando política de suspensión y futuros
const resolverMesAplicadoConPolitica = async (conn, cliente_id, fecha_pago, mes_expl, anio_expl) => {
  // 1) Punto de partida (explícito o derivado de fecha_pago)
  let { mes, anio } = determinarMesAplicado(fecha_pago, mes_expl, anio_expl);

  const esExplicito = Number.isInteger(mes_expl) && Number.isInteger(anio_expl);
  const okRango = validarMesAplicado(mes, anio, { permitirFuturos: esExplicito, maxMesesFuturo: 60 });
  if (!okRango) throw new Error('Mes/año aplicado inválido o fuera de rango permitido');

  // 2) Política:
  //   - Si viene explícito: se respeta (aunque esté suspendido) -> permite pago para normalizar estado.
  //   - Si NO es explícito y el periodo está suspendido: se reasigna al último mes pendiente no suspendido (≤ hoy).
  if (!esExplicito) {
    const suspendido = await estaClienteSuspendidoEnPeriodo(conn, cliente_id, mes, anio, { usarFallback: true });
    if (suspendido) {
      const ultimo = await buscarUltimoMesPendienteNoSuspendido(conn, cliente_id);
      if (!ultimo) {
        // No hay dónde aplicarlo sin suspensión
        throw new Error('El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago');
      }
      // reasignación
      mes = ultimo.mes;
      anio = ultimo.anio;
    }
  }

  // 3) Resultado final
  return { mes, anio };
};


/* ============================
   Cálculo / Upsert de estado mensual
   ============================ */

const calcularEstadoMensual = async (conn, cliente_id, mes, anio) => {
  const [[cli]] = await conn.execute(
    `SELECT p.precio_mensual
       FROM clientes c
       JOIN planes p ON p.id = c.plan_id
      WHERE c.id = ?`,
    [cliente_id]
  );
  if (!cli) {
    throw new Error(`Cliente ${cliente_id} sin plan asociado`);
  }
  const precioMensual = Number(cli.precio_mensual ?? 0);

  // Acumulado del mes específico
  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) as total
       FROM pagos
      WHERE cliente_id = ?
        AND mes_aplicado = ?
        AND anio_aplicado = ?`,
    [cliente_id, mes, anio]
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

const upsertEstadoMensual = async (conn, cliente_id, mes, anio, estado) => {
  await conn.execute(
    `INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
    [cliente_id, mes, anio, estado]
  );
};

/* ============================
   Queries de lectura
   ============================ */

// Obtener todos los pagos
export const obtenerPagos = async () => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre
      FROM pagos p 
 LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
 LEFT JOIN clientes c      ON p.cliente_id = c.id
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
 LEFT JOIN clientes c      ON p.cliente_id = c.id
 LEFT JOIN planes pl       ON c.plan_id = pl.id
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

// Obtener pagos por mes y año (basado en fecha_pago)
export const obtenerPagosPorMes = async (mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre
      FROM pagos p 
 LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
 LEFT JOIN clientes c      ON p.cliente_id = c.id
     WHERE MONTH(p.fecha_pago) = ? AND YEAR(p.fecha_pago) = ?
  ORDER BY p.fecha_pago DESC, p.id DESC
  `, [mes, anio]);
  return rows;
};

/* ============================
   Crear / Actualizar / Eliminar pagos
   ============================ */

// Crear nuevo pago (respeta política de saltar suspendidos)
export const crearPago = async (pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const { mes, anio } = await resolverMesAplicadoConPolitica(
      conn, cliente_id, fecha_pago, mes_aplicado, anio_aplicado
    );

    const [result] = await conn.execute(
      `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cliente_id, monto, fecha_pago, metodo_id, referencia ?? null, observacion ?? null, mes, anio]
    );

    const estado = await calcularEstadoMensual(conn, cliente_id, mes, anio);
    await upsertEstadoMensual(conn, cliente_id, mes, anio, estado);

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

// Crear pagos múltiples (omite meses suspendidos; PERMITE FUTUROS)
export const crearPagosMultiplesMeses = async (pagosData) => {
  const { cliente_id, monto_total, fecha_pago, metodo_id, referencia, observacion, meses } = pagosData;
  const db = await connectDB();
  const conn = await db.getConnection();

  // Helper sencillo para validar rango de mes/año
  const esMesAnioValido = (mes, anio) =>
    Number.isInteger(mes) && mes >= 1 && mes <= 12 && Number.isInteger(anio) && anio >= 2000 && anio <= 9999;

  try {
    await conn.beginTransaction();

    if (!Array.isArray(meses) || meses.length === 0) {
      throw new Error('Debe especificar al menos un mes para el pago.');
    }

    // 1) Normalizamos y validamos mes/año (pero YA NO restringimos a pasado/presente)
    const mesesNormalizados = [];
    for (const { mes, anio } of meses) {
      const m = parseInt(mes);
      const a = parseInt(anio);
      if (!esMesAnioValido(m, a)) {
        throw new Error(`Mes/Año inválidos: ${mes}/${anio}`);
      }
      mesesNormalizados.push({ mes: m, anio: a });
    }

    // 2) Filtra: omitir suspendidos
    const mesesNoSuspendidos = [];
    for (const { mes, anio } of mesesNormalizados) {
      const fila = await obtenerEstadoMensualFila(conn, cliente_id, mes, anio);
      if (fila?.estado === 'Suspendido') continue;
      mesesNoSuspendidos.push({ mes, anio });
    }
    if (mesesNoSuspendidos.length === 0) {
      throw new Error('Los meses seleccionados están suspendidos. No hay meses disponibles para aplicar el pago.');
    }

    // 3) Repartición exacta según cantidad final de meses
    const montos = repartirMonto(monto_total, mesesNoSuspendidos.length);

    const resultados = [];
    for (let i = 0; i < mesesNoSuspendidos.length; i++) {
      const { mes, anio } = mesesNoSuspendidos[i];
      const montoPorMes = montos[i];

      const [result] = await conn.execute(
        `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cliente_id, montoPorMes, fecha_pago, metodo_id, referencia ?? null, observacion ?? null, mes, anio]
      );

      const estado = await calcularEstadoMensual(conn, cliente_id, mes, anio);
      await upsertEstadoMensual(conn, cliente_id, mes, anio, estado);

      resultados.push({ id: result.insertId, mes_aplicado: mes, anio_aplicado: anio, monto: montoPorMes });
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

// Actualizar pago (reaplica política si el mes nuevo cae en suspendido)
export const actualizarPago = async (id, pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // Obtener pago original
    const [oldRows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new Error('Pago no encontrado');
    const old = oldRows[0];

    // Resolver nuevo mes/año con política
    const { mes: newMesAplicado, anio: newAnioAplicado } = await resolverMesAplicadoConPolitica(
      conn, cliente_id, fecha_pago, mes_aplicado, anio_aplicado
    );

    // Actualizar pago
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

    // Recalcular estados mensuales afectados
    const claves = new Set([
      `${old.mes_aplicado}-${old.anio_aplicado}-${old.cliente_id}`,
      `${newMesAplicado}-${newAnioAplicado}-${cliente_id}`
    ]);
    if (old.cliente_id !== cliente_id) {
      claves.add(`${old.mes_aplicado}-${old.anio_aplicado}-${old.cliente_id}`);
    }

    for (const key of claves) {
      const [mesStr, anioStr, clienteIdStr] = key.split('-');
      const mesRecalc = parseInt(mesStr);
      const anioRecalc = parseInt(anioStr);
      const clienteRecalc = parseInt(clienteIdStr);
      
      const estado = await calcularEstadoMensual(conn, clienteRecalc, mesRecalc, anioRecalc);
      await upsertEstadoMensual(conn, clienteRecalc, mesRecalc, anioRecalc, estado);
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

// Eliminar pago
export const eliminarPago = async (id) => {
  const db = await connectDB();
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Pago no encontrado');
    const pago = rows[0];

    const [result] = await conn.execute('DELETE FROM pagos WHERE id = ?', [id]);

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

/* ============================
   Resúmenes / Listas de meses
   ============================ */

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

// Meses pendientes (excluye suspendidos para fines de cobro)
export const obtenerMesesPendientes = async (cliente_id) => {
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
         FROM pagos 
        WHERE cliente_id = ? 
          AND mes_aplicado = em.mes 
          AND anio_aplicado = em.anio) AS total_pagado
      FROM estado_mensual em
      JOIN clientes c ON em.cliente_id = c.id
      JOIN planes p   ON c.plan_id = p.id
     WHERE em.cliente_id = ?
       AND (em.anio < ? OR (em.anio = ? AND em.mes <= ?))
       AND em.estado NOT IN ('Pagado','Suspendido')   -- << omite suspendidos aquí >>
  ORDER BY em.anio DESC, em.mes DESC
  `, [cliente_id, cliente_id, y, y, m]);

  return rows;
};
