import express from 'express';
import {
    getEstados,
    getEstadoById,
    getEstadosPorClienteYAno,
    createEstado,
    updateEstado,
    deleteEstado
} from '../controllers/estadoMensualController.js';

// ruta principal en index.js /api/estado-mensual

const router = express.Router();

router.get('/', getEstados);
router.get('/:id', getEstadoById);
router.get('/cliente/:clienteId/anio/:anio', getEstadosPorClienteYAno);
router.post('/', createEstado);
router.put('/:id', updateEstado);
router.delete('/:id', deleteEstado);

export default router;