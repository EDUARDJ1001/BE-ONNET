import express from 'express';
import {
  actualizarIntervencionTecnica,
  anularIntervencionTecnica,
  cambiarEstadoIntervencionTecnica,
  crearIntervencionTecnica,
  obtenerIntervencionTecnicaPorId,
  obtenerIntervencionesTecnicas,
  obtenerIntervencionesTecnicasPorCliente,
} from '../controllers/intervencionTecnicaController.js';

const router = express.Router();

router.get('/', obtenerIntervencionesTecnicas);
router.get('/cliente/:cliente_id', obtenerIntervencionesTecnicasPorCliente);
router.get('/:id', obtenerIntervencionTecnicaPorId);
router.post('/', crearIntervencionTecnica);
router.put('/:id', actualizarIntervencionTecnica);
router.patch('/:id/estado', cambiarEstadoIntervencionTecnica);
router.delete('/:id', anularIntervencionTecnica);

export default router;

