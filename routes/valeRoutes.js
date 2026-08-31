import express from 'express';
import {
  obtenerValesController,
  obtenerValePorIdController,
  crearValeController,
  actualizarValeController,
  eliminarValeController
} from '../controllers/valeController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/vales
router.use(verificarToken, requiereModulo('colaboradores'));

router.get('/', obtenerValesController);
router.post('/', crearValeController);
router.get('/:id', obtenerValePorIdController);
router.put('/:id', actualizarValeController);
router.delete('/:id', eliminarValeController);

export default router;
