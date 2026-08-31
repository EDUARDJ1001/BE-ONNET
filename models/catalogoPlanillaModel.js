import connectDB from '../config/db.js';

/**
 * Catálogos del módulo de planillas: cuadrillas, tipos de fibra y categorías
 * de gasto. Van juntos porque el frontend los pide de una sola vez para armar
 * los selects del formulario del día.
 */

export const obtenerCuadrillas = async (soloActivas = true) => {
  try {
    const connection = await connectDB();
    const query = soloActivas
      ? 'SELECT * FROM cuadrillas WHERE activo = 1 ORDER BY nombre'
      : 'SELECT * FROM cuadrillas ORDER BY nombre';
    const [rows] = await connection.query(query);
    return rows;
  } catch (err) {
    console.error('Error al obtener cuadrillas:', err);
    throw err;
  }
};

export const crearCuadrilla = async ({ nombre, descripcion = null }) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      'INSERT INTO cuadrillas (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion]
    );
    return { id: result.insertId, nombre, descripcion, activo: 1 };
  } catch (err) {
    console.error('Error al crear cuadrilla:', err);
    throw err;
  }
};

export const actualizarCuadrilla = async (id, { nombre, descripcion = null, activo = 1 }) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      'UPDATE cuadrillas SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?',
      [nombre, descripcion, activo ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return null;
    return { id, nombre, descripcion, activo: activo ? 1 : 0 };
  } catch (err) {
    console.error('Error al actualizar cuadrilla:', err);
    throw err;
  }
};

export const obtenerTiposFibra = async () => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      'SELECT * FROM tipos_fibra WHERE activo = 1 ORDER BY codigo'
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener tipos de fibra:', err);
    throw err;
  }
};

export const obtenerCategoriasGasto = async () => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      'SELECT * FROM categorias_gasto_planilla WHERE activo = 1 ORDER BY nombre'
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener categorías de gasto:', err);
    throw err;
  }
};

/** Todo lo que necesita el formulario del día, en una sola llamada. */
export const obtenerCatalogos = async () => {
  const [cuadrillas, tiposFibra, categoriasGasto] = await Promise.all([
    obtenerCuadrillas(),
    obtenerTiposFibra(),
    obtenerCategoriasGasto()
  ]);
  return { cuadrillas, tiposFibra, categoriasGasto };
};
