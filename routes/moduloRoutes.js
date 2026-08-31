import express from 'express';
import {
  obtenerMisModulos,
  obtenerModulosController,
  asignarCargosController
} from '../controllers/moduloController.js';
import { verificarToken, soloAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/modulos

// Cualquier usuario autenticado: con esto el frontend arma su menú.
router.get('/mios', verificarToken, obtenerMisModulos);

// Administrar quién ve qué: sólo administrador.
router.get('/', verificarToken, soloAdmin, obtenerModulosController);
router.put('/:id/cargos', verificarToken, soloAdmin, asignarCargosController);

export default router;
