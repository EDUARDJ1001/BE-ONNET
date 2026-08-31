import connectDB from '../config/db.js';

/**
 * Planillas de cuadrilla: el periodo (una quincena o un mes) sobre el que se
 * cuelgan los días trabajados, los gastos y la liquidación.
 *
 * Los totales NO se calculan aquí: salen de las vistas v_planilla_resumen y
 * v_planilla_liquidacion. Si se rearman en JavaScript, tarde o temprano dejan
 * de coincidir con la base — que es exactamente lo que pasaba en el Excel.
 */

export const obtenerPlanillas = async ({ cuadrillaId = null, estado = null, desde = null, hasta = null } = {}) => {
  try {
    const connection = await connectDB();
    const condiciones = [];
    const params = [];

    if (cuadrillaId) {
      condiciones.push('p.cuadrilla_id = ?');
      params.push(cuadrillaId);
    }
    if (estado) {
      condiciones.push('r.estado = ?');
      params.push(estado);
    }
    if (desde) {
      condiciones.push('r.fecha_fin >= ?');
      params.push(desde);
    }
    if (hasta) {
      condiciones.push('r.fecha_inicio <= ?');
      params.push(hasta);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `SELECT r.*, p.cuadrilla_id
         FROM v_planilla_resumen r
         JOIN planillas p ON p.id = r.planilla_id
         ${where}
        ORDER BY r.fecha_inicio DESC`,
      params
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener planillas:', err);
    throw err;
  }
};

/** Planilla completa: resumen, integrantes, días y gastos sueltos. */
export const obtenerPlanillaPorId = async (id) => {
  try {
    const connection = await connectDB();

    const [[resumen]] = await connection.query(
      'SELECT * FROM v_planilla_resumen WHERE planilla_id = ?',
      [id]
    );
    if (!resumen) return null;

    const [[planilla]] = await connection.query('SELECT * FROM planillas WHERE id = ?', [id]);

    const [colaboradores] = await connection.query(
      `SELECT pc.id, pc.colaborador_id, pc.tarifa_diaria, pc.observaciones,
              c.nombre, c.apellido, c.alias
         FROM planilla_colaborador pc
         JOIN colaboradores c ON c.id = pc.colaborador_id
        WHERE pc.planilla_id = ?
        ORDER BY c.nombre`,
      [id]
    );

    const [dias] = await connection.query(
      `SELECT d.*, r.ingreso_total, r.mano_obra, r.gastos, r.gasto_total, r.utilidad,
              tf.codigo AS tipo_fibra, pr.nombre AS proyecto
         FROM planilla_dias d
         JOIN v_planilla_dia_resumen r ON r.planilla_dia_id = d.id
         LEFT JOIN tipos_fibra tf ON tf.id = d.tipo_fibra_id
         LEFT JOIN proyectos pr ON pr.id = d.proyecto_id
        WHERE d.planilla_id = ?
        ORDER BY d.fecha`,
      [id]
    );

    // Gastos del periodo que no cuelgan de un día concreto (ej: taller del camión).
    const [gastosGenerales] = await connection.query(
      `SELECT g.*, cg.nombre AS categoria
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
        WHERE g.planilla_id = ? AND g.planilla_dia_id IS NULL
        ORDER BY g.fecha`,
      [id]
    );

    return { ...planilla, resumen, colaboradores, dias, gastosGenerales };
  } catch (err) {
    console.error('Error al obtener planilla por id:', err);
    throw err;
  }
};

/**
 * Crea la planilla y, si vienen, su lista de integrantes.
 * Va en transacción: una planilla a medio armar (sin cuadrilla) obliga a
 * capturar los días a mano y es peor que no tenerla.
 */
export const crearPlanilla = async (data, usuarioId = null) => {
  const {
    cuadrilla_id,
    nombre,
    fecha_inicio,
    fecha_fin,
    estado = 'abierta',
    observaciones = null,
    colaboradores = []
  } = data;

  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO planillas
         (cuadrilla_id, nombre, fecha_inicio, fecha_fin, estado, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cuadrilla_id, nombre, fecha_inicio, fecha_fin, estado, observaciones, usuarioId]
    );

    const planillaId = result.insertId;

    if (colaboradores.length > 0) {
      await connection.query(
        'INSERT INTO planilla_colaborador (planilla_id, colaborador_id, tarifa_diaria, observaciones) VALUES ?',
        [colaboradores.map((c) => [
          planillaId,
          c.colaborador_id,
          c.tarifa_diaria,
          c.observaciones ?? null
        ])]
      );
    }

    await connection.commit();
    return await obtenerPlanillaPorId(planillaId);
  } catch (err) {
    await connection.rollback();
    console.error('Error al crear planilla:', err);
    throw err;
  } finally {
    connection.release();
  }
};

