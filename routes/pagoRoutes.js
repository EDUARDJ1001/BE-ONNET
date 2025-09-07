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
    deletePago,
    getMesesPendientes,
    createPagosMultiples
} from '../controllers/pagoController.js';

// ruta main /api/pagos

const router = express.Router();

// Rutas GET
router.get('/', getPagos);
router.get('/metodos', getMetodosPago);
router.get('/:id', getPagoById);
router.get('/cliente/:cliente_id', getPagosPorCliente);
router.get('/mes/:mes/:anio', getPagosPorMes);
router.get('/resumen/:cliente_id/:mes/:anio', getResumenPagosCliente);
router.get('/meses-pendientes/:cliente_id', getMesesPendientes);

// Rutas POST
router.post('/', createPago);
router.post('/multiples', createPagosMultiples); // Nueva ruta para pagos múltiples

// Rutas PUT y DELETE
router.put('/:id', updatePago);
router.delete('/:id', deletePago);

export default router;



