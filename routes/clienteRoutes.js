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
// IMPORTANTE: poner esta ruta ANTES de '/:id' para que no se trague 'con-estados' como id
router.get('/con-estados', getClientesConEstados);
router.get('/:id', getClienteById);

router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

export default router;
