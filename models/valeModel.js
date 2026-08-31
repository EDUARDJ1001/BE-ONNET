import connectDB from '../config/db.js';

/**
 * Vales: adelantos entregados al colaborador contra su liquidación.
 *
 * En el Excel era un solo número por persona (Jair 1,650; Maynor 2,000). Aquí
 * cada adelanto es una fila con su fecha, así que el total siempre se puede
 * reconstruir y nadie tiene que acordarse de dónde salió.
 */

export const obtenerVales = async ({ colaboradorId = null, planillaId = null } = {}) => {
  try {
    const connection = await connectDB();
    const condiciones = [];
    const params = [];

    if (colaboradorId) {
      condiciones.push('v.colaborador_id = ?');
      params.push(colaboradorId);
    }
    if (planillaId) {
      condiciones.push('v.planilla_id = ?');
      params.push(planillaId);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `SELECT v.*, c.nombre AS colaborador, c.alias, p.nombre AS planilla
         FROM colaborador_vales v
         JOIN colaboradores c ON c.id = v.colaborador_id
         LEFT JOIN planillas p ON p.id = v.planilla_id
         ${where}
        ORDER BY v.fecha DESC, v.id DESC`,
      params
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener vales:', err);
    throw err;
  }
};

export const obtenerValePorId = async (id) => {
  try {
    const connection = await connectDB();
    const [rows] = await connection.query('SELECT * FROM colaborador_vales WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (err) {
    console.error('Error al obtener vale por id:', err);
    throw err;
  }
};

export const crearVale = async (data, usuarioId = null) => {
  const { colaborador_id, planilla_id = null, fecha, monto, descripcion = null } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `INSERT INTO colaborador_vales
         (colaborador_id, planilla_id, fecha, monto, descripcion, creado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [colaborador_id, planilla_id, fecha, monto, descripcion, usuarioId]
    );
    return await obtenerValePorId(result.insertId);
  } catch (err) {
    console.error('Error al crear vale:', err);
    throw err;
  }
};

export const actualizarVale = async (id, data) => {
  const { colaborador_id, planilla_id = null, fecha, monto, descripcion = null } = data;

  try {
    const connection = await connectDB();
    const [result] = await connection.query(
      `UPDATE colaborador_vales
          SET colaborador_id = ?, planilla_id = ?, fecha = ?, monto = ?, descripcion = ?
        WHERE id = ?`,
      [colaborador_id, planilla_id, fecha, monto, descripcion, id]
    );
    if (result.affectedRows === 0) return null;
    return await obtenerValePorId(id);
  } catch (err) {
    console.error('Error al actualizar vale:', err);
    throw err;
  }
};

export const eliminarVale = async (id) => {
  try {
    const connection = await connectDB();
    const [result] = await connection.query('DELETE FROM colaborador_vales WHERE id = ?', [id]);
    if (result.affectedRows === 0) return null;
    return { id };
  } catch (err) {
    console.error('Error al eliminar vale:', err);
    throw err;
  }
};
