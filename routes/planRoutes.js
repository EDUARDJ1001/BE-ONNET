import express from 'express';
import { obtenerPlanes, obtenerPlanesPorId } from '../controllers/planController.js';

const router = express.Router();

// Ruta para obtener los planes
router.get("/", obtenerPlanes);
router.get("/:id", obtenerPlanesPorId);

export default router;