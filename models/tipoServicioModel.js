import connectDB from '../config/db.js';

export const obtenerTiposServicio = async () => {
  try {
    const connection = await connectDB();
    const query = 'SELECT * FROM tipoServicio ORDER BY id ASC';
    const [rows] = await connection.query(query);
    return rows;
  } catch (err) {
    console.error('Error al obtener tipos de servicio:', err);
    throw err;
  }
};

