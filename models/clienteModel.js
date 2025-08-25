import connectDB from '../config/db.js';

// Util: mes y año actuales
const getMesAnioActual = () => {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
};

export const obtenerClientes = async () => {
  const db = await connectDB();
  // Trae info base del cliente + nombre del estado y plan (útil para listados)
  const [rows] = await db.execute(`
    SELECT 
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.pass_onu, c.coordenadas,
      c.plan_id, c.estado_id,
      p.nombre AS plan_nombre, p.precio_mensual,
      ec.descripcion AS nombreEstado
    FROM clientes c
    JOIN planes p ON c.plan_id = p.id
    JOIN estadosClientes ec ON c.estado_id = ec.id
    ORDER BY c.id DESC
  `);
  return rows;
};

export const obtenerClientePorId = async (id) => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT 
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.pass_onu, c.coordenadas,
      c.plan_id, c.estado_id,
      p.nombre AS plan_nombre, p.precio_mensual,
      ec.descripcion AS nombreEstado
    FROM clientes c
    JOIN planes p ON c.plan_id = p.id
    JOIN estadosClientes ec ON c.estado_id = ec.id
    WHERE c.id = ?
  `, [id]);
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
      c.pass_onu,
      c.coordenadas,
      c.plan_id,
      c.estado_id,
      ec.descripcion AS nombreEstado,
      em.mes,
      em.anio,
      em.estado
    FROM clientes c
    LEFT JOIN estado_mensual em ON c.id = em.cliente_id
    JOIN estadosClientes ec ON c.estado_id = ec.id
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
        pass_onu: row.pass_onu,
        coordenadas: row.coordenadas,
        plan_id: row.plan_id,
        estado_id: row.estado_id,
        nombreEstado: row.nombreEstado,
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

// Crear cliente con estado_id = 1 (Activo) y crear estado_mensual del mes actual (idempotente)
export const crearCliente = async (cliente) => { 
  const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id } = cliente;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Insert cliente con estado_id = 1
    const [resCliente] = await conn.execute(`
      INSERT INTO clientes (nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, estado_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id]);

    const clienteId = resCliente.insertId;

    // 2) Crear estado_mensual del mes actual (idempotente)
    const { mes, anio } = getMesAnioActual();
    await conn.execute(`
      INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
      VALUES (?, ?, ?, 'Pendiente')
      ON DUPLICATE KEY UPDATE estado = estado
    `, [clienteId, mes, anio]);

    await conn.commit();
    return clienteId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Actualizar cliente (si viene estado_id lo actualiza; si no, lo deja igual)
export const actualizarCliente = async (id, cliente) => {
  const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, estado_id } = cliente;
  const db = await connectDB();

  // Construimos SQL dinámico para no obligar a enviar estado_id siempre
  const fields = ['nombre = ?', 'ip = ?', 'direccion = ?', 'coordenadas = ?', 'telefono = ?', 'pass_onu = ?', 'plan_id = ?'];
  const params = [nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id];

  if (typeof estado_id !== 'undefined') {
    fields.push('estado_id = ?');
    params.push(estado_id);
  }

  params.push(id);

  const sql = `
    UPDATE clientes 
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  const [result] = await db.execute(sql, params);
  return result;
};

export const eliminarCliente = async (id) => {
  const db = await connectDB();
  const [result] = await db.execute('DELETE FROM clientes WHERE id = ?', [id]);
  return result;
};
