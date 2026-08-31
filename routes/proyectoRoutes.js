import express from 'express';
import {
  obtenerProyectosController,
  obtenerProyectoPorIdController,
  crearProyectoController,
  actualizarProyectoController,
  eliminarProyectoController,
  obtenerAbonosController,
  crearAbonoController,
  asignarAbonoController,
  eliminarAbonoController
} from '../controllers/proyectoController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/proyectos
router.use(verificarToken, requiereModulo('proyectos'));

// Los abonos van antes que /:id, si no Express toma "abonos" como un id.
router.get('/abonos', obtenerAbonosController);
router.post('/abonos', crearAbonoController);
router.patch('/abonos/:id/proyecto', asignarAbonoController);
router.delete('/abonos/:id', eliminarAbonoController);

router.get('/', obtenerProyectosController);
router.post('/', crearProyectoController);
router.get('/:id', obtenerProyectoPorIdController);
router.put('/:id', actualizarProyectoController);
router.delete('/:id', eliminarProyectoController);

export default router;
