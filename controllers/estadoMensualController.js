import * as EstadoModel from '../models/estadoMensualModel.js';

export const getEstados = async (req, res) => {
  try {
    const estados = await EstadoModel.obtenerEstadosMensuales();
    res.json(estados);
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getEstadoById = async (req, res) => {
  try {
    const estado = await EstadoModel.obtenerEstadoPorId(req.params.id);
    if (!estado) return res.status(404).json({ message: 'Registro no encontrado' });
    res.json(estado);
  } catch (error) {
    console.error('Error al obtener estado por id:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const getEstadosPorClienteYAno = async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clienteId, 10);
    const anio = parseInt(req.params.anio, 10);
    if (Number.isNaN(clienteId) || Number.isNaN(anio)) {
      return res.status(400).json({ message: 'Parámetros inválidos.' });
    }
    const estados = await EstadoModel.obtenerEstadoPorClienteYAno(clienteId, anio); // devuelve siempre 12 meses
    res.json(estados);
  } catch (error) {
    console.error('Error al filtrar estados:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const createEstado = async (req, res) => {
  try {
    const { cliente_id, mes, anio, estado } = req.body;
    if (!cliente_id || !mes || !anio || !estado) {
      return res.status(400).json({ message: 'cliente_id, mes, anio y estado son requeridos.' });
    }
    const nuevoId = await EstadoModel.crearEstadoMensual(req.body); // upsert idempotente
    res.status(201).json({ message: 'Estado creado/actualizado', id: nuevoId });
  } catch (error) {
    console.error('Error al crear estado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const updateEstado = async (req, res) => {
  try {
    await EstadoModel.actualizarEstadoMensual(req.params.id, req.body);
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const deleteEstado = async (req, res) => {
  try {
    await EstadoModel.eliminarEstadoMensual(req.params.id);
    res.json({ message: 'Estado eliminado' });
  } catch (error) {
    console.error('Error al eliminar estado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};
