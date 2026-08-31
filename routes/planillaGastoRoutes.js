import express from 'express';
import {
  obtenerGastosController,
  obtenerGastoPorIdController,
  crearGastoController,
  actualizarGastoController,
  eliminarGastoController,
  obtenerPorCategoriaController
} from '../controllers/planillaGastoController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/planilla-gastos
// No confundir con /api/gastos: eso es la caja general de la empresa.
router.use(verificarToken, requiereModulo('planillas'));

// Antes que /:id.
router.get('/por-categoria', obtenerPorCategoriaController);

router.get('/', obtenerGastosController);
router.post('/', crearGastoController);
router.get('/:id', obtenerGastoPorIdController);
router.put('/:id', actualizarGastoController);
router.delete('/:id', eliminarGastoController);

export default router;
