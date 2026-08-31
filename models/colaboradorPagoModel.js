import connectDB from '../config/db.js';

/**
 * Pagos entregados al colaborador ("pagado" + "fecha de pago" del Excel).
 *
 * Dos fechas a propósito, igual que en `pagos`:
 *   fecha_pago     -> la del comprobante, la escribe el administrador.
 *   fecha_registro -> cuándo se capturó de verdad. La pone la BD.
 *
 * Por eso fecha_registro NUNCA se envía en el INSERT: si el backend la
 * mandara, se perdería el único dato que delata una fecha corrida de mes.
 */

export const obtenerPagos = async ({ colaboradorId = null, planillaId = null, desde = null, hasta = null } = {}) => {
  try {
    const connection = await connectDB();
    const condiciones = [];
    const params = [];

    if (colaboradorId) {
      condiciones.push('cp.colaborador_id = ?');
      params.push(colaboradorId);
    }
    if (planillaId) {
      condiciones.push('cp.planilla_id = ?');
      params.push(planillaId);
    }
    if (desde) {
      condiciones.push('cp.fecha_pago >= ?');
      params.push(desde);
    }
    if (hasta) {
      condiciones.push('cp.fecha_pago <= ?');
      params.push(hasta);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `SELECT cp.*, c.nombre AS colaborador, c.alias,
              p.nombre AS planilla, mp.descripcion AS metodo,
              u.username AS registrado_por
         FROM colaborador_pagos cp
         JOIN colaboradores c ON c.id = cp.colaborador_id
         LEFT JOIN planillas p ON p.id = cp.planilla_id
         LEFT JOIN metodos_pago mp ON mp.id = cp.metodo_id
         LEFT JOIN usuarios u ON u.id = cp.creado_por
         ${where}
        ORDER BY cp.fecha_pago DESC, cp.id DESC`,
      params
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener pagos a colaboradores:', err);
    throw err;
  }
};

export const obtenerPagoPorId = async (id) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query('SELECT * FROM colaborador_pagos WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (err) {
    console.error('Error al obtener pago por id:', err);
    throw err;
  }
};

export const crearPago = async (data, usuarioId = null) => {
  const {
    colaborador_id,
    planilla_id = null,
    monto,
    fecha_pago,
    metodo_id = null,
    referencia = null,
    observacion = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO colaborador_pagos
         (colaborador_id, planilla_id, monto, fecha_pago, metodo_id, referencia, observacion, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [colaborador_id, planilla_id, monto, fecha_pago, metodo_id, referencia, observacion, usuarioId]
    );
    return await obtenerPagoPorId(result.insertId);
  } catch (err) {
    console.error('Error al crear pago a colaborador:', err);
    throw err;
  }
};

export const actualizarPago = async (id, data) => {
  const {
    planilla_id = null,
    monto,
    fecha_pago,
    metodo_id = null,
    referencia = null,
    observacion = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE colaborador_pagos
          SET planilla_id = ?, monto = ?, fecha_pago = ?, metodo_id = ?,
              referencia = ?, observacion = ?
        WHERE id = ?`,
      [planilla_id, monto, fecha_pago, metodo_id, referencia, observacion, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerPagoPorId(id);
  } catch (err) {
    console.error('Error al actualizar pago a colaborador:', err);
    throw err;
  }
};

export const eliminarPago = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM colaborador_pagos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar pago a colaborador:', err);
    throw err;
  }
};

/**
 * Pagos cuya fecha de comprobante se aleja mucho de cuándo se registraron.
 * Es la consulta de control del cierre de planilla. Debe salir vacía.
 */
export const obtenerPagosDesfasados = async (diasTolerancia = 7) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT cp.id, c.nombre AS colaborador, cp.monto,
              cp.fecha_registro AS registrado,
              cp.fecha_pago     AS dice_el_comprobante,
              DATEDIFF(cp.fecha_registro, cp.fecha_pago) AS dias_de_diferencia,
              u.username AS registrado_por
         FROM colaborador_pagos cp
         JOIN colaboradores c ON c.id = cp.colaborador_id
         LEFT JOIN usuarios u ON u.id = cp.creado_por
        WHERE ABS(DATEDIFF(cp.fecha_registro, cp.fecha_pago)) > ?
        ORDER BY ABS(DATEDIFF(cp.fecha_registro, cp.fecha_pago)) DESC`,
      [diasTolerancia]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener pagos desfasados:', err);
    throw err;
  }
};
