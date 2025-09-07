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

export const getPagosPorCliente = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const pagos = await PagoModel.obtenerPagosPorCliente(cliente_id);
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos por cliente:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getPagosPorMes = async (req, res) => {
  try {
    const { mes, anio } = req.params;
    const pagos = await PagoModel.obtenerPagosPorMes(parseInt(mes), parseInt(anio));
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos por mes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getResumenPagosCliente = async (req, res) => {
  try {
    const { cliente_id, mes, anio } = req.params;
    const resumen = await PagoModel.obtenerResumenPagosCliente(
      cliente_id, 
      parseInt(mes), 
      parseInt(anio)
    );
    res.json(resumen);
  } catch (error) {
    console.error('Error al obtener resumen de pagos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getMesesPendientes = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const mesesPendientes = await PagoModel.obtenerMesesPendientes(cliente_id);
    res.json(mesesPendientes);
  } catch (error) {
    console.error('Error al obtener meses pendientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPago = async (req, res) => {
  try {
    const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }

    if (monto <= 0) {
      return res.status(400).json({ 
        message: 'El monto debe ser mayor a 0.' 
      });
    }

    const pagoData = {
      cliente_id,
      monto: parseFloat(monto),
      fecha_pago,
      metodo_id,
      referencia: referencia || null,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado || null,
      anio_aplicado: anio_aplicado || null
    };

    const resultado = await PagoModel.crearPago(pagoData);
    res.status(201).json({ 
      message: 'Pago registrado exitosamente', 
      id: resultado.id,
      mes_aplicado: resultado.mes_aplicado,
      anio_aplicado: resultado.anio_aplicado
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    
    if (error.message === 'No se pueden registrar pagos para meses futuros') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPagosMultiples = async (req, res) => {
  try {
    const { cliente_id, monto_total, fecha_pago, metodo_id, referencia, observacion, meses } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto_total || !fecha_pago || !metodo_id || !meses || !Array.isArray(meses)) {
      return res.status(400).json({ 
        message: 'cliente_id, monto_total, fecha_pago, metodo_id y meses (array) son requeridos.' 
      });
    }

    if (monto_total <= 0) {
      return res.status(400).json({ 
        message: 'El monto total debe ser mayor a 0.' 
      });
    }

    if (meses.length === 0) {
      return res.status(400).json({ 
        message: 'Debe especificar al menos un mes para el pago.' 
      });
    }

    // Validar estructura de los meses
    for (const mes of meses) {
      if (!mes.mes || !mes.anio) {
        return res.status(400).json({ 
          message: 'Cada mes debe tener "mes" y "anio" definidos.' 
        });
      }
    }

    const pagosData = {
      cliente_id,
      monto_total: parseFloat(monto_total),
      fecha_pago,
      metodo_id,
      referencia: referencia || null,
      observacion: observacion || null,
      meses
    };

    const resultados = await PagoModel.crearPagosMultiplesMeses(pagosData);
    res.status(201).json({ 
      message: `Pagos registrados exitosamente para ${meses.length} meses`,
      pagos: resultados,
      total_meses: meses.length,
      monto_por_mes: monto_total / meses.length
    });
  } catch (error) {
    console.error('Error al registrar pagos múltiples:', error);
    
    if (error.message.includes('No se pueden registrar pagos para meses futuros')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updatePago = async (req, res) => {
  try {
    const { cliente_id, monto, fecha_pago, metodo_id, referencia, observacion, mes_aplicado, anio_aplicado } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }

    if (monto <= 0) {
      return res.status(400).json({ 
        message: 'El monto debe ser mayor a 0.' 
      });
    }

    const pagoData = {
      cliente_id,
      monto: parseFloat(monto),
      fecha_pago,
      metodo_id,
      referencia: referencia || null,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado || null,
      anio_aplicado: anio_aplicado || null
    };

    const resultado = await PagoModel.actualizarPago(req.params.id, pagoData);
    res.json({ 
      message: 'Pago actualizado exitosamente',
      mes_aplicado: resultado.mes_aplicado,
      anio_aplicado: resultado.anio_aplicado
    });
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    
    if (error.message === 'Pago no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message === 'No se pueden registrar pagos para meses futuros') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deletePago = async (req, res) => {
  try {
    await PagoModel.eliminarPago(req.params.id);
    res.json({ message: 'Pago eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar pago:', error);
    
    if (error.message === 'Pago no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error del servidor' });
  }
};
