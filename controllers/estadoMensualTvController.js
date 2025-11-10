import * as EstadoModel from '../models/estadoMensualTvModel.js';

export const getEstadosTv = async (req, res) => {
  try {
    const estados = await EstadoModel.obtenerEstadosMensualesTv();
    res.json(estados);
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getEstadoTvById = async (req, res) => {
  try {
    const estado = await EstadoModel.obtenerEstadoTvPorId(req.params.id);
    if (!estado) return res.status(404).json({ message: 'Registro no encontrado' });
    res.json(estado);
  } catch (error) {
    console.error('Error al obtener estado por id:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getEstadosPorClienteYAnoTv = async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clienteId, 10);
    const anio = parseInt(req.params.anio, 10);
    if (Number.isNaN(clienteId) || Number.isNaN(anio)) {
      return res.status(400).json({ message: 'Parámetros inválidos.' });
    }
    const estados = await EstadoModel.obtenerEstadoPorClienteYAnoTv(clienteId, anio); // devuelve siempre 12 meses
    res.json(estados);
  } catch (error) {
    console.error('Error al filtrar estados:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updateEstadoTv = async (req, res) => {
  try {
    await EstadoModel.actualizarEstadoMensualTv(req.params.id, req.body);
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deleteEstadoTv = async (req, res) => {
  try {
    await EstadoModel.eliminarEstadoMensualTv(req.params.id);
    res.json({ message: 'Estado eliminado' });
  } catch (error) {
    console.error('Error al eliminar estado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};
