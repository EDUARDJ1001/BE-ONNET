import express from 'express';
import {
    getClientes,
    getClienteById,
    createCliente,
    updateCliente,
    deleteCliente,
    getClientesConEstados
} from '../controllers/clienteController.js';

const router = express.Router();


router.get('/', getClientes);
router.get('/:id', getClienteById);
router.get('/con-estados', getClientesConEstados);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

export default router;
