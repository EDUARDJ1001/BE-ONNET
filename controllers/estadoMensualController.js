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
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const getEstadosPorClienteYAno = async (req, res) => {
    const { clienteId, anio } = req.params;
    try {
        const estados = await EstadoModel.obtenerEstadoPorClienteYAno(clienteId, anio);
        res.json(estados);
    } catch (error) {
        console.error('Error al filtrar estados:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const createEstado = async (req, res) => {
    try {
        const nuevoId = await EstadoModel.crearEstadoMensual(req.body);
        res.status(201).json({ message: 'Estado creado', id: nuevoId });
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
