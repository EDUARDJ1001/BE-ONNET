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
 * Inserta cliente con todos los nuevos campos, genera estados mensuales
 * y registra el pago inicial en pagostv.
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

  // ✅ Función CORREGIDA - Mantener la fecha exacta del input
  const toLocalDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return new Date(value);
    }

    if (typeof value === 'string') {
      // Si viene en formato YYYY-MM-DD, crear la fecha directamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      }

      // Para otros formatos, usar el parser de Date
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        throw new Error(`Fecha inválida: ${value}`);
      }
      return d;
    }

    throw new Error(`Tipo de fecha no soportado: ${typeof value}`);
  };

  // ✅ Formatea fecha a 'YYYY-MM-DD' SIN modificar la fecha
  const formatFechaCorregida = (fecha) => {
    if (!fecha) return null;
    const date = toLocalDate(fecha);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

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
        nombre,
        usuario,
        direccion || null,
        telefono || null,
        plantv_id,
        estado_id,
        formatFechaCorregida(fecha_inicio),
        formatFechaCorregida(fecha_expiracion),
        monto_cancelado,
        moneda,
        creditos_otorgados,
        notas || null
      ]
    );

    const clienteId = res.insertId;

    // 2) Registrar pago inicial en pagostv (si hay monto)
    if (monto_cancelado > 0) {
      const fechaPagoHoy = formatFechaCorregida(new Date());

      await conn.query(
        `
        INSERT INTO pagostv (clientetv_id, monto, fecha_pago, observacion)
        VALUES (?, ?, ?, ?)
        `,
        [
          clienteId,
          monto_cancelado,
          fechaPagoHoy,
          `Pago inicial al crear cliente (moneda: ${moneda})`
        ]
      );
    }

    // 3) Obtener información del plan
    const plan = await obtenerPlanTVPorId(plantv_id);
    const precioPlan = plan ? plan.precio : 0;

    // 4) Calcular meses pagados por adelantado (EXCLUSIVAMENTE adicionales)
    let mesesAdicionalesAdelantados = 0;
    if (precioPlan > 0 && monto_cancelado > precioPlan) {
      mesesAdicionalesAdelantados = Math.floor((monto_cancelado - precioPlan) / precioPlan);
    }

    // 5) Generar estados mensuales
    const fechaInicioDate = toLocalDate(fecha_inicio);
    const fechaFinOriginal = toLocalDate(fecha_expiracion);

    let fechaFinEstados = new Date(fechaFinOriginal);

    if (mesesAdicionalesAdelantados > 0) {
      fechaFinEstados.setMonth(fechaFinEstados.getMonth() + mesesAdicionalesAdelantados);
    }

    const añoActual = new Date().getFullYear();
    const fechaInicioGeneracion = new Date(añoActual, 0, 1); // 1 de Enero

    const meses = generarMesesEntreFechas(fechaInicioGeneracion, fechaFinEstados);

    if (meses.length > 0) {
      const placeholders = meses.map(() => "(?, ?, ?, ?)").join(", ");
      const values = meses.flatMap(({ mes, anio }) => {
        const fechaMes = new Date(anio, mes - 1, 1);
        const fechaFinMes = new Date(anio, mes, 0);
        const fechaInicioMes = new Date(
          fechaInicioDate.getFullYear(),
          fechaInicioDate.getMonth(),
          1
        );

        let estado = "Pendiente";

        if (fechaFinMes < fechaInicioMes) {
          estado = "Sin dato";
        } else if (fechaMes >= fechaInicioMes && fechaFinMes <= fechaFinOriginal) {
          estado = "Pagado";
        } else if (mesesAdicionalesAdelantados > 0) {
          const fechaFinOriginalMes = new Date(
            fechaFinOriginal.getFullYear(),
            fechaFinOriginal.getMonth(),
            1
          );
          const mesesDesdeFinOriginal =
            (fechaMes.getFullYear() - fechaFinOriginalMes.getFullYear()) * 12 +
            (fechaMes.getMonth() - fechaFinOriginalMes.getMonth());

          if (mesesDesdeFinOriginal > 0 && mesesDesdeFinOriginal <= mesesAdicionalesAdelantados) {
            estado = "Pagado";
          }
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

    if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('usuario')) {
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
      // ELIMINAR formatFechaParaMySQL() - usar la fecha directamente
      params.push(fecha_inicio);
    }
    if (typeof fecha_expiracion !== "undefined") {
      fields.push("fecha_expiracion = ?");
      // ELIMINAR formatFechaParaMySQL() - usar la fecha directamente
      params.push(fecha_expiracion);
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
