// src/models/pagoModel.js
import connectDB from '../config/db.js';

/* ============================
   Utilidades de fecha / validación
   ============================ */

// Normaliza fecha a 'YYYY-MM-DD' (sin zona horaria, sin horas)
const normalizarFechaPagoYYYYMMDD = (fecha) => {
  if (!fecha) throw new Error('fecha_pago requerida');

  // Si ya viene 'YYYY-MM-DD'
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  // Si viene ISO completo: 'YYYY-MM-DDTHH:mm:ss...'
  if (typeof fecha === 'string') {
    const match = fecha.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  // Si viene Date
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  throw new Error('fecha_pago inválida');
};

// Extrae mes/año desde 'YYYY-MM-DD' sin usar Date()
const mesAnioDesdeYYYYMMDD = (yyyy_mm_dd) => {
  const m = typeof yyyy_mm_dd === 'string' ? yyyy_mm_dd.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) throw new Error('fecha_pago inválida');

  const anio = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error('fecha_pago inválida');
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new Error('fecha_pago inválida');

  return { mes, anio };
};

// Determinar a qué mes aplica el pago (si no se especifica, usa la fecha de pago)
const determinarMesAplicado = (fechaPago, mesPagoEspecifico = null, anioPagoEspecifico = null) => {
  const toInt = (v) => (v === null || v === undefined || v === '' ? null : parseInt(v, 10));
  const m = toInt(mesPagoEspecifico);
  const y = toInt(anioPagoEspecifico);

  if (m && y) return { mes: m, anio: y };

  const fechaYYYYMMDD = normalizarFechaPagoYYYYMMDD(fechaPago);
  return mesAnioDesdeYYYYMMDD(fechaYYYYMMDD);
};

// Validar que el mes aplicado no sea futuro (comparación por mes/año local, sin UTC)
const validarMesAplicado = (mes, anio, { permitirFuturos = false, maxMesesFuturo = 60 } = {}) => {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return false;

  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  const applied = new Date(anio, mes - 1, 1);

  if (!permitirFuturos) return applied <= current;

  const max = new Date(now.getFullYear(), now.getMonth() + maxMesesFuturo, 1);
  return applied <= max;
};

/* ============================
   Helpers de negocio
   ============================ */

// Meses que no se le pueden cobrar al cliente:
// - 'Suspendido': decisión del negocio, no se factura.
// - 'Sin servicio': anterior a la instalación, todavía no era cliente.
const ESTADOS_NO_COBRABLES = ['Suspendido', 'Sin servicio'];

