import connectDB from '../config/db.js';

/**
 * El día de trabajo: una fila de la planilla del Excel.
 *
 * El día y el pago a cada colaborador se guardan juntos, en una transacción.
 * Si se guardaran por separado y fallara el segundo paso, quedaría un día con
 * ingreso pero sin mano de obra: el margen saldría inflado y nadie lo notaría.
 *
 * Sobre `ingreso`: se guarda tal cual llega, no se calcula. La fórmula cambia
 * según el trabajo (en enero era instalaciones × 300, en agosto metros × 4),
 * así que `sugerirIngreso` la propone y el administrador decide.
 */

/** Cálculo sugerido para la columna "entrada". Es una propuesta, no una regla. */
export const sugerirIngreso = ({
  instalaciones = 0,
  tarifa_instalacion = 0,
  metros_fibra = 0,
  punta_inicial = 0,
  punta_final = 0,
  tarifa_metro = 0
}) => {
  const porInstalaciones = Number(instalaciones) * Number(tarifa_instalacion);
  const metros = Number(metros_fibra) + Number(punta_inicial) + Number(punta_final);
  const porMetros = metros * Number(tarifa_metro);
  return Number((porInstalaciones + porMetros).toFixed(2));
};

const CAMPOS_DIA = `
  planilla_id, fecha, proyecto_id, sector, trabajo_realizado, estado,
  instalaciones, tarifa_instalacion, metros_fibra, punta_inicial, punta_final,
  tarifa_metro, tipo_fibra_id, bono_onnet, ingreso, observaciones`;

const valoresDia = (data) => [
  data.proyecto_id ?? null,
  data.sector ?? null,
  data.trabajo_realizado ?? null,
  data.estado ?? 'trabajado',
  data.instalaciones ?? 0,
  data.tarifa_instalacion ?? 0,
  data.metros_fibra ?? 0,
  data.punta_inicial ?? 0,
  data.punta_final ?? 0,
  data.tarifa_metro ?? 0,
  data.tipo_fibra_id ?? null,
  data.bono_onnet ?? 0,
  data.ingreso ?? 0,
  data.observaciones ?? null
];

