import connectDB from "../config/db.js";

export const obtenerGastos = async () => {
    try {
        const connection = await connectDB();
        const query = 'SELECT * FROM gastos';
        const [rows] = await connection.query(query);
        return rows;
    } catch (err) {
        console.error('Error al obtener gastos:', err);
        throw err;
    }
};

export const obtenerGastoPorId = async (id) => {
  try {
    const connection = await connectDB();
    const query = "SELECT * FROM gastos WHERE id = ?";
    const [rows] = await connection.query(query, [id]);
    return rows[0] || null;
  } catch (err) {
    console.error("Error al obtener gasto por id:", err);
    throw err;
  }
};

export const crearGasto = async (gastoData) => {
  try {
    const connection = await connectDB();
    const query = "INSERT INTO gastos (descripcion, monto, fecha) VALUES (?, ?, ?)";
    const [result] = await connection.query(query, [
      gastoData.descripcion,
      gastoData.monto,
      gastoData.fecha
    ]);
    return { id: result.insertId, ...gastoData };
  } catch (err) {
    console.error("Error al crear gasto:", err);
    throw err;
  }
};

export const actualizarGasto = async (id, gastoData) => {
  try {
    const connection = await connectDB();
    const query = "UPDATE gastos SET descripcion = ?, monto = ?, fecha = ? WHERE id = ?";
    const [result] = await connection.query(query, [
      gastoData.descripcion,
      gastoData.monto,
      gastoData.fecha,
      id
    ]);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id, ...gastoData };
  } catch (err) {
    console.error("Error al actualizar gasto:", err);
    throw err;
  }
};

export const eliminarGasto = async (id) => {
  try {
    const connection = await connectDB();
    const query = "DELETE FROM gastos WHERE id = ?";
    const [result] = await connection.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id };
  } catch (err) {
    console.error("Error al eliminar gasto:", err);
    throw err;
  }
};
