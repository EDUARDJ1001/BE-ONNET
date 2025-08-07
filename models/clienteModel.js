import connectDB from '../config/db.js';

export const obtenerClientes = async () => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM clientes');
    return rows;
};

export const obtenerClientePorId = async (id) => {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM clientes WHERE id = ?', [id]);
    return rows[0];
};

export const obtenerClientesConEstados = async () => {
    const db = await connectDB();

    const [rows] = await db.execute(`
        SELECT 
            c.id AS cliente_id,
            c.nombre,
            c.ip,
            c.direccion,
            c.telefono,
            c.coordenadas,
            c.plan_id,
            em.mes,
            em.anio,
            em.estado
        FROM clientes c
        LEFT JOIN estado_mensual em ON c.id = em.cliente_id
        ORDER BY c.id, em.anio DESC, em.mes DESC
    `);

    // Agrupar por cliente
    const clientes = {};
    for (const row of rows) {
        const id = row.cliente_id;

        if (!clientes[id]) {
            clientes[id] = {
                id: id,
                nombre: row.nombre,
                ip: row.ip,
                direccion: row.direccion,
                telefono: row.telefono,
                coordenadas: row.coordenadas,
                plan_id: row.plan_id,
                estados: []
            };
        }

        if (row.mes && row.anio) {
            clientes[id].estados.push({
                mes: row.mes,
                anio: row.anio,
                estado: row.estado
            });
        }
    }

    return Object.values(clientes);
};

export const crearCliente = async (cliente) => {
    const { nombre, ip, direccion, coordenadas, telefono, plan_id } = cliente;
    const db = await connectDB();
    const query = `
        INSERT INTO clientes (nombre, ip, direccion, coordenadas, telefono, plan_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [nombre, ip, direccion, coordenadas, telefono, plan_id]);
    return result.insertId;
};

export const actualizarCliente = async (id, cliente) => {
    const { nombre, ip, direccion, coordenadas, telefono, plan_id } = cliente;
    const db = await connectDB();
    const query = `
        UPDATE clientes SET nombre = ?, ip = ?, direccion = ?, coordenadas = ?, telefono = ?, plan_id = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [nombre, ip, direccion, coordenadas, telefono, plan_id, id]);
    return result;
};

export const eliminarCliente = async (id) => {
    const db = await connectDB();
    const [result] = await db.execute('DELETE FROM clientes WHERE id = ?', [id]);
    return result;
};
