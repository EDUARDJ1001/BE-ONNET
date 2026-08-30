import connectDB from '../config/db.js';

// Util: mes y año actuales
const getMesAnioActual = () => {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
};

// Función para generar todos los meses entre dos fechas
const generarMesesEntreFechas = (fechaInicio, fechaFin) => {
  const meses = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Asegurarnos de que las fechas sean válidas
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return meses;
  }

  // Establecer el día a 1 para comparar solo mes y año
  inicio.setDate(1);
  fin.setDate(1);

  let current = new Date(inicio);

  while (current <= fin) {
    meses.push({
      mes: current.getMonth() + 1,
      anio: current.getFullYear()
    });

    // Avanzar al siguiente mes
    current.setMonth(current.getMonth() + 1);
  }

  return meses;
};

export const obtenerClientes = async () => {
  const db = await connectDB();
  const [rows] = await db.execute(`
    SELECT 
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.vineta, c.pass_onu, c.coordenadas,
      c.plan_id, c.estado_id, c.dia_pago, c.fecha_instalacion,
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
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.vineta, c.pass_onu, c.coordenadas,
      c.plan_id, c.dia_pago, c.estado_id, c.fecha_instalacion,
      p.nombre AS plan_nombre, p.precio_mensual,
      ec.descripcion AS nombreEstado
    FROM clientes c
    JOIN planes p ON c.plan_id = p.id
    JOIN estadosClientes ec ON c.estado_id = ec.id
    WHERE c.id = ?
  `, [id]);
  return rows[0];
};