const esMesNoCobrable = (estado) => ESTADOS_NO_COBRABLES.includes(estado);

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
  return previo?.estado === 'Suspendido';
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
            ) AS total_pagado
       FROM estado_mensual em
      WHERE em.cliente_id = ?
        AND (em.anio < YEAR(CURDATE()) OR (em.anio = YEAR(CURDATE()) AND em.mes <= MONTH(CURDATE())))
      ORDER BY em.anio DESC, em.mes DESC`,
    [cliente_id]
  );

  for (const r of rows) {
    if (esMesNoCobrable(r.estado)) continue;
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

// Resuelve mes/año final aplicando política de suspensión y futuros
const resolverMesAplicadoConPolitica = async (conn, cliente_id, fecha_pago, mes_expl, anio_expl) => {
  // Normaliza fecha antes de todo (blindaje)
  const fechaNorm = normalizarFechaPagoYYYYMMDD(fecha_pago);

  // 1) Punto de partida (explícito o derivado de fecha_pago)
  let { mes, anio } = determinarMesAplicado(fechaNorm, mes_expl, anio_expl);

  const esExplicito = Number.isInteger(mes_expl) && Number.isInteger(anio_expl);
  const okRango = validarMesAplicado(mes, anio, { permitirFuturos: esExplicito, maxMesesFuturo: 60 });
  if (!okRango) throw new Error('Mes/año aplicado inválido o fuera de rango permitido');

  // 2) Política:
  // - Si viene explícito: se respeta (aunque esté suspendido) -> permite pago para normalizar estado.
  // - Si NO es explícito y el periodo está suspendido: reasigna al último mes pendiente no suspendido (≤ hoy).
  if (!esExplicito) {
    const suspendido = await estaClienteSuspendidoEnPeriodo(conn, cliente_id, mes, anio, { usarFallback: true });
    if (suspendido) {
      const ultimo = await buscarUltimoMesPendienteNoSuspendido(conn, cliente_id);
      if (!ultimo) {
        throw new Error('El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago');
      }
      mes = ultimo.mes;
      anio = ultimo.anio;
    }
  }

  return { mes, anio, fechaNorm };
};

/* ============================
   Distribución del pago entre meses
   ============================ */

// Hasta cuántos meses hacia adelante puede correrse un pago. Evita que un
// monto mal tecleado se reparta en años de mensualidades por adelantado.
const MAX_MESES_ADELANTE = 24;

const siguienteMes = (mes, anio) =>
  mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };

// Cuánto falta para dar por cubierto un mes.
//
// Devuelve 0 si el mes no se cobra ('Suspendido', 'Sin servicio') o si ya está
// dado por pagado. Ese último caso importa por el mes de instalación: va
// 'Pagado' por regla de negocio y no tiene pagos detrás, así que sin este
// chequeo un pago se le "metería" ahí en lugar de correr al siguiente.
const saldoDelMes = async (conn, cliente_id, mes, anio, precioMensual) => {
  const [[fila]] = await conn.execute(
    `SELECT estado FROM estado_mensual
      WHERE cliente_id = ? AND mes = ? AND anio = ?`,
    [cliente_id, mes, anio]
  );

  if (fila && (esMesNoCobrable(fila.estado) || fila.estado === 'Pagado')) return 0;
  if (precioMensual <= 0) return 0;

  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) AS total
       FROM pagos
      WHERE cliente_id = ? AND mes_aplicado = ? AND anio_aplicado = ?`,
    [cliente_id, mes, anio]
  );

  return Math.max(0, precioMensual - Number(sumRow.total));
};

