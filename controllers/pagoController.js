import * as PagoModel from '../models/pagoModel.js';

export const getPagos = async (req, res) => {
  try {
    const pagos = await PagoModel.obtenerPagos();
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getMetodosPago = async (req, res) => {
  try {
    const metodos = await PagoModel.obtenerMetodosPago();
    res.json(metodos);
  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getPagoById = async (req, res) => {
  try {
    const pago = await PagoModel.obtenerPagoPorId(req.params.id);
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });
    res.json(pago);
  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPago = async (req, res) => {
  try {
    const { cliente_id, monto, fecha_pago, metodo_id } = req.body;
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }

    const nuevoId = await PagoModel.crearPago(req.body);
    res.status(201).json({ message: 'Pago registrado', id: nuevoId });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updatePago = async (req, res) => {
  try {
    const { cliente_id, monto, fecha_pago, metodo_id } = req.body;
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }

    await PagoModel.actualizarPago(req.params.id, req.body);
    res.json({ message: 'Pago actualizado' });
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deletePago = async (req, res) => {
  try {
    await PagoModel.eliminarPago(req.params.id);
    res.json({ message: 'Pago eliminado' });
  } catch (error) {
    console.error('Error al eliminar pago:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};
