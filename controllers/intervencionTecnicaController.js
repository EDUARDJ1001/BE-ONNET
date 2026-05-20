import {
  ESTADOS_INTERVENCION,
  anularIntervencionTecnica as anularIntervencionTecnicaModel,
  actualizarIntervencionTecnica as actualizarIntervencionTecnicaModel,
  cambiarEstadoIntervencionTecnica as cambiarEstadoIntervencionTecnicaModel,
  crearIntervencionTecnica as crearIntervencionTecnicaModel,
  obtenerIntervencionTecnicaPorId as obtenerIntervencionTecnicaPorIdModel,
  obtenerIntervencionesTecnicas as obtenerIntervencionesTecnicasModel,
  obtenerIntervencionesTecnicasPorCliente as obtenerIntervencionesTecnicasPorClienteModel,
} from '../models/intervencionTecnicaModel.js';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {}

const esEnteroPositivo = (value) => Number.isInteger(value) && value > 0;

const fechaHoy = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizarFecha = (fecha) => {
  if (!fecha) return fechaHoy();
  if (typeof fecha !== 'string' || !FECHA_REGEX.test(fecha)) {
    throw new ValidationError('La fecha debe tener formato YYYY-MM-DD.');
  }
  return fecha;
};

const normalizarDetalleBitacora = (detalleBitacora) => {
  if (detalleBitacora === undefined || detalleBitacora === null) return null;

  let parsed = detalleBitacora;

  if (typeof detalleBitacora === 'string') {
    try {
      parsed = JSON.parse(detalleBitacora);
    } catch (_err) {
      throw new ValidationError('detalle_bitacora debe ser un JSON válido.');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new ValidationError('detalle_bitacora debe ser un arreglo de objetos.');
  }

  return parsed.map((linea, index) => {
    if (!linea || typeof linea !== 'object' || Array.isArray(linea)) {
      throw new ValidationError(`La línea ${index + 1} de detalle_bitacora es inválida.`);
    }

    const normalizada = { ...linea };

    if (normalizada.cantidad !== undefined && normalizada.cantidad !== null && normalizada.cantidad !== '') {
      const cantidad = Number(normalizada.cantidad);
      if (!Number.isFinite(cantidad)) {
        throw new ValidationError(`La cantidad de la línea ${index + 1} debe ser numérica.`);
      }
      normalizada.cantidad = cantidad;
    }

    if (
      normalizada.precioUnitario !== undefined &&
      normalizada.precioUnitario !== null &&
      normalizada.precioUnitario !== ''
    ) {
      const precio = Number(normalizada.precioUnitario);
      if (!Number.isFinite(precio)) {
        throw new ValidationError(`El precioUnitario de la línea ${index + 1} debe ser numérico.`);
      }
      normalizada.precioUnitario = precio;
    }

    let totalLinea = 0;

    if (normalizada.total !== undefined && normalizada.total !== null && normalizada.total !== '') {
      const total = Number(normalizada.total);
      if (!Number.isFinite(total)) {
        throw new ValidationError(`El total de la línea ${index + 1} debe ser numérico.`);
      }
      totalLinea = total;
    } else if (Number.isFinite(normalizada.cantidad) && Number.isFinite(normalizada.precioUnitario)) {
      totalLinea = normalizada.cantidad * normalizada.precioUnitario;
    }

    normalizada.total = Number(totalLinea.toFixed(2));
    return normalizada;
  });
};

const calcularTotalDesdeDetalle = (detalleBitacora) => {
  if (!Array.isArray(detalleBitacora) || detalleBitacora.length === 0) return 0;

  const total = detalleBitacora.reduce((acc, linea) => {
    const value = Number(linea?.total ?? 0);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

  return Number(total.toFixed(2));
};

const normalizarTotalEstimado = (totalEstimado, detalleBitacora) => {
  if (totalEstimado !== undefined && totalEstimado !== null && totalEstimado !== '') {
    const total = Number(totalEstimado);
    if (!Number.isFinite(total) || total < 0) {
      throw new ValidationError('total_estimado debe ser un número válido.');
    }
    return Number(total.toFixed(2));
  }

  return calcularTotalDesdeDetalle(detalleBitacora);
};

const normalizarEstado = (estado, defaultEstado = 'Borrador') => {
  const estadoFinal = estado ?? defaultEstado;
  if (!ESTADOS_INTERVENCION.includes(estadoFinal)) {
    throw new ValidationError(
      `estado inválido. Valores permitidos: ${ESTADOS_INTERVENCION.join(', ')}.`
    );
  }
  return estadoFinal;
};

export const obtenerIntervencionesTecnicas = async (_req, res) => {
  try {
    const rows = await obtenerIntervencionesTecnicasModel();
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error al listar intervenciones técnicas:', error);
    return res.status(500).json({ message: 'Error interno al listar intervenciones técnicas.' });
  }
};

export const obtenerIntervencionTecnicaPorId = async (req, res) => {
  const id = Number(req.params.id);

  if (!esEnteroPositivo(id)) {
    return res.status(400).json({ message: 'ID de intervención inválido.' });
  }

  try {
    const row = await obtenerIntervencionTecnicaPorIdModel(id);
    if (!row) {
      return res.status(404).json({ message: 'Intervención técnica no encontrada.' });
    }
    return res.status(200).json(row);
  } catch (error) {
    console.error('Error al obtener intervención técnica por ID:', error);
    return res.status(500).json({ message: 'Error interno al obtener la intervención técnica.' });
  }
};

export const obtenerIntervencionesTecnicasPorCliente = async (req, res) => {
  const clienteId = Number(req.params.cliente_id);

  if (!esEnteroPositivo(clienteId)) {
    return res.status(400).json({ message: 'cliente_id inválido.' });
  }

  try {
    const rows = await obtenerIntervencionesTecnicasPorClienteModel(clienteId);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error al listar intervenciones por cliente:', error);
    return res.status(500).json({ message: 'Error interno al listar intervenciones por cliente.' });
  }
};

export const crearIntervencionTecnica = async (req, res) => {
  try {
    const {
      cliente_id,
      usuario_id,
      tipo_servicio_id,
      descripcion,
      fecha,
      observacion,
      detalle_bitacora,
      total_estimado,
      estado,
    } = req.body;

    if (cliente_id === undefined || usuario_id === undefined || tipo_servicio_id === undefined) {
      return res.status(400).json({
        message: 'cliente_id, usuario_id y tipo_servicio_id son requeridos.',
      });
    }

    const clienteId = Number(cliente_id);
    const usuarioId = Number(usuario_id);
    const tipoServicioId = Number(tipo_servicio_id);

    if (!esEnteroPositivo(clienteId) || !esEnteroPositivo(usuarioId) || !esEnteroPositivo(tipoServicioId)) {
      return res.status(400).json({
        message: 'cliente_id, usuario_id y tipo_servicio_id deben ser enteros positivos.',
      });
    }

    const fechaNormalizada = normalizarFecha(fecha);
    const detalleNormalizado = normalizarDetalleBitacora(detalle_bitacora);
    const totalEstimadoFinal = normalizarTotalEstimado(total_estimado, detalleNormalizado);
    const estadoFinal = normalizarEstado(estado, 'Borrador');

    const nuevaIntervencion = await crearIntervencionTecnicaModel({
      cliente_id: clienteId,
      usuario_id: usuarioId,
      tipo_servicio_id: tipoServicioId,
      descripcion: descripcion ?? null,
      fecha: fechaNormalizada,
      observacion: observacion ?? null,
      detalle_bitacora: detalleNormalizado,
      total_estimado: totalEstimadoFinal,
      estado: estadoFinal,
    });

    return res.status(201).json({
      message: 'Intervención técnica registrada correctamente',
      intervencion: nuevaIntervencion,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Error al crear intervención técnica:', error);
    return res.status(500).json({ message: 'Error interno al registrar la intervención técnica.' });
  }
};

export const actualizarIntervencionTecnica = async (req, res) => {
  const id = Number(req.params.id);

  if (!esEnteroPositivo(id)) {
    return res.status(400).json({ message: 'ID de intervención inválido.' });
  }

  try {
    const existente = await obtenerIntervencionTecnicaPorIdModel(id);
    if (!existente) {
      return res.status(404).json({ message: 'Intervención técnica no encontrada.' });
    }

    const {
      cliente_id,
      usuario_id,
      tipo_servicio_id,
      descripcion,
      fecha,
      observacion,
      detalle_bitacora,
      total_estimado,
      estado,
    } = req.body;

    if (cliente_id === undefined || usuario_id === undefined || tipo_servicio_id === undefined) {
      return res.status(400).json({
        message: 'cliente_id, usuario_id y tipo_servicio_id son requeridos.',
      });
    }

    const clienteId = Number(cliente_id);
    const usuarioId = Number(usuario_id);
    const tipoServicioId = Number(tipo_servicio_id);

    if (!esEnteroPositivo(clienteId) || !esEnteroPositivo(usuarioId) || !esEnteroPositivo(tipoServicioId)) {
      return res.status(400).json({
        message: 'cliente_id, usuario_id y tipo_servicio_id deben ser enteros positivos.',
      });
    }

    const fechaNormalizada = normalizarFecha(fecha ?? existente.fecha);
    const detalleNormalizado =
      detalle_bitacora === undefined
        ? existente.detalle_bitacora
        : normalizarDetalleBitacora(detalle_bitacora);
    const totalEstimadoFinal = normalizarTotalEstimado(total_estimado, detalleNormalizado);
    const estadoFinal = normalizarEstado(estado, existente.estado);

    const intervencionActualizada = await actualizarIntervencionTecnicaModel(id, {
      cliente_id: clienteId,
      usuario_id: usuarioId,
      tipo_servicio_id: tipoServicioId,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      fecha: fechaNormalizada,
      observacion: observacion !== undefined ? observacion : existente.observacion,
      detalle_bitacora: detalleNormalizado,
      total_estimado: totalEstimadoFinal,
      estado: estadoFinal,
    });

    if (!intervencionActualizada) {
      return res.status(404).json({ message: 'Intervención técnica no encontrada.' });
    }

    return res.status(200).json({
      message: 'Intervención técnica actualizada correctamente',
      intervencion: intervencionActualizada,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Error al actualizar intervención técnica:', error);
    return res.status(500).json({ message: 'Error interno al actualizar la intervención técnica.' });
  }
};

export const cambiarEstadoIntervencionTecnica = async (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body;

  if (!esEnteroPositivo(id)) {
    return res.status(400).json({ message: 'ID de intervención inválido.' });
  }

  try {
    const estadoFinal = normalizarEstado(estado, null);
    const row = await cambiarEstadoIntervencionTecnicaModel(id, estadoFinal);

    if (!row) {
      return res.status(404).json({ message: 'Intervención técnica no encontrada.' });
    }

    return res.status(200).json({
      message: 'Estado de la intervención técnica actualizado correctamente',
      intervencion: row,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Error al cambiar estado de intervención técnica:', error);
    return res.status(500).json({ message: 'Error interno al cambiar el estado de la intervención.' });
  }
};

export const anularIntervencionTecnica = async (req, res) => {
  const id = Number(req.params.id);

  if (!esEnteroPositivo(id)) {
    return res.status(400).json({ message: 'ID de intervención inválido.' });
  }

  try {
    const row = await anularIntervencionTecnicaModel(id);

    if (!row) {
      return res.status(404).json({ message: 'Intervención técnica no encontrada.' });
    }

    return res.status(200).json({
      message: 'Intervención técnica anulada correctamente',
      intervencion: row,
    });
  } catch (error) {
    console.error('Error al anular intervención técnica:', error);
    return res.status(500).json({ message: 'Error interno al anular la intervención técnica.' });
  }
};
