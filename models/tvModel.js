import connectDB from "../config/db.js";

/** =========================
 *  HELPERS FECHAS
 *  ========================= */
export const formatFechaParaMySQL = (fecha) => {
  if (!fecha) return null;
  try {
    const dateObj = new Date(fecha);
    if (isNaN(dateObj.getTime())) {
      return new Date().toISOString().split("T")[0];
    }
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - offset * 60000);
    return localDate.toISOString().split("T")[0];
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return new Date().toISOString().split("T")[0];
  }
};

const getMesAnioActual = () => {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
};

const generarMesesEntreFechas = (fechaInicio, fechaFin) => {
  const meses = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return meses;

  inicio.setDate(1);
  fin.setDate(1);

  let current = new Date(inicio);
  while (current <= fin) {
    meses.push({ mes: current.getMonth() + 1, anio: current.getFullYear() });
    current.setMonth(current.getMonth() + 1);
  }
  return meses;
};

/** =========================
 *  PLANES TV (planestv)
 *  ========================= */
export const obtenerPlanesTV = async () => {
  const conn = await connectDB();
  const [rows] = await conn.query(`SELECT * FROM planestv ORDER BY id DESC`);
  return rows;
};

export const obtenerPlanTVPorId = async (id) => {
  const conn = await connectDB();
  const [rows] = await conn.query(`SELECT * FROM planestv WHERE id = ?`, [id]);
  return rows[0] || null;
};

export const crearPlanTV = async ({ nombre, precio_mensual, descripcion }) => {
  if (!nombre || precio_mensual == null) {
    throw new Error("nombre y precio_mensual son requeridos");
  }
  const conn = await connectDB();
  const [res] = await conn.query(
    `INSERT INTO planestv (nombre, precio_mensual, descripcion) VALUES (?, ?, ?)`,
    [nombre, precio_mensual, descripcion || null]
  );
  return res.insertId;
};

export const actualizarPlanTV = async (id, { nombre, precio_mensual, descripcion }) => {
  const conn = await connectDB();
  const [res] = await conn.query(
    `UPDATE planestv SET nombre = ?, precio_mensual = ?, descripcion = ? WHERE id = ?`,
    [nombre, precio_mensual, descripcion || null, id]
  );
  return res.affectedRows > 0;
};

