import express from 'express';
import {
  getEstados,
  getEstadoById,
  getEstadosPorClienteYAno,
  createEstado,
  updateEstado,
  deleteEstado
} from '../controllers/estadoMensualController.js';

const router = express.Router();

router.get('/', getEstados);

router.get('/cliente/:clienteId/anio/:anio', getEstadosPorClienteYAno);

router.get('/:id', getEstadoById);
router.post('/', createEstado);
router.put('/:id', updateEstado);
router.delete('/:id', deleteEstado);

export default router;
