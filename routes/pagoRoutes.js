// routes/pagos.routes.js
import express from 'express';
import {
  getPagos, getMetodosPago, getPagoById, getPagosPorCliente, getPagosPorMes,
  getResumenPagosCliente, createPago, updatePago, deletePago, getMesesPendientes,
  createPagosMultiples
} from '../controllers/pagoController.js';

const router = express.Router();

// Validador simple sin librerías
const ensureInt = (name) => (req, res, next) => {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v)) return res.status(400).json({ message: `${name} debe ser entero` });
  next();
};
const ensureMes = (req, res, next) => {
  const m = Number(req.params.mes);
  if (!Number.isInteger(m) || m < 1 || m > 12) return res.status(400).json({ message: 'mes inválido (1..12)' });
  next();
};
const ensureAnio = (req, res, next) => {
  const y = Number(req.params.anio);
  if (!Number.isInteger(y) || String(y).length !== 4) return res.status(400).json({ message: 'año inválido (YYYY)' });
  next();
};

/* GET */
router.get('/', getPagos);
router.get('/metodos', getMetodosPago);
router.get('/cliente/:cliente_id', ensureInt('cliente_id'), getPagosPorCliente);
router.get('/mes/:mes/:anio', ensureMes, ensureAnio, getPagosPorMes);
router.get('/resumen/:cliente_id/:mes/:anio', ensureInt('cliente_id'), ensureMes, ensureAnio, getResumenPagosCliente);
router.get('/meses-pendientes/:cliente_id', ensureInt('cliente_id'), getMesesPendientes);

// ID SIEMPRE al final
router.get('/:id', ensureInt('id'), getPagoById);

/* POST */
router.post('/', createPago);
router.post('/multiples', createPagosMultiples);

/* PUT & DELETE */
router.put('/:id', ensureInt('id'), updatePago);
router.delete('/:id', ensureInt('id'), deletePago);

export default router;
