import connectDB from '../config/db.js';

/**
 * Proyectos y sus abonos: la hoja CONTROL del Excel, con los totales
 * calculados en lugar de escritos a mano.
 */

/** Costo, abonado y pendiente de cada proyecto (vista v_proyecto_saldo). */
export const obtenerProyectos = async ({ estado = null } = {}) => {
  try {
    const connection = await connectDB();
    const params = [];
    let query = 'SELECT * FROM v_proyecto_saldo';
    if (estado) {
      query += ' WHERE estado = ?';
      params.push(estado);
    }
    query += ' ORDER BY nombre';
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (err) {
    console.error('Error al obtener proyectos:', err);
    throw err;
  }
};

export const obtenerProyectoPorId = async (id) => {
  try {
    const connection = await connectDB();

    const [[proyecto]] = await connection.query(
      'SELECT * FROM v_proyecto_saldo WHERE proyecto_id = ?',
      [id]
    );
    if (!proyecto) return null;

    const [datos] = await connection.query('SELECT * FROM proyectos WHERE id = ?', [id]);

    const [abonos] = await connection.query(
      `SELECT a.*, mp.descripcion AS metodo
         FROM proyecto_abonos a
         LEFT JOIN metodos_pago mp ON mp.id = a.metodo_id
        WHERE a.proyecto_id = ?
        ORDER BY a.fecha`,
      [id]
    );

    const [dias] = await connection.query(
      `SELECT d.*, p.nombre AS planilla
         FROM v_planilla_dia_resumen d
         JOIN planillas p ON p.id = d.planilla_id
        WHERE d.proyecto_id = ?
        ORDER BY d.fecha`,
      [id]
    );

    return { ...datos[0], ...proyecto, abonos, dias };
  } catch (err) {
    console.error('Error al obtener proyecto por id:', err);
    throw err;
  }
};

export const crearProyecto = async (data, usuarioId = null) => {
  const {
    nombre,
    contratante = null,
    costo = 0,
    fecha_inicio = null,
    fecha_fin = null,
    estado = 'en_proceso',
    observaciones = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO proyectos
         (nombre, contratante, costo, fecha_inicio, fecha_fin, estado, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, contratante, costo, fecha_inicio, fecha_fin, estado, observaciones, usuarioId]
    );
    return await obtenerProyectoPorId(result.insertId);
  } catch (err) {
    console.error('Error al crear proyecto:', err);
    throw err;
  }
};

