import express from 'express';
import {
  obtenerPlanillasController,
  obtenerPlanillaPorIdController,
  crearPlanillaController,
  actualizarPlanillaController,
  cambiarEstadoController,
  eliminarPlanillaController,
  obtenerColaboradoresController,
  guardarColaboradoresController,
  obtenerLiquidacionController
} from '../controllers/planillaController.js';
import {
  obtenerDiasController,
  obtenerDiaPorIdController,
  crearDiaController,
  actualizarDiaController,
  eliminarDiaController,
  sugerirIngresoController
} from '../controllers/planillaDiaController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/planillas
// Todo el módulo queda detrás del token y del permiso de módulo.
router.use(verificarToken, requiereModulo('planillas'));

// Utilidad de cálculo: propone la "entrada" del día. No toca la base.
router.post('/sugerir-ingreso', sugerirIngresoController);

router.get('/', obtenerPlanillasController);
router.post('/', crearPlanillaController);
router.get('/:id', obtenerPlanillaPorIdController);
router.put('/:id', actualizarPlanillaController);
router.patch('/:id/estado', cambiarEstadoController);
router.delete('/:id', eliminarPlanillaController);

// Integrantes de la planilla
router.get('/:id/colaboradores', obtenerColaboradoresController);
router.put('/:id/colaboradores', guardarColaboradoresController);

// Liquidación: días, devengado, vales, pagado y saldo
router.get('/:id/liquidacion', obtenerLiquidacionController);

// Días de trabajo
router.get('/:id/dias', obtenerDiasController);
router.post('/:id/dias', crearDiaController);
router.get('/:id/dias/:diaId', obtenerDiaPorIdController);
router.put('/:id/dias/:diaId', actualizarDiaController);
router.delete('/:id/dias/:diaId', eliminarDiaController);

export default router;
