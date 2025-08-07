import express from 'express';
import { obtenerPlanes } from '../controllers/planController.js';

const router = express.Router();

// Ruta para obtener los planes
router.get("/", obtenerPlanes);

export default router;