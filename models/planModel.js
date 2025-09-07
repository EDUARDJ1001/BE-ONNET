import connectDB from "../config/db.js";

export const obtenerPlanes = async () => {
    try {
        const connection = await connectDB();
        const query = 'SELECT * FROM planes';
        const [rows] = await connection.query(query);
        return rows;
    } catch (err) {
        console.error('Error al obtener planes:', err);
        throw err;
    }
};

export const obtenerPlanPorId = async (id) => {
  try {
    const connection = await connectDB();
    const query = "SELECT * FROM planes WHERE Id = ?";
    const [rows] = await connection.query(query, [id]);
    return rows[0] || null;
  } catch (err) {
    console.error("Error al obtener plan por id:", err);
    throw err;
  }
};

export const crearPlan = async (planData) => {
  try {
    const connection = await connectDB();
    const query = "INSERT INTO planes (nombre, precio_mensual, descripcion) VALUES (?, ?, ?)";
    const [result] = await connection.query(query, [
      planData.nombre,
      planData.precio_mensual,
      planData.descripcion
    ]);
    return { id: result.insertId, ...planData };
  } catch (err) {
    console.error("Error al crear plan:", err);
    throw err;
  }
};

export const actualizarPlan = async (id, planData) => {
  try {
    const connection = await connectDB();
    const query = "UPDATE planes SET nombre = ?, precio_mensual = ?, descripcion = ? WHERE Id = ?";
    const [result] = await connection.query(query, [
      planData.nombre,
      planData.precio_mensual,
      planData.descripcion,
      id
    ]);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id, ...planData };
  } catch (err) {
    console.error("Error al actualizar plan:", err);
    throw err;
  }
};

export const eliminarPlan = async (id) => {
  try {
    const connection = await connectDB();
    const query = "DELETE FROM planes WHERE Id = ?";
    const [result] = await connection.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id };
  } catch (err) {
    console.error("Error al eliminar plan:", err);
    throw err;
  }
};
