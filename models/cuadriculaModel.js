import connectDB from '../config/db.js';

/**
 * La planilla vista como la cuadrícula del Excel: días en filas, colaboradores
 * en columnas, todo de una sola vez.
 *
 * Existe aparte de planillaDiaModel porque resuelve un problema distinto. Aquel
 * trabaja un día a la vez, que es lo correcto para un formulario; para pintar
 * una cuadrícula haría falta una petición por día (hasta 31) y guardar una por
 * cada celda tocada. Aquí se lee todo con tres consultas y se guarda en una
 * sola transacción.
 *
 * Los datos son EXACTAMENTE los mismos: mismas tablas, mismas vistas. Las dos
 * pantallas tienen que mostrar los mismos números o la comparación entre
 * ambas no sirve de nada.
 */

/* ============================
   Lectura
   ============================ */

/** Todo lo que necesita la cuadrícula: integrantes, días, pagos y gastos. */
export const obtenerCuadricula = async (planillaId) => {
  try {
    const connection = await connectDB();

    const [[planilla]] = await connection.query(
      'SELECT * FROM planillas WHERE id = ?',
      [planillaId]
    );
    if (!planilla) return null;

    const [[resumen]] = await connection.query(
      'SELECT * FROM v_planilla_resumen WHERE planilla_id = ?',
      [planillaId]
    );

    const [colaboradores] = await connection.query(
      `SELECT pc.colaborador_id, pc.tarifa_diaria,
              c.nombre, c.apellido, c.alias
         FROM planilla_colaborador pc
         JOIN colaboradores c ON c.id = pc.colaborador_id
        WHERE pc.planilla_id = ?
        ORDER BY c.nombre`,
      [planillaId]
    );

    const [dias] = await connection.query(
      `SELECT d.*, r.ingreso_total, r.mano_obra, r.gastos, r.gasto_total, r.utilidad
         FROM planilla_dias d
         JOIN v_planilla_dia_resumen r ON r.planilla_dia_id = d.id
        WHERE d.planilla_id = ?
        ORDER BY d.fecha`,
      [planillaId]
    );

    const [pagos] = await connection.query(
      `SELECT dc.planilla_dia_id, dc.colaborador_id, dc.asistio, dc.monto, dc.bono, dc.observacion
         FROM planilla_dia_colaborador dc
         JOIN planilla_dias d ON d.id = dc.planilla_dia_id
        WHERE d.planilla_id = ?`,
      [planillaId]
    );

    const [gastos] = await connection.query(
      `SELECT g.id, g.planilla_id, g.planilla_dia_id, g.categoria_id, g.descripcion, g.monto, g.fecha,
              cg.nombre AS categoria
         FROM planilla_gastos g
         JOIN categorias_gasto_planilla cg ON cg.id = g.categoria_id
        WHERE g.planilla_id = ?
        ORDER BY g.id`,
      [planillaId]
    );

    // Los pagos y gastos se cuelgan de su día para que el frontend no tenga
    // que cruzarlos: la cuadrícula ya es bastante trabajo de pintar.
    // El detalle va en `gastosDetalle`, NO en `gastos`: esa columna ya viene de
    // v_planilla_dia_resumen con el total del día y pisarla dejaría a la
    // pantalla sin con qué contrastar su propia suma.
    const porDia = new Map(dias.map((d) => [d.id, { ...d, pagos: [], gastosDetalle: [] }]));
    for (const p of pagos) porDia.get(p.planilla_dia_id)?.pagos.push(p);
    for (const g of gastos) {
      if (g.planilla_dia_id) porDia.get(g.planilla_dia_id)?.gastosDetalle.push(g);
    }

    return {
      planilla,
      resumen: resumen || null,
      colaboradores,
      dias: [...porDia.values()],
      // Gastos del periodo que no pertenecen a un día: la cuadrícula no los
      // edita, pero los muestra para que el total cuadre con la otra pantalla.
      gastosGenerales: gastos.filter((g) => !g.planilla_dia_id)
    };
  } catch (err) {
    console.error('Error al obtener la cuadrícula:', err);
    throw err;
  }
};

/* ============================
   Guardado
   ============================ */

const CAMPOS_EDITABLES = [
  'sector', 'trabajo_realizado', 'estado', 'instalaciones', 'tarifa_instalacion',
  'metros_fibra', 'punta_inicial', 'punta_final', 'tarifa_metro', 'tipo_fibra_id',
  'bono_onnet', 'ingreso', 'proyecto_id', 'observaciones'
];

const VALOR_POR_DEFECTO = {
  sector: null, trabajo_realizado: null, estado: 'trabajado', instalaciones: 0,
  tarifa_instalacion: 0, metros_fibra: 0, punta_inicial: 0, punta_final: 0,
  tarifa_metro: 0, tipo_fibra_id: null, bono_onnet: 0, ingreso: 0,
  proyecto_id: null, observaciones: null
};

