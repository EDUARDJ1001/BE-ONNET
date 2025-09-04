import express from 'express';
import {
    getPagos,
    getMetodosPago,
    getPagoById,
    getPagosPorCliente,
    getPagosPorMes,
    getResumenPagosCliente,
    createPago,
    updatePago,
    deletePago
} from '../controllers/pagoController.js';

// ruta main /api/pagos

const router = express.Router();

// Rutas principales
router.get('/', getPagos);
router.get('/metodos', getMetodosPago);
router.get('/:id', getPagoById);
router.post('/', createPago);
router.put('/:id', updatePago);
router.delete('/:id', deletePago);

// Nuevas rutas para filtros específicos
router.get('/cliente/:cliente_id', getPagosPorCliente);
router.get('/mes/:mes/:anio', getPagosPorMes);
router.get('/resumen/:cliente_id/:mes/:anio', getResumenPagosCliente);

export default router;