export const crearCliente = async (cliente) => { 
  const { nombre, ip, direccion, coordenadas, telefono, vineta, pass_onu, plan_id, dia_pago, fecha_instalacion } = cliente;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Validar y formatear fecha de instalación
    const fechaInstalacionFormateada = formatFechaParaMySQL(fecha_instalacion) || formatFechaParaMySQL(new Date());

    // 2) Convertir undefined a null para MySQL
    const coordenadasValue = coordenadas !== undefined ? coordenadas : null;
    const diaPagoValue = dia_pago !== undefined ? dia_pago : null;
    const vinetaValue = vineta !== undefined ? vineta : null;

    // 3) Insertar cliente con estado_id = 1 (Activo)
    const [resCliente] = await conn.execute(`
      INSERT INTO clientes (nombre, ip, direccion, coordenadas, telefono, vineta, pass_onu, plan_id, dia_pago, estado_id, fecha_instalacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      nombre,
      ip,
      direccion,
      coordenadasValue,
      telefono,
      vinetaValue,
      pass_onu,
      plan_id,
      diaPagoValue,
      fechaInstalacionFormateada
    ]);

    const clienteId = resCliente.insertId;

    // 4) Generar estados mensuales para todo el año actual
    //
    // Antes se marcaban como 'Pagado' TODOS los meses hasta el de instalación,
    // sin ningún registro en `pagos`: eso inventaba meses cobrados que nunca
    // se cobraron. Lo que sí corresponde es el mes de la instalación, porque
    // el servicio de instalación lo cubre.
    //
    // Reglas:
    //   antes de la instalación -> 'Sin servicio' (no era cliente todavía)
    //   mes de la instalación   -> 'Pagado'       (lo cubre la instalación)
    //   después                 -> 'Pendiente'    (lo define pagoModel al cobrar)
    //
    // El mes de instalación queda 'Pagado' sin un pago detrás, así que
    // recalcular_estado_mensual.sql lo excluye a propósito; si no, se lo
    // llevaría de vuelta a 'Pendiente' en cada corrida.
    //
    // La fecha viene como 'YYYY-MM-DD' y se parte por texto: new Date() sobre
    // ese formato corre el mes en zonas horarias negativas como la nuestra.
    const [añoInstalacion, mesInstalacion] = fechaInstalacionFormateada
      .split('-')
      .map(Number);
    const añoActual = new Date().getFullYear();

    // Año y mes en un solo número, para comparar de una sola vez.
    const inicioServicio = añoInstalacion * 12 + mesInstalacion;

    const values = [];
    const placeholders = [];

    for (let mes = 1; mes <= 12; mes++) {
      const periodo = añoActual * 12 + mes;
      const estado =
        periodo < inicioServicio ? 'Sin servicio'
        : periodo === inicioServicio ? 'Pagado'
        : 'Pendiente';
      values.push(clienteId, mes, añoActual, estado);
      placeholders.push('(?, ?, ?, ?)');
    }

    if (values.length > 0) {
      await conn.execute(`
        INSERT INTO estado_mensual (cliente_id, mes, anio, estado)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE estado = estado
      `, values);
    }

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
  const { nombre, ip, direccion, coordenadas, telefono, vineta, pass_onu, plan_id, estado_id, dia_pago, fecha_instalacion } = cliente;
  const db = await connectDB();

  // Construimos SQL dinámico para no obligar a enviar todos los campos siempre
  const fields = [
    'nombre = ?',
    'ip = ?',
    'direccion = ?',
    'coordenadas = ?',
    'telefono = ?',
    'vineta = ?',
    'pass_onu = ?',
    'plan_id = ?'
  ];

  const params = [
    nombre,
    ip,
    direccion,
    coordenadas || null,
    telefono,
    vineta !== undefined ? vineta : null,
    pass_onu,
    plan_id
  ];

  if (typeof estado_id !== 'undefined') {
    fields.push('estado_id = ?');
    params.push(estado_id);
  }

  if (typeof dia_pago !== 'undefined') {
    fields.push('dia_pago = ?');
    params.push(dia_pago || null);
  }

  if (fecha_instalacion) {
    fields.push('fecha_instalacion = ?');
    const fechaFormateada = formatFechaParaMySQL(fecha_instalacion);
    params.push(fechaFormateada);
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

// Función auxiliar para formatear fechas para MySQL
// Devuelve la fecha como 'YYYY-MM-DD', sin correrla de día.
//
// La versión anterior hacía `new Date(fecha)` y después restaba el offset de
// zona horaria. Con un texto 'YYYY-MM-DD' eso lo interpreta como medianoche
// UTC y al restarle 6 horas caía en el día anterior: '2026-08-01' se guardaba
// como '2026-07-31', y '2026-01-01' como '2025-12-31'. Como de esta fecha
// depende desde qué mes el cliente tiene servicio, corría un mes entero.
//
// Mismo criterio que normalizarFechaPagoYYYYMMDD en pagoModel: si el texto ya
// trae la fecha, se usa tal cual y no se construye ningún Date.
export const formatFechaParaMySQL = (fecha) => {
  if (!fecha) return null;

  try {
    if (typeof fecha === 'string') {
      // Ya viene 'YYYY-MM-DD' o un ISO completo 'YYYY-MM-DDTHH:mm:ss...'
      const soloFecha = fecha.match(/^(\d{4}-\d{2}-\d{2})/);
      if (soloFecha) return soloFecha[1];
    }

    // Un Date: se leen sus componentes locales, sin pasar por toISOString(),
    // que convierte a UTC y vuelve a correr el día.
    const dateObj = fecha instanceof Date ? fecha : new Date(fecha);
    const valido = !Number.isNaN(dateObj.getTime()) ? dateObj : new Date();

    const anio = valido.getFullYear();
    const mes = String(valido.getMonth() + 1).padStart(2, '0');
    const dia = String(valido.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  } catch (error) {
    console.error('Error formateando fecha:', error);
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }
};

// Función para migrar clientes existentes (ejecutar una sola vez)
export const migrarClientesExistentes = async () => {
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Obtener todos los clientes que no tienen fecha_instalacion
    const [clientes] = await conn.execute(`
      SELECT id, created_at FROM clientes 
      WHERE fecha_instalacion IS NULL
    `);

    // 2) Actualizar fecha_instalacion con created_at para clientes existentes
    for (const cliente of clientes) {
      await conn.execute(`
        UPDATE clientes 
        SET fecha_instalacion = ?
        WHERE id = ?
      `, [cliente.created_at, cliente.id]);
    }

    // 3) Obtener todos los clientes con sus fechas de instalación
    const [clientesCompletos] = await conn.execute(`
      SELECT id, fecha_instalacion FROM clientes
    `);

    // 4) Crear estados mensuales para cada cliente
    for (const cliente of clientesCompletos) {
      const fechaInicio = new Date(cliente.fecha_instalacion);
      const fechaActual = new Date();

      const meses = generarMesesEntreFechas(fechaInicio, fechaActual);

      if (meses.length > 0) {
        const placeholders = meses.map(() => '(?, ?, ?, ?)').join(', ');
        const values = meses.flatMap(({ mes, anio }) =>
          [cliente.id, mes, anio, 'Pendiente']
        );

        await conn.execute(`
          INSERT IGNORE INTO estado_mensual (cliente_id, mes, anio, estado)
          VALUES ${placeholders}
        `, values);
      }
    }

    await conn.commit();
    return { clientesMigrados: clientesCompletos.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const eliminarCliente = async (id) => {
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Eliminar estados mensuales primero
    await conn.execute('DELETE FROM estado_mensual WHERE cliente_id = ?', [id]);

    // 2) Eliminar cliente
    const [result] = await conn.execute('DELETE FROM clientes WHERE id = ?', [id]);

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
