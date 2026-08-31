import connectDB from '../config/db.js';

/**
 * Utilidad del módulo de planillas: ingreso, mano de obra, gasto y margen.
 *
 * Todo sale de las vistas. En el Excel estos totales estaban escritos como
 * número y ya se habían desalineado al menos una vez (la hoja CONTROL sumaba
 * una fila de menos), así que aquí no se recalcula nada en JavaScript.
 */

/** Ingreso, mano de obra, gasto y utilidad mes a mes. */
export const obtenerUtilidadMensual = async ({ anio = null } = {}) => {
  try {
    const connection = await connectDB();
    const params = [];
    let query = 'SELECT * FROM v_utilidad_mensual';
    if (anio) {
      query += ' WHERE anio = ?';
      params.push(anio);
    }
    query += ' ORDER BY anio, mes';
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (err) {
    console.error('Error al obtener utilidad mensual:', err);
    throw err;
  }
};

/** Utilidad por día en un rango. Para la gráfica de la pantalla de márgenes. */
export const obtenerUtilidadDiaria = async ({ desde = null, hasta = null } = {}) => {
  try {
    const connection = await connectDB();
    const condiciones = [];
    const params = [];

    if (desde) {
      condiciones.push('d.fecha >= ?');
      params.push(desde);
    }
    if (hasta) {
      condiciones.push('d.fecha <= ?');
      params.push(hasta);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `SELECT d.*, p.nombre AS planilla, pr.nombre AS proyecto
         FROM v_planilla_dia_resumen d
         JOIN planillas p ON p.id = d.planilla_id
         LEFT JOIN proyectos pr ON pr.id = d.proyecto_id
         ${where}
        ORDER BY d.fecha`,
      params
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener utilidad diaria:', err);
    throw err;
  }
};

/**
 * Los números de la pantalla principal del módulo.
 *
 * `pendiente_colaboradores` es lo que se le debe a la gente: sale de sumar
 * sólo los saldos positivos. Sumar todos mezclaría a quien está sobrepagado
 * y haría ver la deuda más chica de lo que es.
 */
export const obtenerResumenGeneral = async ({ desde = null, hasta = null } = {}) => {
  try {
    const connection = await connectDB();

    const condiciones = [];
    const params = [];
    if (desde) {
      condiciones.push('fecha >= ?');
      params.push(desde);
    }
    if (hasta) {
      condiciones.push('fecha <= ?');
      params.push(hasta);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [[operacion]] = await connection.query(
      `SELECT COALESCE(SUM(ingreso_total), 0) AS ingreso,
              COALESCE(SUM(mano_obra), 0)     AS mano_obra,
              COUNT(*)                        AS dias_registrados,
              COALESCE(SUM(metros_total), 0)  AS metros
         FROM v_planilla_dia_resumen
         ${where}`,
      params
    );

    const [[gastos]] = await connection.query(
      `SELECT COALESCE(SUM(monto), 0) AS gastos FROM planilla_gastos ${where}`,
      params
    );

    const [[colaboradores]] = await connection.query(
      `SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0) AS pendiente_colaboradores,
              COALESCE(SUM(pagado), 0)             AS pagado_colaboradores
         FROM v_colaborador_saldo`
    );

    const [[proyectos]] = await connection.query(
      `SELECT COUNT(*)                        AS proyectos,
              COALESCE(SUM(costo), 0)         AS costo_contratado,
              COALESCE(SUM(abonado), 0)       AS abonado,
              COALESCE(SUM(pendiente), 0)     AS pendiente_cobrar
         FROM v_proyecto_saldo`
    );

    const ingreso = Number(operacion.ingreso);
    const manoObra = Number(operacion.mano_obra);
    const totalGastos = Number(gastos.gastos);

    return {
      periodo: { desde, hasta },
      ingreso,
      mano_obra: manoObra,
      gastos: totalGastos,
      utilidad: Number((ingreso - manoObra - totalGastos).toFixed(2)),
      dias_registrados: Number(operacion.dias_registrados),
      metros: Number(operacion.metros),
      ...colaboradores,
      ...proyectos
    };
  } catch (err) {
    console.error('Error al obtener resumen general:', err);
    throw err;
  }
};
