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