// Reparte un pago desde un mes hacia adelante, cubriendo el saldo de cada uno.
//
// El caso que resuelve: un cliente debe una parte de abril y paga completo.
// Abril se cierra con lo que le faltaba y el sobrante corre a mayo, que queda
// parcial. Antes todo el monto se quedaba en abril y el excedente no se veía
// por ningún lado.
//
// Devuelve [{ mes, anio, monto }]. Con un pago normal (el monto justo de un
// mes) devuelve un solo elemento, igual que antes.
const distribuirPago = async (conn, cliente_id, mesInicio, anioInicio, montoTotal) => {
  const [[cli]] = await conn.execute(
    `SELECT p.precio_mensual
       FROM clientes c JOIN planes p ON p.id = c.plan_id
      WHERE c.id = ?`,
    [cliente_id]
  );
  if (!cli) throw new Error(`Cliente ${cliente_id} sin plan asociado`);
  const precioMensual = Number(cli.precio_mensual ?? 0);

  // Se trabaja en centavos para no arrastrar errores de redondeo.
  let restante = Math.round(Number(montoTotal) * 100);
  if (restante <= 0) throw new Error('El monto debe ser mayor a 0.');

  const reparto = [];
  let { mes, anio } = { mes: mesInicio, anio: anioInicio };
  let ultimoCobrable = null;

  for (let i = 0; i < MAX_MESES_ADELANTE && restante > 0; i++) {
    const saldo = Math.round(
      (await saldoDelMes(conn, cliente_id, mes, anio, precioMensual)) * 100
    );

    if (saldo > 0) {
      const aplica = Math.min(restante, saldo);
      reparto.push({ mes, anio, monto: aplica / 100 });
      restante -= aplica;
      ultimoCobrable = { mes, anio };
    }

    ({ mes, anio } = siguienteMes(mes, anio));
  }

  // Sobrante tras cubrir todo lo alcanzable: se deja en el último mes al que
  // se pudo aplicar, o en el mes de origen si no hubo ninguno. Así el dinero
  // siempre queda registrado y cuadra con el arqueo.
  if (restante > 0) {
    const destino = ultimoCobrable ?? { mes: mesInicio, anio: anioInicio };
    const previo = reparto.find((r) => r.mes === destino.mes && r.anio === destino.anio);
    if (previo) previo.monto = Math.round((previo.monto * 100 + restante)) / 100;
    else reparto.push({ ...destino, monto: restante / 100 });
  }

  return reparto;
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
  if (!cli) throw new Error(`Cliente ${cliente_id} sin plan asociado`);

  const precioMensual = Number(cli.precio_mensual ?? 0);

  const [[sumRow]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) as total
       FROM pagos
      WHERE cliente_id = ?
        AND mes_aplicado = ?
        AND anio_aplicado = ?`,
    [cliente_id, mes, anio]
  );
  const acumulado = Number(sumRow.total);

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

export const obtenerMetodosPago = async () => {
  const db = await connectDB();
  const [rows] = await db.execute('SELECT * FROM metodos_pago ORDER BY descripcion');
  return rows;
};

export const obtenerPagoPorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute(
    `
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre,
           c.plan_id, pl.nombre as plan_nombre
      FROM pagos p 
 LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
 LEFT JOIN clientes c      ON p.cliente_id = c.id
 LEFT JOIN planes pl       ON c.plan_id = pl.id
     WHERE p.id = ?
  `,
    [id]
  );
  return rows[0];
};

export const obtenerPagosPorCliente = async (cliente_id) => {
  const db = await connectDB();
  const [rows] = await db.execute(
    `
    SELECT p.*, mp.descripcion as metodo_pago_desc
      FROM pagos p 
 LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
     WHERE p.cliente_id = ?
  ORDER BY p.fecha_pago DESC, p.id DESC
  `,
    [cliente_id]
  );
  return rows;
};

// Pagos registrados durante el mes. Es la base del arqueo y del historial.
//
// Filtra por `fecha_emision`, no por `fecha_pago`: la segunda la escribe el
// cajero y poniéndola en un mes lejano el cobro desaparecía del conteo.
// `fecha_emision` la pone la base de datos al insertar y no se puede editar,
// así que el dinero siempre cae en el mes en que realmente entró.
export const obtenerPagosPorMes = async (mes, anio) => {
  const db = await connectDB();
  const [rows] = await db.execute(
    `
    SELECT p.*, mp.descripcion as metodo_pago_desc,
           c.nombre as cliente_nombre,
           u.nombre as usuario_nombre, u.apellido as usuario_apellido
      FROM pagos p
 LEFT JOIN metodos_pago mp ON p.metodo_id = mp.id
 LEFT JOIN clientes c      ON p.cliente_id = c.id
 LEFT JOIN usuarios u      ON p.usuario_id = u.id
     WHERE MONTH(p.fecha_emision) = ? AND YEAR(p.fecha_emision) = ?
  ORDER BY p.fecha_emision DESC, p.id DESC
  `,
    [mes, anio]
  );
  return rows;
};

/* ============================
   Crear / Actualizar / Eliminar pagos
   ============================ */

export const crearPago = async (pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const { mes, anio, fechaNorm } = await resolverMesAplicadoConPolitica(
      conn,
      cliente_id,
      fecha_pago,
      mes_aplicado,
      anio_aplicado
    );

    // El pago cubre el saldo del mes y lo que sobra corre a los siguientes.
    // Con un monto normal esto devuelve un solo tramo y se comporta igual que
    // antes; sólo cambia cuando hay excedente sobre lo que faltaba.
    const reparto = await distribuirPago(conn, cliente_id, mes, anio, monto);

    const tramos = [];
    for (const tramo of reparto) {
      const [result] = await conn.execute(
        `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cliente_id, tramo.monto, fechaNorm, metodo_id, referencia ?? null,
         observacion ?? null, tramo.mes, tramo.anio]
      );

      const estado = await calcularEstadoMensual(conn, cliente_id, tramo.mes, tramo.anio);
      await upsertEstadoMensual(conn, cliente_id, tramo.mes, tramo.anio, estado);

      tramos.push({ id: result.insertId, mes: tramo.mes, anio: tramo.anio, monto: tramo.monto });
    }

    await conn.commit();

    // Se conserva la forma de respuesta anterior (id/mes/anio del primer
    // tramo) para no romper al frontend, y se agrega el detalle completo.
    return {
      id: tramos[0].id,
      mes_aplicado: tramos[0].mes,
      anio_aplicado: tramos[0].anio,
      distribucion: tramos
    };
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
  return parts.map((c) => c / 100);
};

