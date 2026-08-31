import connectDB from '../config/db.js';

/**
 * Personal de campo. No confundir con `usuarios`: eso es quien entra al
 * sistema. Estos cobran jornal y en su mayoría no tienen login.
 */

export const obtenerColaboradores = async ({ soloActivos = false } = {}) => {
  try {
    const connection = await connectDB();
    const query = `
      SELECT c.*, u.username
        FROM colaboradores c
        LEFT JOIN usuarios u ON u.id = c.usuario_id
       ${soloActivos ? 'WHERE c.activo = 1' : ''}
       ORDER BY c.activo DESC, c.nombre`;
    const [rows] = await connection.query(query);
    return rows;
  } catch (err) {
    console.error('Error al obtener colaboradores:', err);
    throw err;
  }
};

export const obtenerColaboradorPorId = async (id) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT c.*, u.username
         FROM colaboradores c
         LEFT JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('Error al obtener colaborador por id:', err);
    throw err;
  }
};

export const crearColaborador = async (data) => {
  const {
    nombre,
    apellido = null,
    alias = null,
    identidad = null,
    telefono = null,
    tarifa_diaria = 500,
    usuario_id = null
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO colaboradores
         (nombre, apellido, alias, identidad, telefono, tarifa_diaria, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, alias, identidad, telefono, tarifa_diaria, usuario_id]
    );
    return await obtenerColaboradorPorId(result.insertId);
  } catch (err) {
    console.error('Error al crear colaborador:', err);
    throw err;
  }
};

export const actualizarColaborador = async (id, data) => {
  const {
    nombre,
    apellido = null,
    alias = null,
    identidad = null,
    telefono = null,
    tarifa_diaria = 500,
    usuario_id = null,
    activo = 1
  } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE colaboradores
          SET nombre = ?, apellido = ?, alias = ?, identidad = ?, telefono = ?,
              tarifa_diaria = ?, usuario_id = ?, activo = ?
        WHERE id = ?`,
      [nombre, apellido, alias, identidad, telefono, tarifa_diaria, usuario_id, activo ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerColaboradorPorId(id);
  } catch (err) {
    console.error('Error al actualizar colaborador:', err);
    throw err;
  }
};

/**
 * Baja lógica. No se borra: si un colaborador tiene días trabajados, el FK
 * RESTRICT lo impide, y con razón — borrarlo dejaría planillas sin cuadrar.
 */
export const desactivarColaborador = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      'UPDATE colaboradores SET activo = 0 WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return null;
    return { id, activo: 0 };
  } catch (err) {
    console.error('Error al desactivar colaborador:', err);
    throw err;
  }
};

/** Devengado, vales, pagado y saldo de cada colaborador (todas las planillas). */
export const obtenerSaldos = async () => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      'SELECT * FROM v_colaborador_saldo ORDER BY saldo DESC, nombre'
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener saldos de colaboradores:', err);
    throw err;
  }
};

/** Detalle de un colaborador: saldo global + su liquidación planilla por planilla. */
export const obtenerEstadoCuenta = async (id) => {
  try {
    const connection = await connectDB();

    const colaborador = await obtenerColaboradorPorId(id);
    if (!colaborador) return null;

    const [[saldo]] = await connection.query(
      'SELECT * FROM v_colaborador_saldo WHERE colaborador_id = ?',
      [id]
    );

    const [planillas] = await connection.query(
      `SELECT l.*, p.fecha_inicio, p.fecha_fin, p.estado AS estado_planilla
         FROM v_planilla_liquidacion l
         JOIN planillas p ON p.id = l.planilla_id
        WHERE l.colaborador_id = ?
        ORDER BY p.fecha_inicio DESC`,
      [id]
    );

    const [vales] = await connection.query(
      'SELECT * FROM colaborador_vales WHERE colaborador_id = ? ORDER BY fecha DESC',
      [id]
    );

    const [pagos] = await connection.query(
      `SELECT cp.*, mp.descripcion AS metodo
         FROM colaborador_pagos cp
         LEFT JOIN metodos_pago mp ON mp.id = cp.metodo_id
        WHERE cp.colaborador_id = ?
        ORDER BY cp.fecha_pago DESC`,
      [id]
    );

    return { colaborador, saldo: saldo || null, planillas, vales, pagos };
  } catch (err) {
    console.error('Error al obtener estado de cuenta:', err);
    throw err;
  }
};
