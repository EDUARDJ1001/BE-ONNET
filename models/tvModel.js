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

export const crearEstadoClienteTV = async ({ nombre, descripcion }) => {
  if (!nombre) throw new Error("nombre es requerido");
  const conn = await connectDB();
  const [res] = await conn.query(
    `INSERT INTO estadosClientes (nombre, descripcion) VALUES (?, ?)`,
    [nombre, descripcion || null]
  );
  return res.insertId;
};

export const actualizarEstadoClienteTV = async (id, { nombre, descripcion }) => {
  const conn = await connectDB();
  const [res] = await conn.query(
    `UPDATE estadosClientes SET nombre = ?, descripcion = ? WHERE id = ?`,
    [nombre, descripcion || null, id]
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
    where += ` AND (c.nombre LIKE ? OR c.usuario LIKE ? OR c.telefono LIKE ? OR c.direccion LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [rows] = await conn.query(
    `
    SELECT 
      c.*,
      p.nombre AS plan_nombre,
      p.precio_mensual AS plan_precio_mensual,
      e.descripcion AS estado_nombre,
      e.descripcion AS estado_descripcion,
      (SELECT COUNT(1) FROM dispositivos_tv d WHERE d.cliente_id = c.id) AS total_dispositivos,
      DATEDIFF(c.fecha_expiracion, CURDATE()) AS dias_restantes,
      CASE 
        WHEN c.fecha_expiracion < CURDATE() THEN 'Expirado'
        WHEN DATEDIFF(c.fecha_expiracion, CURDATE()) <= 7 THEN 'Por Expirar'
        ELSE 'Vigente'
      END AS estado_vencimiento
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
      e.descripcion AS estado_nombre,
      e.descripcion AS estado_descripcion,
      (SELECT COUNT(1) FROM dispositivos_tv d WHERE d.cliente_id = c.id) AS total_dispositivos,
      DATEDIFF(c.fecha_expiracion, CURDATE()) AS dias_restantes
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
 * Inserta cliente con todos los nuevos campos y genera estados mensuales
 */
export const crearClienteTV = async (clienteData) => {
  const {
    nombre,
    usuario,
    direccion,
    telefono,
    plantv_id,
    estado_id = 1,
    fecha_inicio,
    fecha_expiracion,
    monto_cancelado = 0,
    moneda = 'HNL',
    creditos_otorgados = 0,
    notas
  } = clienteData;

  if (!nombre || !usuario || !plantv_id || !fecha_inicio || !fecha_expiracion) {
    throw new Error("nombre, usuario, plantv_id, fecha_inicio y fecha_expiracion son requeridos");
  }

  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Insertar cliente
    const [res] = await conn.query(
      `
      INSERT INTO clientestv (
        nombre, usuario, direccion, telefono, plantv_id, estado_id,
        fecha_inicio, fecha_expiracion, monto_cancelado, moneda,
        creditos_otorgados, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nombre, usuario, direccion || null, telefono || null, plantv_id, estado_id,
        formatFechaParaMySQL(fecha_inicio), formatFechaParaMySQL(fecha_expiracion),
        monto_cancelado, moneda, creditos_otorgados, notas || null
      ]
    );

    const clienteId = res.insertId;

    // 2) Obtener información del plan para calcular meses pagados
    const plan = await obtenerPlanTVPorId(plantv_id);
    const precioPlan = plan ? plan.precio : 0;

    // 3) Calcular cuántos meses está pagando por adelantado
    let mesesPagadosAdelantados = 0;
    if (precioPlan > 0 && monto_cancelado >= precioPlan) {
      mesesPagadosAdelantados = Math.floor(monto_cancelado / precioPlan);
    }

    // 4) Generar estados mensuales para el período completo + meses adelantados
    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fecha_expiracion);
    
    // Si pagó meses adelantados, extender la fecha fin para la generación de estados
    let fechaFinEstados = new Date(fechaFin);
    if (mesesPagadosAdelantados > 0) {
      fechaFinEstados.setMonth(fechaFinEstados.getMonth() + mesesPagadosAdelantados);
    }

    const meses = generarMesesEntreFechas(fechaInicio, fechaFinEstados);
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const añoActual = ahora.getFullYear();

    if (meses.length > 0) {
      const placeholders = meses.map(() => "(?, ?, ?, ?)").join(", ");
      const values = meses.flatMap(({ mes, anio }) => {
        // Determinar el estado de cada mes
        let estado = "Pendiente";
        
        // Calcular el número de mes relativo desde la fecha de inicio
        const fechaMes = new Date(anio, mes - 1, 1);
        const fechaInicioObj = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
        const diferenciaMeses = (fechaMes.getFullYear() - fechaInicioObj.getFullYear()) * 12 + 
                               (fechaMes.getMonth() - fechaInicioObj.getMonth());
        
        // Si el mes está dentro de los meses pagados, marcarlo como Pagado
        if (diferenciaMeses < mesesPagadosAdelantados) {
          estado = "Pagado";
        } 
        // Si el mes está en el pasado pero dentro del período original, marcarlo como Pagado
        else if (fechaMes < new Date(ahora.getFullYear(), ahora.getMonth(), 1) && 
                 fechaMes >= fechaInicioObj) {
          estado = "Pagado";
        }
        // Mes actual se marca según el pago
        else if (mes === mesActual && anio === añoActual) {
          estado = monto_cancelado >= precioPlan ? "Pagado" : "Pendiente";
        }
        
        return [clienteId, mes, anio, estado];
      });

      await conn.query(
        `
        INSERT INTO estado_mensual_tv (clientetv_id, mes, anio, estado)
        VALUES ${placeholders}
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
    
    // Manejar error de usuario duplicado
    if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('usuario')) {
      throw new Error("El nombre de usuario ya existe");
    }
    
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * PUT /api/tv/clientes/:id
 * Actualización dinámica: solo campos presentes.
 */
export const actualizarClienteTV = async (id, campos) => {
  const {
    nombre,
    usuario,
    direccion,
    telefono,
    plantv_id,
    estado_id,
    fecha_inicio,
    fecha_expiracion,
    monto_cancelado,
    moneda,
    creditos_otorgados,
    notas
  } = campos;

  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    const fields = [];
    const params = [];

    if (typeof nombre !== "undefined") {
      fields.push("nombre = ?");
      params.push(nombre);
    }
    if (typeof usuario !== "undefined") {
      fields.push("usuario = ?");
      params.push(usuario);
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
    if (typeof fecha_inicio !== "undefined") {
      fields.push("fecha_inicio = ?");
      params.push(formatFechaParaMySQL(fecha_inicio));
    }
    if (typeof fecha_expiracion !== "undefined") {
      fields.push("fecha_expiracion = ?");
      params.push(formatFechaParaMySQL(fecha_expiracion));
    }
    if (typeof monto_cancelado !== "undefined") {
      fields.push("monto_cancelado = ?");
      params.push(monto_cancelado);
    }
    if (typeof moneda !== "undefined") {
      fields.push("moneda = ?");
      params.push(moneda);
    }
    if (typeof creditos_otorgados !== "undefined") {
      fields.push("creditos_otorgados = ?");
      params.push(creditos_otorgados);
    }
    if (typeof notas !== "undefined") {
      fields.push("notas = ?");
      params.push(notas || null);
    }

    if (fields.length === 0) {
      return false;
    }

    params.push(id);

    const [res] = await conn.query(
      `UPDATE clientestv SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return res.affectedRows > 0;
  } catch (err) {
    console.error("Error al actualizar cliente TV:", err);
    
    if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('usuario')) {
      throw new Error("El nombre de usuario ya existe");
    }
    
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/tv/clientes/:id
 */
export const eliminarClienteTV = async (id) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM estado_mensual_tv WHERE clientetv_id = ?`, [id]);
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
 * GET /api/tv/clientes/usuario/:usuario
 * Buscar cliente por nombre de usuario
 */
export const obtenerClienteTVPorUsuario = async (usuario) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `
    SELECT 
      c.*,
      p.nombre AS plan_nombre,
      p.precio_mensual AS plan_precio_mensual,
      e.descripcion AS estado_nombre
    FROM clientestv c
    INNER JOIN planestv p ON p.id = c.plantv_id
    INNER JOIN estadosClientes e ON e.id = c.estado_id
    WHERE c.usuario = ?
    `,
    [usuario]
  );
  return rows[0] || null;
};

/**
 * GET /api/tv/clientes/vencimientos/proximos
 * Clientes que expiran en los próximos 7 días
 */
export const obtenerClientesProximosAVencer = async (dias = 7) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `
    SELECT 
      c.id,
      c.nombre,
      c.usuario,
      c.fecha_expiracion,
      p.nombre AS plan_nombre,
      DATEDIFF(c.fecha_expiracion, CURDATE()) AS dias_restantes
    FROM clientestv c
    INNER JOIN planestv p ON p.id = c.plantv_id
    WHERE c.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
    AND c.estado_id = 1  -- Solo clientes activos
    ORDER BY c.fecha_expiracion ASC
    `,
    [dias]
  );
  return rows;
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

/** Helper: buscar dispositivo por MAC */
export const obtenerDispositivoPorMAC = async (mac_address) => {
  const conn = await connectDB();
  const [rows] = await conn.query(
    `SELECT * FROM dispositivos_tv WHERE mac_address = ?`,
    [mac_address]
  );
  return rows[0] || null;
};
