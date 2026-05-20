import express from 'express';
import { obtenerTiposServicio } from '../controllers/tipoServicioController.js';

const router = express.Router();

router.get('/', obtenerTiposServicio);

export default router;