export const actualizarPlanilla = async (id, data) => {
  const {
    cuadrilla_id,
    nombre,
    fecha_inicio,
    fecha_fin,
    estado = 'abierta',
    observaciones = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE planillas
          SET cuadrilla_id = ?, nombre = ?, fecha_inicio = ?, fecha_fin = ?,
              estado = ?, observaciones = ?
        WHERE id = ?`,
      [cuadrilla_id, nombre, fecha_inicio, fecha_fin, estado, observaciones, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerPlanillaPorId(id);
  } catch (err) {
    console.error('Error al actualizar planilla:', err);
    throw err;
  }
};

/** Cambia sólo el estado: abierta -> cerrada -> pagada. */
export const cambiarEstadoPlanilla = async (id, estado) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      'UPDATE planillas SET estado = ? WHERE id = ?',
      [estado, id]
    );
    if (result.affectedRows === 0) return null;
    return { id, estado };
  } catch (err) {
    console.error('Error al cambiar estado de planilla:', err);
    throw err;
  }
};

/**
 * Borra la planilla con sus días, detalle y gastos (ON DELETE CASCADE).
 * Los pagos y vales ya entregados NO se borran: el FK los deja huérfanos con
 * planilla_id NULL a propósito, porque ese dinero sí salió de caja.
 */
export const eliminarPlanilla = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM planillas WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar planilla:', err);
    throw err;
  }
};

/* ============================
   Integrantes de la planilla
   ============================ */

export const obtenerColaboradoresDePlanilla = async (planillaId) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT pc.id, pc.colaborador_id, pc.tarifa_diaria, pc.observaciones,
              c.nombre, c.apellido, c.alias
         FROM planilla_colaborador pc
         JOIN colaboradores c ON c.id = pc.colaborador_id
        WHERE pc.planilla_id = ?
        ORDER BY c.nombre`,
      [planillaId]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener colaboradores de la planilla:', err);
    throw err;
  }
};

/**
 * Reemplaza la lista de integrantes.
 *
 * No se puede sacar a alguien que ya tiene días capturados: sus jornales
 * quedarían fuera de la liquidación y el total de mano de obra dejaría de
 * cuadrar con lo que se pagó. Hay que borrar primero esos días.
 */
export const guardarColaboradoresDePlanilla = async (planillaId, colaboradores) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [planilla] = await connection.query('SELECT id FROM planillas WHERE id = ?', [planillaId]);
    if (planilla.length === 0) {
      await connection.rollback();
      return null;
    }

    const idsNuevos = colaboradores.map((c) => c.colaborador_id);

    const [conDias] = await connection.query(
      `SELECT DISTINCT dc.colaborador_id, c.nombre
         FROM planilla_dia_colaborador dc
         JOIN planilla_dias d ON d.id = dc.planilla_dia_id
         JOIN colaboradores c ON c.id = dc.colaborador_id
        WHERE d.planilla_id = ?`,
      [planillaId]
    );

    const removidosConDias = conDias.filter((c) => !idsNuevos.includes(c.colaborador_id));
    if (removidosConDias.length > 0) {
      await connection.rollback();
      const error = new Error(
        `No se puede quitar de la planilla a ${removidosConDias.map((c) => c.nombre).join(', ')}: ya tiene días registrados`
      );
      error.codigo = 'COLABORADOR_CON_DIAS';
      throw error;
    }

    await connection.query('DELETE FROM planilla_colaborador WHERE planilla_id = ?', [planillaId]);

    if (colaboradores.length > 0) {
      await connection.query(
        'INSERT INTO planilla_colaborador (planilla_id, colaborador_id, tarifa_diaria, observaciones) VALUES ?',
        [colaboradores.map((c) => [
          planillaId,
          c.colaborador_id,
          c.tarifa_diaria,
          c.observaciones ?? null
        ])]
      );
    }

    await connection.commit();
    return await obtenerColaboradoresDePlanilla(planillaId);
  } catch (err) {
    if (err.codigo !== 'COLABORADOR_CON_DIAS') {
      await connection.rollback();
      console.error('Error al guardar colaboradores de la planilla:', err);
    }
    throw err;
  } finally {
    connection.release();
  }
};

/* ============================
   Liquidación
   ============================ */

/** El bloque de abajo del Excel: días, devengado, vales, pagado y saldo. */
export const obtenerLiquidacion = async (planillaId) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      'SELECT * FROM v_planilla_liquidacion WHERE planilla_id = ? ORDER BY colaborador',
      [planillaId]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener liquidación:', err);
    throw err;
  }
};
