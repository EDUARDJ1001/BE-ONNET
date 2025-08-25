import express from 'express';
import { getMetodosPago } from '../controllers/pagoController.js';

const router = express.Router();

router.get('/', getMetodosPago);

export default router;
