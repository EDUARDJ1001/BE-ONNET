// src/controllers/pagoTvController.js
import * as PagoTvModel from '../models/pagoTvModel.js';

export const getPagosTv = async (_req, res) => {
  try {
    const pagos = await PagoTvModel.obtenerPagosTv();
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos Tv:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getPagoTvById = async (req, res) => {
  try {
    const pago = await PagoTvModel.obtenerPagoTvPorId(req.params.id);
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });
    res.json(pago);
  } catch (error) {
    console.error('Error al obtener pago Tv:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getPagosPorClienteTv = async (req, res) => {
  try {
    const { clienteTv_id } = req.params;
    const pagos = await PagoTvModel.obtenerPagosPorClienteTv(parseInt(clienteTv_id));
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos por cliente Tv:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getPagosTvPorMes = async (req, res) => {
  try {
    const { mes, anio } = req.params;
    const pagos = await PagoTvModel.obtenerPagosTvPorMes(parseInt(mes), parseInt(anio));
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos Tv por mes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getResumenPagosClienteTv = async (req, res) => {
  try {
    const { clienteTv_id, mes, anio } = req.params;
    const resumen = await PagoTvModel.obtenerResumenPagosClienteTv(
      parseInt(clienteTv_id), 
      parseInt(mes), 
      parseInt(anio)
    );
    res.json(resumen);
  } catch (error) {
    console.error('Error al obtener resumen de pagos Tv:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getMesesPendientesTv = async (req, res) => {
  try {
    const { clienteTv_id } = req.params;
    const mesesPendientes = await PagoTvModel.obtenerMesesPendientesTv(parseInt(clienteTv_id));
    res.json(mesesPendientes);
  } catch (error) {
    console.error('Error al obtener meses pendientes Tv:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPagoTv = async (req, res) => {
  try {
    const { 
      clienteTv_id, 
      monto, 
      fecha_pago, 
      observacion, 
      mes_aplicado, 
      anio_aplicado 
    } = req.body;
    
    // Validaciones básicas
    if (!clienteTv_id || !monto || !fecha_pago) {
      return res.status(400).json({ 
        message: 'clienteTv_id, monto y fecha_pago son requeridos.' 
      });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
    }

    // Normalizar nombre para el model
    const pagoData = {
      clientetv_id: parseInt(clienteTv_id),
      monto: parseFloat(monto),
      fecha_pago,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado ? parseInt(mes_aplicado) : null,
      anio_aplicado: anio_aplicado ? parseInt(anio_aplicado) : null
    };

    const resultado = await PagoTvModel.crearPagoTv(pagoData);

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
      message: 'Pago Tv registrado exitosamente', 
      id: resultado.id,
      aplicado_a: {
        mes: resultado.mes_aplicado,
        anio: resultado.anio_aplicado
      },
      nota
    });
  } catch (error) {
    console.error('Error al registrar pago Tv:', error);

    // Errores de negocio específicos del model
    const mensajes400 = [
      'no existe',
      'No se pueden registrar pagos para meses futuros',
      'El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago',
      'No hay meses pendientes no suspendidos para aplicar el pago',
      'Mes/año aplicado inválido o fuera de rango permitido',
      'sin plan asociado'
    ];
    
    if (mensajes400.some(msg => error.message.includes(msg))) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createPagosMultiplesTv = async (req, res) => {
  try {
    const { 
      clienteTv_id, 
      monto_total, 
      fecha_pago, 
      observacion, 
      meses 
    } = req.body;
    
    // Validaciones básicas
    if (!clienteTv_id || !monto_total || !fecha_pago || !meses || !Array.isArray(meses)) {
      return res.status(400).json({ 
        message: 'clienteTv_id, monto_total, fecha_pago y meses (array) son requeridos.' 
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

    // Normalizar nombre para el model
    const pagosData = {
      clienteTv_id: parseInt(clienteTv_id),
      monto_total: parseFloat(monto_total),
      fecha_pago,
      observacion: observacion || null,
      meses: meses.map(m => ({ mes: parseInt(m.mes), anio: parseInt(m.anio) }))
    };

    const solicitados = pagosData.meses.length;
    const resultados = await PagoTvModel.crearPagosMultiplesMesesTv(pagosData);
    const aplicados = resultados.length;
    const omitidos = solicitados - aplicados;

    const response = {
      message: `Pagos Tv registrados exitosamente.`,
      totales: { solicitados, aplicados, omitidos },
      pagos: resultados,
      monto_por_mes: resultados.map(r => r.monto),
      meses_aplicados: resultados.map(r => ({ mes: r.mes_aplicado, anio: r.anio_aplicado }))
    };

    if (omitidos > 0) {
      response.motivo_omision = 'Meses con estado Suspendido fueron omitidos según la política.';
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error al registrar pagos múltiples Tv:', error);

    // Mensajes específicos del model para 400
    const es400 =
      error.message.includes('no existe') ||
      error.message === 'Debe especificar al menos un mes para el pago.' ||
      error.message?.startsWith('Mes/Año inválidos:') ||
      error.message === 'Los meses seleccionados están suspendidos. No hay meses disponibles para aplicar el pago.' ||
      error.message.includes('clientetv_id es requerido');

    if (es400) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updatePagoTv = async (req, res) => {
  try {
    const { 
      clienteTv_id, 
      monto, 
      fecha_pago, 
      observacion, 
      mes_aplicado, 
      anio_aplicado 
    } = req.body;
    
    // Validaciones básicas
    if (!clienteTv_id || !monto || !fecha_pago) {
      return res.status(400).json({ 
        message: 'clienteTv_id, monto y fecha_pago son requeridos.' 
      });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
    }

    // Normalizar nombre para el model
    const pagoData = {
      clientetv_id: parseInt(clienteTv_id),
      monto: parseFloat(monto),
      fecha_pago,
      observacion: observacion || null,
      mes_aplicado: mes_aplicado ? parseInt(mes_aplicado) : null,
      anio_aplicado: anio_aplicado ? parseInt(anio_aplicado) : null
    };

    const resultado = await PagoTvModel.actualizarPagoTv(req.params.id, pagoData);

    let nota = null;
    if (pagoData.mes_aplicado && pagoData.anio_aplicado) {
      if (resultado.mes_aplicado !== pagoData.mes_aplicado || resultado.anio_aplicado !== pagoData.anio_aplicado) {
        nota = 'El pago fue reasignado automáticamente al último mes pendiente no suspendido.';
      }
    } else {
      nota = 'Si existían meses suspendidos, el pago se aplicó al último mes pendiente no suspendido.';
    }

    res.json({ 
      message: 'Pago Tv actualizado exitosamente',
      aplicado_a: {
        mes: resultado.mes_aplicado,
        anio: resultado.anio_aplicado
      },
      nota
    });
  } catch (error) {
    console.error('Error al actualizar pago Tv:', error);

    if (error.message === 'Pago no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    const mensajes400 = [
      'no existe',
      'No se pueden registrar pagos para meses futuros',
      'El cliente está suspendido y no hay meses pendientes no suspendidos para aplicar el pago',
      'No hay meses pendientes no suspendidos para aplicar el pago',
      'Mes/año aplicado inválido o fuera de rango permitido',
      'sin plan asociado'
    ];
    
    if (mensajes400.some(msg => error.message.includes(msg))) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deletePagoTv = async (req, res) => {
  try {
    await PagoTvModel.eliminarPagoTv(req.params.id);
    res.json({ message: 'Pago Tv eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar pago Tv:', error);
    
    if (error.message === 'Pago no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error del servidor' });
  }
};
