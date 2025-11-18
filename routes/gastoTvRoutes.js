import express from 'express';
import { 
  obtenerGastosTv, 
  obtenerGastoTvPorIdController, 
  crearGastoTvController,
  actualizarGastoTvController,
  eliminarGastoTvController
} from '../controllers/gastoTvController.js';

const router = express.Router();

// Principal /api/gastos-tv
router.get("/", obtenerGastosTv);
router.get("/:id", obtenerGastoTvPorIdController);
router.post("/", crearGastoTvController);
router.put("/:id", actualizarGastoTvController);
router.delete("/:id", eliminarGastoTvController);

export default router;
