import express from 'express';
import { 
  obtenerPlanes, 
  obtenerPlanPorIdController, 
  crearPlanController,
  actualizarPlanController,
  eliminarPlanController
} from '../controllers/planController.js';

const router = express.Router();

// Principal /api/planes
router.get("/", obtenerPlanes);
router.get("/:id", obtenerPlanPorIdController);
router.post("/", crearPlanController);
router.put("/:id", actualizarPlanController);
router.delete("/:id", eliminarPlanController);

export default router;