export const crearPagosMultiplesMeses = async (pagosData) => {
  const { cliente_id, monto_total, fecha_pago, metodo_id, referencia, observacion, meses } = pagosData;
  const db = await connectDB();
  const conn = await db.getConnection();

  const esMesAnioValido = (mes, anio) =>
    Number.isInteger(mes) && mes >= 1 && mes <= 12 && Number.isInteger(anio) && anio >= 2000 && anio <= 9999;

  try {
    await conn.beginTransaction();

    if (!Array.isArray(meses) || meses.length === 0) {
      throw new Error('Debe especificar al menos un mes para el pago.');
    }

    // ✅ Blindaje fecha
    const fechaNorm = normalizarFechaPagoYYYYMMDD(fecha_pago);

    const mesesNormalizados = [];
    for (const item of meses) {
      const m = parseInt(item.mes, 10);
      const a = parseInt(item.anio, 10);
      if (!esMesAnioValido(m, a)) throw new Error(`Mes/Año inválidos: ${item.mes}/${item.anio}`);
      mesesNormalizados.push({ mes: m, anio: a });
    }

    const mesesNoSuspendidos = [];
    for (const { mes, anio } of mesesNormalizados) {
      const fila = await obtenerEstadoMensualFila(conn, cliente_id, mes, anio);
      if (esMesNoCobrable(fila?.estado)) continue;
      mesesNoSuspendidos.push({ mes, anio });
    }

    if (mesesNoSuspendidos.length === 0) {
      throw new Error('Los meses seleccionados están suspendidos o sin servicio. No hay meses disponibles para aplicar el pago.');
    }

    const montos = repartirMonto(monto_total, mesesNoSuspendidos.length);

    const resultados = [];
    for (let i = 0; i < mesesNoSuspendidos.length; i++) {
      const { mes, anio } = mesesNoSuspendidos[i];
      const montoPorMes = montos[i];

      const [result] = await conn.execute(
        `INSERT INTO pagos (cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cliente_id, montoPorMes, fechaNorm, metodo_id, referencia ?? null, observacion ?? null, mes, anio]
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

// Edita un pago. `fecha_emision` y `usuario_id` NO se tocan a propósito: son
// el registro de cuándo y quién capturó el cobro, y perderían todo sentido si
// se pudieran editar después. Tampoco se aceptan desde el body.
export const actualizarPago = async (id, pago) => {
  const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = pago;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [oldRows] = await conn.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new Error('Pago no encontrado');
    const old = oldRows[0];

    const { mes: newMesAplicado, anio: newAnioAplicado, fechaNorm } = await resolverMesAplicadoConPolitica(
      conn,
      cliente_id,
      fecha_pago,
      mes_aplicado,
      anio_aplicado
    );

    await conn.execute(
      `UPDATE pagos
          SET cliente_id = ?, monto = ?, fecha_pago = ?, metodo_id = ?, referencia = ?, 
              observacion = ?, mes_aplicado = ?, anio_aplicado = ?
        WHERE id = ?`,
      [
        cliente_id,
        monto,
        fechaNorm,
        metodo_id,
        referencia ?? null,
        observacion ?? null,
        newMesAplicado,
        newAnioAplicado,
        id,
      ]
    );

    const claves = new Set([
      `${old.mes_aplicado}-${old.anio_aplicado}-${old.cliente_id}`,
      `${newMesAplicado}-${newAnioAplicado}-${cliente_id}`,
    ]);

    for (const key of claves) {
      const [mesStr, anioStr, clienteIdStr] = key.split('-');
      const mesRecalc = parseInt(mesStr, 10);
      const anioRecalc = parseInt(anioStr, 10);
      const clienteRecalc = parseInt(clienteIdStr, 10);

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
  const [rows] = await db.execute(
    `
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
  `,
    [mes, anio, cliente_id]
  );

  return rows[0] || null;
};

export const obtenerMesesPendientes = async (cliente_id) => {
  const db = await connectDB();
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth() + 1;

  const [rows] = await db.execute(
    `
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
       AND em.estado NOT IN ('Pagado','Suspendido','Sin servicio')
  ORDER BY em.anio DESC, em.mes DESC
  `,
    [cliente_id, cliente_id, y, y, m]
  );

  return rows;
};
