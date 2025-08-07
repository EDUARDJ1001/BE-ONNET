import express from 'express';
import { obtenerCargos } from '../controllers/cargoController.js';

const router = express.Router();

router.get('/', obtenerCargos);

export default router;