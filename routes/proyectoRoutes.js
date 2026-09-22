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
  eliminarAbonoController,
  guardarControlController
} from '../controllers/proyectoController.js';
import { verificarToken, requiereModulo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Principal /api/proyectos
router.use(verificarToken, requiereModulo('proyectos'));

// Hoja de control: proyectos y depósitos guardados de una vez, como la hoja
// CONTROL del Excel. Antes que /:id, si no Express toma "control" como un id.
router.put('/control', guardarControlController);

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
