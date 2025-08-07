import express from 'express';
import { actualizarUsuario, crearUsuario, eliminarUsuario, obtenerUsuarioPorId, obtenerUsuarios } from '../controllers/userController.js'; 

const router = express.Router();

router.get('/', obtenerUsuarios);
router.get('/:id', obtenerUsuarioPorId);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

export default router;