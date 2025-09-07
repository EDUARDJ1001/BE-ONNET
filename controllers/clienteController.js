import * as ClienteModel from '../models/clienteModel.js';

export const getClientes = async (req, res) => {
  try {
    const clientes = await ClienteModel.obtenerClientes();
    res.json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getClienteById = async (req, res) => {
  try {
    const cliente = await ClienteModel.obtenerClientePorId(req.params.id);
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    console.error('Error al obtener cliente por id:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getClientesConEstados = async (req, res) => {
  try {
    const clientes = await ClienteModel.obtenerClientesConEstados();
    res.json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes con estados:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createCliente = async (req, res) => {
  try {
    const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, dia_pago, fecha_instalacion } = req.body;
    
    // Validaciones básicas
    if (!nombre || !ip || !direccion || !telefono || !pass_onu || !plan_id) {
      return res.status(400).json({ 
        message: 'nombre, ip, direccion, telefono, pass_onu y plan_id son requeridos.' 
      });
    }

    const clienteData = {
      nombre,
      ip,
      direccion,
      coordenadas: coordenadas || null,
      telefono,
      pass_onu,
      plan_id,
      dia_pago,
      fecha_instalacion: fecha_instalacion || new Date().toISOString().split('T')[0]
    };

    const nuevoId = await ClienteModel.crearCliente(clienteData);
    res.status(201).json({ 
      message: 'Cliente creado exitosamente', 
      id: nuevoId 
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El cliente ya existe' });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updateCliente = async (req, res) => {
  try {
    const { nombre, ip, direccion, coordenadas, telefono, pass_onu, plan_id, dia_pago, estado_id, fecha_instalacion } = req.body;
    
    // Validaciones básicas
    if (!nombre || !direccion || !telefono || !pass_onu || !plan_id) {
      return res.status(400).json({ 
        message: 'nombre, direccion, telefono, pass_onu y plan_id son requeridos.' 
      });
    }

    // Formatear fecha para MySQL (solo YYYY-MM-DD)
    const formatFecha = (fecha) => {
      if (!fecha) return undefined;
      if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return fecha; // Ya está en formato correcto
      }
      const date = new Date(fecha);
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString().split('T')[0];
    };

    const clienteData = {
      nombre,
      ip,
      direccion,
      coordenadas: coordenadas || null,
      telefono,
      pass_onu,
      plan_id,
      dia_pago,
      estado_id: estado_id || undefined,
      fecha_instalacion: formatFecha(fecha_instalacion) || undefined
    };

    await ClienteModel.actualizarCliente(req.params.id, clienteData);
    res.json({ message: 'Cliente actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    
    if (error.message === 'Cliente no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deleteCliente = async (req, res) => {
  try {
    await ClienteModel.eliminarCliente(req.params.id);
    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    
    if (error.message === 'Cliente no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getEstadosClientes = async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.execute('SELECT * FROM estadosClientes ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener estados de clientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Endpoint para migrar clientes existentes (ejecutar una sola vez)
export const migrarClientes = async (req, res) => {
  try {
    const resultado = await ClienteModel.migrarClientesExistentes();
    res.json({ 
      message: 'Migración completada exitosamente',
      clientesMigrados: resultado.clientesMigrados
    });
  } catch (error) {
    console.error('Error al migrar clientes:', error);
    res.status(500).json({ message: 'Error en la migración' });
  }
};
