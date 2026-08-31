import express from 'express';
import {
  obtenerColaboradoresController,
  obtenerColaboradorPorIdController,
  obtenerEstadoCuentaController,
  obtenerSaldosController,
  crearColaboradorController,
  actualizarColaboradorController,
  desactivarColaboradorController
} from '../controllers/colaboradorController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/colaboradores
router.use(verificarToken, requiereModulo('colaboradores'));

// Antes que /:id: si no, Express lee "saldos" como un id.
router.get('/saldos', obtenerSaldosController);

router.get('/', obtenerColaboradoresController);
router.post('/', crearColaboradorController);
router.get('/:id', obtenerColaboradorPorIdController);
router.get('/:id/estado-cuenta', obtenerEstadoCuentaController);
router.put('/:id', actualizarColaboradorController);

// Baja lógica: no se borra, se desactiva.
router.delete('/:id', desactivarColaboradorController);

export default router;
