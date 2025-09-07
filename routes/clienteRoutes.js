import express from 'express';
import {
    getClientes,
    getClienteById,
    getClientesConEstados,
    createCliente,
    updateCliente,
    deleteCliente,
    getEstadosClientes,
    migrarClientes
} from '../controllers/clienteController.js';

const router = express.Router();

router.get('/', getClientes);
router.get('/con-estados', getClientesConEstados);
router.get('/:id', getClienteById);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);
router.get('/estados-clientes', getEstadosClientes);
router.post('/migrar', migrarClientes); // Nueva ruta para migración

export default router;
