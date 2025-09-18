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
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.pass_onu, c.coordenadas,
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
      c.id, c.nombre, c.ip, c.direccion, c.telefono, c.pass_onu, c.coordenadas,
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
  const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, dia_pago, fecha_instalacion } = cliente;
  const db = await connectDB();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Validar y formatear fecha de instalación
    const fechaInstalacionFormateada = formatFechaParaMySQL(fecha_instalacion) || formatFechaParaMySQL(new Date());
    
    // 2) Convertir undefined a null para MySQL
    const coordenadasValue = coordenadas !== undefined ? coordenadas : null;
    const diaPagoValue = dia_pago !== undefined ? dia_pago : null;
    
    // 3) Insertar cliente con estado_id = 1 (Activo)
    const [resCliente] = await conn.execute(`
      INSERT INTO clientes (nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, dia_pago, estado_id, fecha_instalacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      nombre, 
      ip, 
      direccion, 
      coordenadasValue,
      telefono, 
      pass_onu, 
      plan_id, 
      diaPagoValue,
      fechaInstalacionFormateada
    ]);

    const clienteId = resCliente.insertId;

    // 4) Generar estados mensuales para todo el año actual
    const fechaInstalacion = new Date(fechaInstalacionFormateada);
    const ahora = new Date();
    const añoActual = ahora.getFullYear();
    const mesActual = ahora.getMonth() + 1; // Mes actual (1-12)
    
    // Generar todos los meses del año actual (1 al 12)
    const todosLosMeses = Array.from({ length: 12 }, (_, i) => i + 1);
    
    // Determinar qué meses deben estar como "Pagado"
    const mesInstalacion = fechaInstalacion.getMonth() + 1; // Mes de instalación (1-12)
    const añoInstalacion = fechaInstalacion.getFullYear();
    
    let mesesPagados = [];
    
    if (añoInstalacion === añoActual) {
      // Todos los meses desde ENERO hasta el mes de instalación (incluyendo)
      mesesPagados = todosLosMeses.filter(mes => mes <= mesInstalacion);
    } else if (añoInstalacion < añoActual) {
      // Si la instalación fue en año anterior: todos los meses son "Pagado"
      mesesPagados = todosLosMeses;
    }
    // Si la instalación es futura (año > actual), mesesPagados queda vacío

    // Preparar los valores para la inserción
    const values = [];
    const placeholders = [];
    
    todosLosMeses.forEach(mes => {
      const estado = mesesPagados.includes(mes) ? 'Pagado' : 'Pendiente';
      values.push(clienteId, mes, añoActual, estado);
      placeholders.push('(?, ?, ?, ?)');
    });

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
  const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, estado_id, dia_pago, fecha_instalacion } = cliente;
  const db = await connectDB();

  // Construimos SQL dinámico para no obligar a enviar todos los campos siempre
  const fields = ['nombre = ?', 'ip = ?', 'direccion = ?', 'coordenadas = ?', 'telefono = ?', 'pass_onu = ?', 'plan_id = ?'];
  const params = [nombre, ip, direccion, coordenadas || null, telefono, pass_onu, plan_id];

  if (typeof estado_id !== 'undefined') {
    fields.push('estado_id = ?');
    params.push(estado_id);
  }

  if (typeof dia_pago !== 'undefined') {
    fields.push('dia_pago = ?');
    params.push(dia_pago || null); // Convertir a null si es undefined
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
export const formatFechaParaMySQL = (fecha) => {
  if (!fecha) return null;
  
  try {
    const dateObj = new Date(fecha);
    
    // Si la fecha es inválida
    if (isNaN(dateObj.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    // Compensar el timezone offset para mantener la fecha local
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
    
    return localDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return new Date().toISOString().split('T')[0];
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
