import express from 'express';
import {
  obtenerResumenController,
  obtenerMensualController,
  obtenerDiariaController
} from '../controllers/utilidadController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/utilidades
router.use(verificarToken, requiereModulo('utilidades'));

router.get('/resumen', obtenerResumenController);
router.get('/mensual', obtenerMensualController);
router.get('/diaria', obtenerDiariaController);

export default router;
