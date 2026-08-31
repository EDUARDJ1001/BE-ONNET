import express from 'express';
import {
  obtenerCatalogosController,
  obtenerCuadrillasController,
  crearCuadrillaController,
  actualizarCuadrillaController,
  obtenerTiposFibraController,
  obtenerCategoriasGastoController
} from '../controllers/catalogoPlanillaController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/planilla-catalogos
router.use(verificarToken, requiereModulo('planillas'));

// Todo lo que necesita el formulario del día, en una sola llamada.
router.get('/', obtenerCatalogosController);

router.get('/cuadrillas', obtenerCuadrillasController);
router.post('/cuadrillas', crearCuadrillaController);
router.put('/cuadrillas/:id', actualizarCuadrillaController);

router.get('/tipos-fibra', obtenerTiposFibraController);
router.get('/categorias-gasto', obtenerCategoriasGastoController);

export default router;
