import * as PagoModel from '../models/pagoModel.js';

export const getPagos = async (_req, res) => {
  try {
    const pagos = await PagoModel.obtenerPagos();
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getMetodosPago = async (_req, res) => {
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
    const pagos = await PagoModel.obtenerPagosPorCliente(parseInt(cliente_id));
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
      parseInt(cliente_id), 
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
    const mesesPendientes = await PagoModel.obtenerMesesPendientes(parseInt(cliente_id));
    res.json(mesesPendientes);
  } catch (error) {
    console.error('Error al obtener meses pendientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPago = async (req, res) => {
  try {
    const { 
      cliente_id, monto, fecha_pago, metodo_id, 
      referencia, observacion, mes_aplicado, anio_aplicado 
    } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
    }

    const pagoData = {
      cliente_id: parseInt(cliente_id),
      monto: parseFloat(monto),
      fecha_pago,
      metodo_id: parseInt(metodo_id),
      referencia: referencia || null,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado ? parseInt(mes_aplicado) : null,
      anio_aplicado: anio_aplicado ? parseInt(anio_aplicado) : null
    };

    const resultado = await PagoModel.crearPago(pagoData);

    // Aviso de posible reasignación por política (mes/anio finales ≠ solicitados)
    let nota = null;
    if (pagoData.mes_aplicado && pagoData.anio_aplicado) {
      if (resultado.mes_aplicado !== pagoData.mes_aplicado || resultado.anio_aplicado !== pagoData.anio_aplicado) {
        nota = 'El pago fue reasignado automáticamente al último mes pendiente no suspendido.';
      }
    } else {
      // Si no vino mes/anio, podría haberse redirigido por suspensión del cliente/mes
      nota = 'Si existían meses suspendidos, el pago se aplicó al último mes pendiente no suspendido.';
    }

    res.status(201).json({ 
      message: 'Pago registrado exitosamente', 
      id: resultado.id,
      aplicado_a: {
        mes: resultado.mes_aplicado,
        anio: resultado.anio_aplicado
      },
      nota
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);

    // Errores de negocio específicos del model
    const mensajes400 = [
      'No se pueden registrar pagos para meses futuros',
      'El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago',
      'No hay meses pendientes no suspendidos para aplicar el pago'
    ];
    if (mensajes400.includes(error.message)) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPagosMultiples = async (req, res) => {
  try {
    const { 
      cliente_id, monto_total, fecha_pago, metodo_id, 
      referencia, observacion, meses 
    } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto_total || !fecha_pago || !metodo_id || !meses || !Array.isArray(meses)) {
      return res.status(400).json({ 
        message: 'cliente_id, monto_total, fecha_pago, metodo_id y meses (array) son requeridos.' 
      });
    }
    if (Number(monto_total) <= 0) {
      return res.status(400).json({ message: 'El monto total debe ser mayor a 0.' });
    }
    if (meses.length === 0) {
      return res.status(400).json({ message: 'Debe especificar al menos un mes para el pago.' });
    }
    for (const m of meses) {
      if (!m?.mes || !m?.anio) {
        return res.status(400).json({ message: 'Cada mes debe tener "mes" y "anio" definidos.' });
      }
    }

    const pagosData = {
      cliente_id: parseInt(cliente_id),
      monto_total: parseFloat(monto_total),
      fecha_pago,
      metodo_id: parseInt(metodo_id),
      referencia: referencia || null,
      observacion: observacion || null,
      meses: meses.map(m => ({ mes: parseInt(m.mes), anio: parseInt(m.anio) }))
    };

    const solicitados = pagosData.meses.length;
    const resultados = await PagoModel.crearPagosMultiplesMeses(pagosData); // ahora permite futuros
    const aplicados = resultados.length;
    const omitidos = solicitados - aplicados;

    res.status(201).json({
      message: `Pagos registrados exitosamente.`,
      totales: { solicitados, aplicados, omitidos },
      motivo_omision_posible: 'Meses con estado Suspendido fueron omitidos según la política.',
      pagos: resultados, // [{id, mes_aplicado, anio_aplicado, monto}]
      monto_por_mes: resultados.map(r => r.monto),
      meses_aplicados: resultados.map(r => ({ mes: r.mes_aplicado, anio: r.anio_aplicado }))
    });
  } catch (error) {
    console.error('Error al registrar pagos múltiples:', error);

    // Mensajes específicos del model para 400
    const es400 =
      error.message === 'Debe especificar al menos un mes para el pago.' ||
      error.message?.startsWith('Mes/Año inválidos:') ||
      error.message === 'Los meses seleccionados están suspendidos. No hay meses disponibles para aplicar el pago.';

    if (es400) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error del servidor' });
  }
};


export const updatePago = async (req, res) => {
  try {
    const { 
      cliente_id, monto, fecha_pago, metodo_id, 
      referencia, observacion, mes_aplicado, anio_aplicado 
    } = req.body;
    
    // Validaciones básicas
    if (!cliente_id || !monto || !fecha_pago || !metodo_id) {
      return res.status(400).json({ 
        message: 'cliente_id, monto, fecha_pago y metodo_id son requeridos.' 
      });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
    }

    const pagoData = {
      cliente_id: parseInt(cliente_id),
      monto: parseFloat(monto),
      fecha_pago,
      metodo_id: parseInt(metodo_id),
      referencia: referencia || null,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado ? parseInt(mes_aplicado) : null,
      anio_aplicado: anio_aplicado ? parseInt(anio_aplicado) : null
    };

    const resultado = await PagoModel.actualizarPago(req.params.id, pagoData);

    let nota = null;
    if (pagoData.mes_aplicado && pagoData.anio_aplicado) {
      if (resultado.mes_aplicado !== pagoData.mes_aplicado || resultado.anio_aplicado !== pagoData.anio_aplicado) {
        nota = 'El pago fue reasignado automáticamente al último mes pendiente no suspendido.';
      }
    } else {
      nota = 'Si existían meses suspendidos, el pago se aplicó al último mes pendiente no suspendido.';
    }

    res.json({ 
      message: 'Pago actualizado exitosamente',
      aplicado_a: {
        mes: resultado.mes_aplicado,
        anio: resultado.anio_aplicado
      },
      nota
    });
  } catch (error) {
    console.error('Error al actualizar pago:', error);

    if (error.message === 'Pago no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    const mensajes400 = [
      'No se pueden registrar pagos para meses futuros',
      'El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago',
      'No hay meses pendientes no suspendidos para aplicar el pago'
    ];
    if (mensajes400.includes(error.message)) {
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
