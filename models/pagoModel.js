import connectDB from '../config/db.js';

export const obtenerPagos = async () => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM pagos');
    return rows;
};

export const obtenerPagoPorId = async (id) => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM pagos WHERE id = ?', [id]);
    return rows[0];
};

export const crearPago = async (pago) => {
    const { cliente_id, monto, fecha_pago, observacion } = pago;
    const db = await connectDB();
    const query = `
        INSERT INTO pagos (cliente_id, monto, fecha_pago, observacion)
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [cliente_id, monto, fecha_pago, observacion]);
    return result.insertId;
};

export const actualizarPago = async (id, pago) => {
    const { cliente_id, monto, fecha_pago, observacion } = pago;
    const db = await connectDB();
    const query = `
        UPDATE pagos
        SET cliente_id = ?, monto = ?, fecha_pago = ?, observacion = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [cliente_id, monto, fecha_pago, observacion, id]);
    return result;
};

export const eliminarPago = async (id) => {
    const db = await connectDB();
    const [result] = await db.execute('DELETE FROM pagos WHERE id = ?', [id]);
    return result;
};