export const eliminarPlanTV = async (id) => {
  const conn = await connectDB();
  const [res] = await conn.query(`DELETE FROM planestv WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

/** ==============================
 *  ESTADOS CLIENTES (estadosClientes)
 *  ============================== */
export const obtenerEstadosClientesTV = async () => {
  const conn = await connectDB();
  const [rows] = await conn.query(`SELECT * FROM estadosClientes ORDER BY id ASC`);
  return rows;
};

export const obtenerEstadoClienteTVPorId = async (id) => {
  const conn = await connectDB();
  const [rows] = await conn.query(`SELECT * FROM estadosClientes WHERE id = ?`, [id]);
  return rows[0] || null;
};

export const crearEstadoClienteTV = async ({ descripcion }) => {
  if (!descripcion) throw new Error("descripcion es requerida");
  const conn = await connectDB();
  const [res] = await conn.query(
    `INSERT INTO estadosClientes (descripcion) VALUES (?)`,
    [descripcion]
  );
  return res.insertId;
};

export const actualizarEstadoClienteTV = async (id, { descripcion }) => {
  const conn = await connectDB();
  const [res] = await conn.query(
    `UPDATE estadosClientes SET descripcion = ? WHERE id = ?`,
    [descripcion, id]
  );
  return res.affectedRows > 0;
};

export const eliminarEstadoClienteTV = async (id) => {
  const conn = await connectDB();
  const [res] = await conn.query(`DELETE FROM estadosClientes WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

/** =========================
 *  CLIENTES TV (clientestv)
 *  ========================= */

/**
 * GET /api/tv/clientes
 * Soporta filtros por ?estado_id, ?plantv_id, ?search
 * Devuelve plan y estado legibles + total_dispositivos
 */
export const obtenerClientesTV = async ({ estado_id, plantv_id, search } = {}) => {
  const conn = await connectDB();

  let where = `WHERE 1=1`;
  const params = [];

  if (estado_id) {
    where += ` AND c.estado_id = ?`;
    params.push(estado_id);
  }
  if (plantv_id) {
    where += ` AND c.plantv_id = ?`;
    params.push(plantv_id);
  }
  if (search) {
    where += ` AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.direccion LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [rows] = await conn.query(
    `
    SELECT 
      c.*,
      p.nombre AS plan_nombre,
      p.precio_mensual AS plan_precio_mensual,
      e.descripcion AS estado_descripcion,
      (SELECT COUNT(1) FROM dispositivos_tv d WHERE d.cliente_id = c.id) AS total_dispositivos
    FROM clientestv c
    INNER JOIN planestv p ON p.id = c.plantv_id
    INNER JOIN estadosClientes e ON e.id = c.estado_id
    ${where}
    ORDER BY c.id DESC
    `,
    params
  );

  return rows;
};

/**
 * GET /api/tv/clientes/:id
 */
export const obtenerClienteTVPorId = async (id) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `
    SELECT 
      c.*,
      p.nombre AS plan_nombre,
      p.precio_mensual AS plan_precio_mensual,
      e.descripcion AS estado_descripcion
    FROM clientestv c
    INNER JOIN planestv p ON p.id = c.plantv_id
    INNER JOIN estadosClientes e ON e.id = c.estado_id
    WHERE c.id = ?
    `,
    [id]
  );
  return rows[0] || null;
};

/**
 * POST /api/tv/clientes
 * Inserta cliente (estado por default = 1 Activo si no viene)
 * Crea estados mensuales del año actual en `estado_mensual_tv`:
 *  - 'Pagado' desde ENERO hasta mes(fecha_registro)
 *  - 'Pendiente' del resto del año
 */
export const crearClienteTV = async ({ nombre, direccion, telefono, plantv_id, estado_id }) => {
  if (!nombre || !plantv_id) {
    throw new Error("nombre y plantv_id son requeridos");
  }

  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Insertar cliente
    const [res] = await conn.query(
      `
      INSERT INTO clientestv (nombre, direccion, telefono, plantv_id, estado_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [nombre, direccion || null, telefono || null, plantv_id, estado_id || 1]
    );

    const clienteId = res.insertId;

    // 2) Obtener fecha_registro del cliente recién insertado
    const [filaFecha] = await conn.query(
      `SELECT fecha_registro FROM clientestv WHERE id = ?`,
      [clienteId]
    );
    const fechaRegistro = filaFecha?.[0]?.fecha_registro || new Date();

    // 3) Generar estados del año actual
    const ahora = new Date();
    const añoActual = ahora.getFullYear();
    const mesRegistro =
      (fechaRegistro instanceof Date ? fechaRegistro : new Date(fechaRegistro)).getMonth() + 1;

    const todosLosMeses = Array.from({ length: 12 }, (_, i) => i + 1);
    const mesesPagados = todosLosMeses.filter((m) => m <= mesRegistro);

    const values = [];
    const placeholders = [];

    todosLosMeses.forEach((mes) => {
      const estado = mesesPagados.includes(mes) ? "Pagado" : "Pendiente";
      values.push(clienteId, mes, añoActual, estado);
      placeholders.push("(?, ?, ?, ?)");
    });

    if (values.length > 0) {
      await conn.query(
        `
        INSERT INTO estado_mensual_tv (cliente_id, mes, anio, estado)
        VALUES ${placeholders.join(", ")}
        ON DUPLICATE KEY UPDATE estado = VALUES(estado)
        `,
        values
      );
    }

    await conn.commit();
    return clienteId;
  } catch (err) {
    await conn.rollback();
    console.error("Error al crear cliente TV:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * PUT /api/tv/clientes/:id
 * Actualización dinámica: solo campos presentes.
 */
export const actualizarClienteTV = async (
  id,
  { nombre, direccion, telefono, plantv_id, estado_id }
) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    const fields = [];
    const params = [];

    if (typeof nombre !== "undefined") {
      fields.push("nombre = ?");
      params.push(nombre);
    }
    if (typeof direccion !== "undefined") {
      fields.push("direccion = ?");
      params.push(direccion || null);
    }
    if (typeof telefono !== "undefined") {
      fields.push("telefono = ?");
      params.push(telefono || null);
    }
    if (typeof plantv_id !== "undefined") {
      fields.push("plantv_id = ?");
      params.push(plantv_id);
    }
    if (typeof estado_id !== "undefined") {
      fields.push("estado_id = ?");
      params.push(estado_id);
    }

    if (fields.length === 0) {
      // nada que actualizar
      return false;
    }

    params.push(id);

    const [res] = await conn.query(
      `
      UPDATE clientestv
         SET ${fields.join(", ")}
       WHERE id = ?
      `,
      params
    );

    return res.affectedRows > 0;
  } catch (err) {
    console.error("Error al actualizar cliente TV:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/tv/clientes/:id
 * Borra primero estado_mensual_tv, luego el cliente.
 * (Los dispositivos se eliminan por ON DELETE CASCADE en dispositivos_tv)
 */
export const eliminarClienteTV = async (id) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM estado_mensual_tv WHERE cliente_id = ?`, [id]);
    const [res] = await conn.query(`DELETE FROM clientestv WHERE id = ?`, [id]);

    await conn.commit();
    return res.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    console.error("Error al eliminar cliente TV:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * MIGRACIÓN (ejecutar una sola vez):
 * Crea estados en estado_mensual_tv para clientes existentes,
 * generando meses desde fecha_registro hasta hoy como 'Pendiente'
 * si aún no existen.
 */
export const migrarClientesExistentesTV = async () => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Traer todos los clientes con su fecha_registro
    const [clientes] = await conn.query(
      `SELECT id, fecha_registro FROM clientestv`
    );

    for (const c of clientes) {
      const fechaInicio = new Date(c.fecha_registro);
      const fechaActual = new Date();
      const meses = generarMesesEntreFechas(fechaInicio, fechaActual);

      if (meses.length > 0) {
        const placeholders = meses.map(() => "(?, ?, ?, ?)").join(", ");
        const values = meses.flatMap(({ mes, anio }) => [c.id, mes, anio, "Pendiente"]);

        // INSERT IGNORE para no duplicar combinaciones (cliente_id, mes, anio)
        await conn.query(
          `
          INSERT IGNORE INTO estado_mensual_tv (cliente_id, mes, anio, estado)
          VALUES ${placeholders}
          `,
          values
        );
      }
    }

    await conn.commit();
    return { clientesProcesados: clientes.length };
  } catch (err) {
    await conn.rollback();
    console.error("Error en migrarClientesExistentesTV:", err);
    throw err;
  } finally {
    conn.release();
  }
};

/** =================================
 *  DISPOSITIVOS TV (dispositivos_tv)
 *  ================================= */
export const obtenerDispositivosPorCliente = async (cliente_id) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `SELECT * FROM dispositivos_tv WHERE cliente_id = ? ORDER BY id DESC`,
    [cliente_id]
  );
  return rows;
};

export const obtenerDispositivoTVPorId = async (id) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `SELECT * FROM dispositivos_tv WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
};

export const crearDispositivoTV = async ({ cliente_id, descripcion, mac_address }) => {
  if (!cliente_id) throw new Error("cliente_id es requerido");
  const conn = await connectDB();
  const [res] = await conn.query(
    `
    INSERT INTO dispositivos_tv (cliente_id, descripcion, mac_address)
    VALUES (?, ?, ?)
    `,
    [cliente_id, descripcion || null, mac_address || null]
  );
  return res.insertId;
};

export const actualizarDispositivoTV = async (id, { descripcion, mac_address }) => {
  const conn = await connectDB();
  const [res] = await conn.query(
    `
    UPDATE dispositivos_tv
       SET descripcion = ?, mac_address = ?
     WHERE id = ?
    `,
    [descripcion || null, mac_address || null, id]
  );
  return res.affectedRows > 0;
};

export const eliminarDispositivoTV = async (id) => {
  const conn = await connectDB();
  const [res] = await conn.query(`DELETE FROM dispositivos_tv WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

/** Helper: buscar dispositivo por MAC (opcional) */
export const obtenerDispositivoPorMAC = async (mac_address) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `SELECT * FROM dispositivos_tv WHERE mac_address = ?`,
    [mac_address]
  );
  return rows[0] || null;
};
