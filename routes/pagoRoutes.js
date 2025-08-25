import express from 'express';
import {
    getPagos,
    getMetodosPago,
    getPagoById,
    createPago,
    updatePago,
    deletePago
} from '../controllers/pagoController.js';

// ruta main /api/pagos

const router = express.Router();

router.get('/', getPagos);
router.get('/metodos', getMetodosPago);
router.get('/:id', getPagoById);
router.post('/', createPago);
router.put('/:id', updatePago);
router.delete('/:id', deletePago);

export default router;
