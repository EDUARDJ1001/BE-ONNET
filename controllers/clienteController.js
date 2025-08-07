import * as ClienteModel from '../models/clienteModel.js';
import { obtenerClientesConEstados } from '../models/clienteModel.js';

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
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const getClientesConEstados = async (req, res) => {
    try {
        const clientes = await obtenerClientesConEstados();
        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes con estados:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};


export const createCliente = async (req, res) => {
    try {
        const nuevoId = await ClienteModel.crearCliente(req.body);
        res.status(201).json({ message: 'Cliente creado', id: nuevoId });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const updateCliente = async (req, res) => {
    try {
        await ClienteModel.actualizarCliente(req.params.id, req.body);
        res.json({ message: 'Cliente actualizado' });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const deleteCliente = async (req, res) => {
    try {
        await ClienteModel.eliminarCliente(req.params.id);
        res.json({ message: 'Cliente eliminado' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
