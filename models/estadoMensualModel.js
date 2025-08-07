import connectDB from '../config/db.js';

export const obtenerEstadosMensuales = async () => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM estado_mensual');
    return rows;
};

export const obtenerEstadoPorId = async (id) => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM estado_mensual WHERE id = ?', [id]);
    return rows[0];
};

export const obtenerEstadoPorClienteYAno = async (clienteId, anio) => {
    const db = await connectDB();
    const [rows] = await db.execute(
        'SELECT * FROM estado_mensual WHERE cliente_id = ? AND anio = ? ORDER BY mes ASC',
        [clienteId, anio]
    );
    return rows;
};

export const crearEstadoMensual = async (registro) => {
    const { cliente_id, mes, anio, estado } = registro;
    const db = await connectDB();
    const query = `
        INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [cliente_id, mes, anio, estado]);
    return result.insertId;
};

export const actualizarEstadoMensual = async (id, data) => {
    const { estado } = data;
    const db = await connectDB();
    const query = 'UPDATE estado_mensual SET estado = ? WHERE id = ?';
    const [result] = await db.execute(query, [estado, id]);
    return result;
};

export const eliminarEstadoMensual = async (id) => {
    const db = await connectDB();
    const [result] = await db.execute('DELETE FROM estado_mensual WHERE id = ?', [id]);
    return result;
};