export const obtenerDiasDePlanilla = async (planillaId) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT d.*, r.ingreso_total, r.mano_obra, r.gastos, r.gasto_total, r.utilidad,
              tf.codigo AS tipo_fibra, pr.nombre AS proyecto
         FROM planilla_dias d
         JOIN v_planilla_dia_resumen r ON r.planilla_dia_id = d.id
         LEFT JOIN tipos_fibra tf ON tf.id = d.tipo_fibra_id
         LEFT JOIN proyectos pr ON pr.id = d.proyecto_id
        WHERE d.planilla_id = ?
        ORDER BY d.fecha`,
      [planillaId]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener días de la planilla:', err);
    throw err;
  }
};

/** Un día con su detalle de pagos y sus gastos. */
export const obtenerDiaPorId = async (id) => {
  try {
    const connection = await connectDB();

    const [[dia]] = await connection.query(
      `SELECT d.*, r.ingreso_total, r.mano_obra, r.gastos, r.gasto_total, r.utilidad,
              tf.codigo AS tipo_fibra, pr.nombre AS proyecto
         FROM planilla_dias d
         JOIN v_planilla_dia_resumen r ON r.planilla_dia_id = d.id
         LEFT JOIN tipos_fibra tf ON tf.id = d.tipo_fibra_id
         LEFT JOIN proyectos pr ON pr.id = d.proyecto_id
        WHERE d.id = ?`,
      [id]
    );
    if (!dia) return null;

    const [colaboradores] = await connection.query(
      `SELECT dc.*, c.nombre, c.apellido, c.alias
         FROM planilla_dia_colaborador dc
         JOIN colaboradores c ON c.id = dc.colaborador_id
        WHERE dc.planilla_dia_id = ?
        ORDER BY c.nombre`,
      [id]
    );

    const [gastos] = await connection.query(
      `SELECT g.*, cg.nombre AS categoria
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
        WHERE g.planilla_dia_id = ?
        ORDER BY g.id`,
      [id]
    );

    return { ...dia, colaboradores, gastos };
  } catch (err) {
    console.error('Error al obtener día por id:', err);
    throw err;
  }
};

/**
 * Inserta el detalle de pagos del día.
 * Se usa desde crear y actualizar, siempre dentro de una transacción abierta.
 *
 * Antes de insertar se asegura de que todos estén en el roster de la planilla.
 * No es un capricho: v_planilla_liquidacion arranca de planilla_colaborador,
 * así que pagarle a alguien que no está en el roster haría que sus jornales
 * no aparecieran en la liquidación — se le pagó y el total no lo refleja.
 * Pasa de verdad: en el Excel la gente se sumaba a mitad de quincena.
 */
const insertarDetalle = async (connection, planillaId, diaId, colaboradores) => {
  if (!colaboradores || colaboradores.length === 0) return;

  await connection.query(
    `INSERT IGNORE INTO planilla_colaborador (planilla_id, colaborador_id, tarifa_diaria)
     SELECT ?, c.id, c.tarifa_diaria
       FROM colaboradores c
      WHERE c.id IN (?)`,
    [planillaId, colaboradores.map((c) => c.colaborador_id)]
  );

  await connection.query(
    `INSERT INTO planilla_dia_colaborador
       (planilla_dia_id, colaborador_id, asistio, monto, bono, observacion)
     VALUES ?`,
    [colaboradores.map((c) => [
      diaId,
      c.colaborador_id,
      c.asistio === false || c.asistio === 0 ? 0 : 1,
      c.monto ?? 0,
      c.bono ?? 0,
      c.observacion ?? null
    ])]
  );
};

export const crearDia = async (planillaId, data, usuarioId = null) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO planilla_dias (${CAMPOS_DIA}, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [planillaId, data.fecha, ...valoresDia(data), usuarioId]
    );

    const diaId = result.insertId;
    await insertarDetalle(connection, planillaId, diaId, data.colaboradores);

    // Gastos capturados junto con el día (combustible, agua, permisos...).
    if (data.gastos && data.gastos.length > 0) {
      await connection.query(
        `INSERT INTO planilla_gastos
           (planilla_id, planilla_dia_id, categoria_id, descripcion, monto, fecha, creado_por)
         VALUES ?`,
        [data.gastos.map((g) => [
          planillaId,
          diaId,
          g.categoria_id,
          g.descripcion ?? null,
          g.monto,
          g.fecha ?? data.fecha,
          usuarioId
        ])]
      );
    }

    await connection.commit();
    return await obtenerDiaPorId(diaId);
  } catch (err) {
    await connection.rollback();
    console.error('Error al crear día de planilla:', err);
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Actualiza el día y reemplaza el detalle de pagos.
 *
 * Los gastos NO se tocan aquí: se administran por su propio endpoint. Borrarlos
 * en cada edición del día haría desaparecer sin aviso un gasto que ya se pagó.
 */
export const actualizarDia = async (id, data) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existente] = await connection.query(
      'SELECT planilla_id FROM planilla_dias WHERE id = ?',
      [id]
    );
    if (existente.length === 0) {
      await connection.rollback();
      return null;
    }
    const planillaId = existente[0].planilla_id;

    await connection.query(
      `UPDATE planilla_dias
          SET fecha = ?, proyecto_id = ?, sector = ?, trabajo_realizado = ?, estado = ?,
              instalaciones = ?, tarifa_instalacion = ?, metros_fibra = ?, punta_inicial = ?,
              punta_final = ?, tarifa_metro = ?, tipo_fibra_id = ?, bono_onnet = ?,
              ingreso = ?, observaciones = ?
        WHERE id = ?`,
      [data.fecha, ...valoresDia(data), id]
    );

    if (data.colaboradores !== undefined) {
      await connection.query('DELETE FROM planilla_dia_colaborador WHERE planilla_dia_id = ?', [id]);
      await insertarDetalle(connection, planillaId, id, data.colaboradores);
    }

    await connection.commit();
    return await obtenerDiaPorId(id);
  } catch (err) {
    await connection.rollback();
    console.error('Error al actualizar día de planilla:', err);
    throw err;
  } finally {
    connection.release();
  }
};

export const eliminarDia = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM planilla_dias WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar día de planilla:', err);
    throw err;
  }
};

/** A qué planilla pertenece un día. Lo usa el controlador para validar. */
export const obtenerPlanillaIdDeDia = async (id) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query('SELECT planilla_id FROM planilla_dias WHERE id = ?', [id]);
    return rows[0]?.planilla_id ?? null;
  } catch (err) {
    console.error('Error al obtener la planilla del día:', err);
    throw err;
  }
};
