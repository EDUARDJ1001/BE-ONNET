import connectDB from '../config/db.js';

/**
 * Gastos de cuadrilla: combustible, agua, permisos, taller del camión.
 *
 * OJO: no es la tabla `gastos`. Esa es la caja general de la empresa. Sumar
 * las dos en un mismo reporte duplica montos.
 *
 * `planilla_dia_id` en NULL es el gasto del periodo que no pertenece a un día
 * concreto — el caso de la hoja GASTO CARRO.
 */

export const obtenerGastosDePlanilla = async (planillaId, { soloGenerales = false } = {}) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT g.*, cg.nombre AS categoria, d.fecha AS fecha_dia
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
         LEFT JOIN planilla_dias d ON d.id = g.planilla_dia_id
        WHERE g.planilla_id = ?
          ${soloGenerales ? 'AND g.planilla_dia_id IS NULL' : ''}
        ORDER BY g.fecha, g.id`,
      [planillaId]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener gastos de la planilla:', err);
    throw err;
  }
};

export const obtenerGastoPorId = async (id) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT g.*, cg.nombre AS categoria
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
        WHERE g.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('Error al obtener gasto de planilla por id:', err);
    throw err;
  }
};

export const crearGasto = async (data, usuarioId = null) => {
  const {
    planilla_id,
    planilla_dia_id = null,
    categoria_id,
    descripcion = null,
    monto,
    fecha
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO planilla_gastos
         (planilla_id, planilla_dia_id, categoria_id, descripcion, monto, fecha, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [planilla_id, planilla_dia_id, categoria_id, descripcion, monto, fecha, usuarioId]
    );
    return await obtenerGastoPorId(result.insertId);
  } catch (err) {
    console.error('Error al crear gasto de planilla:', err);
    throw err;
  }
};

export const actualizarGasto = async (id, data) => {
  const {
    planilla_dia_id = null,
    categoria_id,
    descripcion = null,
    monto,
    fecha
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE planilla_gastos
          SET planilla_dia_id = ?, categoria_id = ?, descripcion = ?, monto = ?, fecha = ?
        WHERE id = ?`,
      [planilla_dia_id, categoria_id, descripcion, monto, fecha, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerGastoPorId(id);
  } catch (err) {
    console.error('Error al actualizar gasto de planilla:', err);
    throw err;
  }
};

export const eliminarGasto = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM planilla_gastos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar gasto de planilla:', err);
    throw err;
  }
};

/** Gasto agrupado por categoría en un rango de fechas. Para los gráficos. */
export const obtenerGastoPorCategoria = async ({ desde = null, hasta = null } = {}) => {
  try {
    const connection = await connectDB();
    const condiciones = [];
    const params = [];

    if (desde) {
      condiciones.push('g.fecha >= ?');
      params.push(desde);
    }
    if (hasta) {
      condiciones.push('g.fecha <= ?');
      params.push(hasta);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `SELECT cg.id AS categoria_id, cg.nombre AS categoria,
              COUNT(*) AS movimientos, SUM(g.monto) AS total
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
         ${where}
        GROUP BY cg.id, cg.nombre
        ORDER BY total DESC`,
      params
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener gasto por categoría:', err);
    throw err;
  }
};