export const actualizarProyecto = async (id, data) => {
  const {
    nombre,
    contratante = null,
    costo = 0,
    fecha_inicio = null,
    fecha_fin = null,
    estado = 'en_proceso',
    observaciones = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE proyectos
          SET nombre = ?, contratante = ?, costo = ?, fecha_inicio = ?, fecha_fin = ?,
              estado = ?, observaciones = ?
        WHERE id = ?`,
      [nombre, contratante, costo, fecha_inicio, fecha_fin, estado, observaciones, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerProyectoPorId(id);
  } catch (err) {
    console.error('Error al actualizar proyecto:', err);
    throw err;
  }
};

export const eliminarProyecto = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM proyectos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar proyecto:', err);
    throw err;
  }
};

/* ============================
   Abonos
   ============================ */

/**
 * Lista de abonos. `sinAsignar` devuelve los que todavía no tienen proyecto:
 * en la hoja CONTROL las columnas DEPOSITO y PROYECTO eran listas separadas,
 * así que 4 depósitos entraron sin dueño y hay que repartirlos a mano.
 */
export const obtenerAbonos = async ({ proyectoId = null, sinAsignar = false } = {}) => {
  try {
    const connection = await connectDB();
    const params = [];
    let query = `
      SELECT a.*, p.nombre AS proyecto, mp.descripcion AS metodo
        FROM proyecto_abonos a
        LEFT JOIN proyectos p ON p.id = a.proyecto_id
        LEFT JOIN metodos_pago mp ON mp.id = a.metodo_id`;

    if (sinAsignar) {
      query += ' WHERE a.proyecto_id IS NULL';
    } else if (proyectoId) {
      query += ' WHERE a.proyecto_id = ?';
      params.push(proyectoId);
    }

    query += ' ORDER BY a.fecha DESC';
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (err) {
    console.error('Error al obtener abonos:', err);
    throw err;
  }
};

export const crearAbono = async (data, usuarioId = null) => {
  const {
    proyecto_id = null,
    monto,
    fecha,
    metodo_id = null,
    referencia = null,
    observacion = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO proyecto_abonos
         (proyecto_id, monto, fecha, metodo_id, referencia, observacion, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [proyecto_id, monto, fecha, metodo_id, referencia, observacion, usuarioId]
    );
    return { id: result.insertId, ...data };
  } catch (err) {
    console.error('Error al crear abono:', err);
    throw err;
  }
};

/** Asignar (o reasignar) un abono suelto a un proyecto. */
export const asignarAbono = async (id, proyectoId) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      'UPDATE proyecto_abonos SET proyecto_id = ? WHERE id = ?',
      [proyectoId, id]
    );
    if (result.affectedRows === 0) return null;
    return { id, proyecto_id: proyectoId };
  } catch (err) {
    console.error('Error al asignar abono:', err);
    throw err;
  }
};

export const eliminarAbono = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM proyecto_abonos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar abono:', err);
    throw err;
  }
};

/* ============================
   Hoja de control (guardado en bloque)
   ============================ */

/**
 * Guarda de una vez la hoja de control: proyectos y depósitos.
 *
 * Es la pantalla que imita la hoja CONTROL del Excel: se editan varias filas
 * y se guarda con un botón. Todo va en una transacción, igual que la planilla
 * rápida, para que un error en la fila 8 no deje guardadas las siete primeras.
 *
 * Un proyecto recién escrito todavía no tiene id, pero un depósito de la
 * misma tanda puede estar asignado a él. Por eso cada proyecto trae una
 * `clave` que pone la pantalla, y los depósitos pueden apuntar a esa clave
 * (`proyecto_clave`) en lugar de a un id. Aquí se traduce clave -> id real.
 *
 * Orden: primero se crean y actualizan proyectos (para que existan los ids),
 * después los depósitos, y al final se borra lo marcado. Borrar un proyecto
 * deja sus depósitos sin asignar (ON DELETE SET NULL): el dinero se recibió
 * igual y no debe desaparecer con el proyecto.
 */
export const guardarControl = async ({ proyectos = [], abonos = [] }, usuarioId = null) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idPorClave = new Map();
    let cambios = 0;

    for (const p of proyectos) {
      if (p.eliminar) continue;

      if (p.id) {
        const [r] = await connection.query(
          'UPDATE proyectos SET nombre = ?, costo = ?, estado = ? WHERE id = ?',
          [p.nombre, p.costo, p.estado, p.id]
        );
        if (r.affectedRows === 0) {
          const error = new Error(`El proyecto "${p.nombre}" ya no existe. Recargue la hoja.`);
          error.codigo = 'CONFLICTO_CONTROL';
          throw error;
        }
        if (p.clave) idPorClave.set(p.clave, p.id);
      } else {
        const [r] = await connection.query(
          'INSERT INTO proyectos (nombre, costo, estado, creado_por) VALUES (?, ?, ?, ?)',
          [p.nombre, p.costo, p.estado, usuarioId]
        );
        if (p.clave) idPorClave.set(p.clave, r.insertId);
      }
      cambios += 1;
    }

    for (const a of abonos) {
      if (a.eliminar) continue;

      let proyectoId = a.proyecto_id ?? null;
      if (a.proyecto_clave) {
        if (!idPorClave.has(a.proyecto_clave)) {
          const error = new Error('Un depósito apunta a un proyecto que no está en la hoja.');
          error.codigo = 'CONFLICTO_CONTROL';
          throw error;
        }
        proyectoId = idPorClave.get(a.proyecto_clave);
      }

      if (a.id) {
        const [r] = await connection.query(
          `UPDATE proyecto_abonos
              SET monto = ?, fecha = ?, proyecto_id = ?, referencia = ?
            WHERE id = ?`,
          [a.monto, a.fecha, proyectoId, a.referencia ?? null, a.id]
        );
        if (r.affectedRows === 0) {
          const error = new Error('Un depósito ya no existe. Recargue la hoja.');
          error.codigo = 'CONFLICTO_CONTROL';
          throw error;
        }
      } else {
        await connection.query(
          `INSERT INTO proyecto_abonos (proyecto_id, monto, fecha, referencia, creado_por)
           VALUES (?, ?, ?, ?, ?)`,
          [proyectoId, a.monto, a.fecha, a.referencia ?? null, usuarioId]
        );
      }
      cambios += 1;
    }

    for (const a of abonos) {
      if (a.eliminar && a.id) {
        await connection.query('DELETE FROM proyecto_abonos WHERE id = ?', [a.id]);
        cambios += 1;
      }
    }

    for (const p of proyectos) {
      if (p.eliminar && p.id) {
        await connection.query('DELETE FROM proyectos WHERE id = ?', [p.id]);
        cambios += 1;
      }
    }

    await connection.commit();
    return { cambios };
  } catch (err) {
    await connection.rollback();
    if (!err.codigo) console.error('Error al guardar la hoja de control:', err);
    throw err;
  } finally {
    connection.release();
  }
};
