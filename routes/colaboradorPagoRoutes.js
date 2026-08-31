import express from 'express';
import {
  obtenerPagosController,
  obtenerPagoPorIdController,
  crearPagoController,
  actualizarPagoController,
  eliminarPagoController,
  obtenerDesfasadosController
} from '../controllers/colaboradorPagoController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/colaborador-pagos
router.use(verificarToken, requiereModulo('colaboradores'));

// Control de cierre: comprobantes fechados lejos de su captura. Antes que /:id.
router.get('/desfasados', obtenerDesfasadosController);

router.get('/', obtenerPagosController);
router.post('/', crearPagoController);
router.get('/:id', obtenerPagoPorIdController);
router.put('/:id', actualizarPagoController);
router.delete('/:id', eliminarPagoController);

export default router;
