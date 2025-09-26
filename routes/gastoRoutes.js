import express from 'express';
import { 
  obtenerGastos, 
  obtenerGastoPorIdController, 
  crearGastoController,
  actualizarGastoController,
  eliminarGastoController
} from '../controllers/gastoController.js';

const router = express.Router();

// Principal /api/gastos
router.get("/", obtenerGastos);
router.get("/:id", obtenerGastoPorIdController);
router.post("/", crearGastoController);
router.put("/:id", actualizarGastoController);
router.delete("/:id", eliminarGastoController);

export default router;
