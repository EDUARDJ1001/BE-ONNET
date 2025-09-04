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