/**
 * Guarda las filas que el usuario tocó.
 *
 * Todo en UNA transacción. En la cuadrícula se editan varios días antes de
 * pulsar guardar; si se mandaran sueltos y fallara el quinto, quedarían cuatro
 * días guardados y el usuario creyendo que no se guardó nada.
 *
 * Cada día se ubica por (planilla_id, fecha): si existe se actualiza, si no se
 * crea. Así el frontend puede pintar el mes completo sin haber creado antes
 * los días vacíos.
 *
 * `pagos` y `gastos` sólo se tocan cuando vienen en el cuerpo. Un día donde
 * únicamente se cambió el sector no debe perder sus gastos.
 */
export const guardarCuadricula = async (planillaId, dias, usuarioId = null) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[planilla]] = await connection.query(
      'SELECT id, estado, fecha_inicio, fecha_fin FROM planillas WHERE id = ?',
      [planillaId]
    );

    if (!planilla) {
      await connection.rollback();
      return null;
    }

    if (planilla.estado === 'pagada') {
      await connection.rollback();
      const error = new Error('La planilla ya está pagada. Reábrala para modificarla.');
      error.codigo = 'PLANILLA_PAGADA';
      throw error;
    }

    let creados = 0;
    let actualizados = 0;

    for (const dia of dias) {
      const [existentes] = await connection.query(
        'SELECT id FROM planilla_dias WHERE planilla_id = ? AND fecha = ?',
        [planillaId, dia.fecha]
      );

      let diaId;

      if (existentes.length) {
        diaId = existentes[0].id;

        // Al ACTUALIZAR se tocan sólo los campos que vinieron.
        //
        // La cuadrícula no maneja instalaciones, tarifa_metro, proyecto_id ni
        // observaciones: si se escribieran con su valor por defecto, editar un
        // jornal desde aquí borraría en silencio lo que se hubiera puesto en
        // esos campos desde la pantalla detallada.
        const presentes = CAMPOS_EDITABLES.filter((campo) => dia[campo] !== undefined);

        if (presentes.length) {
          await connection.query(
            `UPDATE planilla_dias
                SET ${presentes.map((c) => `${c} = ?`).join(', ')}
              WHERE id = ?`,
            [...presentes.map((campo) => dia[campo]), diaId]
          );
        }
        actualizados += 1;
      } else {
        // Al CREAR sí hacen falta todos: la fila no existía.
        const valores = CAMPOS_EDITABLES.map((campo) =>
          dia[campo] === undefined ? VALOR_POR_DEFECTO[campo] : dia[campo]
        );

        const [resultado] = await connection.query(
          `INSERT INTO planilla_dias (planilla_id, fecha, ${CAMPOS_EDITABLES.join(', ')}, creado_por)
           VALUES (?, ?, ${CAMPOS_EDITABLES.map(() => '?').join(', ')}, ?)`,
          [planillaId, dia.fecha, ...valores, usuarioId]
        );
        diaId = resultado.insertId;
        creados += 1;
      }

      if (dia.pagos !== undefined) {
        // Quien recibe un pago tiene que estar en el roster: la vista de
        // liquidación arranca de ahí y si no, sus jornales no aparecerían.
        const ids = dia.pagos.map((p) => p.colaborador_id).filter(Boolean);
        if (ids.length) {
          await connection.query(
            `INSERT IGNORE INTO planilla_colaborador (planilla_id, colaborador_id, tarifa_diaria)
             SELECT ?, c.id, c.tarifa_diaria FROM colaboradores c WHERE c.id IN (?)`,
            [planillaId, ids]
          );
        }

        await connection.query(
          'DELETE FROM planilla_dia_colaborador WHERE planilla_dia_id = ?',
          [diaId]
        );

        // Sólo se guarda a quien asistió o recibió algo. Una fila en cero por
        // cada ausente llenaría la tabla sin decir nada.
        const conDatos = dia.pagos.filter(
          (p) => p.asistio || Number(p.monto) > 0 || Number(p.bono) > 0
        );

        if (conDatos.length) {
          await connection.query(
            `INSERT INTO planilla_dia_colaborador
               (planilla_dia_id, colaborador_id, asistio, monto, bono, observacion)
             VALUES ?`,
            [conDatos.map((p) => [
              diaId,
              p.colaborador_id,
              p.asistio === false || p.asistio === 0 ? 0 : 1,
              p.monto ?? 0,
              p.bono ?? 0,
              p.observacion ?? null
            ])]
          );
        }
      }

      if (dia.gastos !== undefined) {
        await connection.query(
          'DELETE FROM planilla_gastos WHERE planilla_dia_id = ?',
          [diaId]
        );

        const conMonto = dia.gastos.filter((g) => Number(g.monto) > 0);
        if (conMonto.length) {
          await connection.query(
            `INSERT INTO planilla_gastos
               (planilla_id, planilla_dia_id, categoria_id, descripcion, monto, fecha, creado_por)
             VALUES ?`,
            [conMonto.map((g) => [
              planillaId,
              diaId,
              g.categoria_id,
              g.descripcion ?? null,
              g.monto,
              g.fecha || dia.fecha,
              usuarioId
            ])]
          );
        }
      }
    }

    await connection.commit();
    return { creados, actualizados };
  } catch (err) {
    if (err.codigo !== 'PLANILLA_PAGADA') {
      await connection.rollback();
      console.error('Error al guardar la cuadrícula:', err);
    }
    throw err;
  } finally {
    connection.release();
  }
};
