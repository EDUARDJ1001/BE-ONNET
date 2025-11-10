import express from 'express';
import { deleteEstadoTv, getEstadosPorClienteYAnoTv, getEstadosTv, getEstadoTvById, updateEstadoTv } from '../controllers/estadoMensualTvController.js';

//Ruta base /api/estado-mensual-tv

const router = express.Router();

router.get('/', getEstadosTv);

router.get('/cliente/:clienteId/anio/:anio', getEstadosPorClienteYAnoTv);

router.get('/:id', getEstadoTvById);
router.put('/:id', updateEstadoTv);
router.delete('/:id', deleteEstadoTv);

export default router;
