// src/routes/pagoTVRoutes.js
import express from 'express';
import {
  getPagosTv,
  getPagoTvById,
  getPagosPorClienteTv,
  getPagosTvPorMes,
  getResumenPagosClienteTv,
  getMesesPendientesTv,
  createPagoTv,
  createPagosMultiplesTv,
  updatePagoTv,
  deletePagoTv
} from '../controllers/pagoTvController.js';

const router = express.Router();

// Ruta principal de pagos TV: /api/pagos-tv

// GET - Obtener todos los pagos TV
router.get('/pagos-tv', getPagosTv);

// GET - Obtener pago TV por ID
router.get('/pagos-tv/:id', getPagoTvById);

// GET - Obtener pagos por cliente TV
router.get('/clientes-tv/:clienteTv_id/pagos', getPagosPorClienteTv); // ← CORREGIDO

// GET - Obtener pagos TV por mes y año (basado en fecha_pago)
router.get('/pagos-tv/mes/:mes/:anio', getPagosTvPorMes);

// GET - Obtener resumen de pagos por cliente TV y mes/año específico
router.get('/clientes-tv/:clienteTv_id/resumen-pagos/:mes/:anio', getResumenPagosClienteTv); // ← CORREGIDO

// GET - Obtener meses pendientes (no suspendidos) para un cliente TV
router.get('/clientes-tv/:clienteTv_id/meses-pendientes', getMesesPendientesTv); // ← CORREGIDO

// POST - Crear un nuevo pago TV
router.post('/pagos-tv', createPagoTv);

// POST - Crear pagos múltiples para varios meses TV
router.post('/pagos-tv/multiples', createPagosMultiplesTv);

// PUT - Actualizar pago TV existente
router.put('/pagos-tv/:id', updatePagoTv);

// DELETE - Eliminar pago TV
router.delete('/pagos-tv/:id', deletePagoTv);

export default router;
