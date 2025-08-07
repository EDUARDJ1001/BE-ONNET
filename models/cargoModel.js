import connectDB from "../config/db.js";

export const obtenerCargos = async () => {
    try {
        const connection = await connectDB();
        const query = 'SELECT * FROM cargos';
        const [rows] = await connection.query(query);
        return rows;
    } catch (err) {
        console.error('Error al obtener cargos:', err);
        throw err;
    }
};