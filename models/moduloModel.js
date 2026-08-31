import connectDB from '../config/db.js';

/**
 * Módulos visibles para un cargo. Con esto el frontend arma el menú sin tener
 * el cargo_id escrito en el código.
 */
export const obtenerModulosPorCargo = async (cargoId) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT m.id, m.clave, m.nombre, m.ruta, m.icono, m.orden
         FROM cargo_modulo cm
         JOIN modulos m ON m.id = cm.modulo_id
        WHERE cm.cargo_id = ? AND m.activo = 1
        ORDER BY m.orden, m.nombre`,
      [cargoId]
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener módulos por cargo:', err);
    throw err;
  }
};

/** Todos los módulos con la lista de cargos que los tienen asignados. */
export const obtenerModulos = async () => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT m.id, m.clave, m.nombre, m.ruta, m.icono, m.orden, m.activo,
              GROUP_CONCAT(cm.cargo_id ORDER BY cm.cargo_id) AS cargos
         FROM modulos m
         LEFT JOIN cargo_modulo cm ON cm.modulo_id = m.id
        GROUP BY m.id, m.clave, m.nombre, m.ruta, m.icono, m.orden, m.activo
        ORDER BY m.orden, m.nombre`
    );

    return rows.map((row) => ({
      ...row,
      cargos: row.cargos ? row.cargos.split(',').map(Number) : []
    }));
  } catch (err) {
    console.error('Error al obtener módulos:', err);
    throw err;
  }
};

/**
 * Reemplaza los cargos que tienen acceso a un módulo.
 * Se borra y se vuelve a insertar dentro de una transacción para que nunca
 * quede un módulo sin nadie por un fallo a medio camino.
 */
export const asignarCargosAModulo = async (moduloId, cargoIds) => {
  const pool = await connectDB();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [modulo] = await connection.query('SELECT id FROM modulos WHERE id = ?', [moduloId]);
    if (modulo.length === 0) {
      await connection.rollback();
      return null;
    }

    await connection.query('DELETE FROM cargo_modulo WHERE modulo_id = ?', [moduloId]);

    if (cargoIds.length > 0) {
      await connection.query(
        'INSERT INTO cargo_modulo (cargo_id, modulo_id) VALUES ?',
        [cargoIds.map((cargoId) => [cargoId, moduloId])]
      );
    }

    await connection.commit();
    return { modulo_id: moduloId, cargos: cargoIds };
  } catch (err) {
    await connection.rollback();
    console.error('Error al asignar cargos al módulo:', err);
    throw err;
  } finally {
    connection.release();
  }
};
