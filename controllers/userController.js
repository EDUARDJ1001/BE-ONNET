import { 
    obtenerUsuarios as obtenerUsuariosModel, 
    obtenerUsuarioPorId as obtenerUsuarioPorIdModel,
    crearUsuario as crearUsuarioModel,
    actualizarUsuario as actualizarUsuarioModel,
    eliminarUsuario as eliminarUsuarioModel
} from "../models/userModel.js";

export const obtenerUsuarios = async (req, res) => {
    try {
        const usuarios = await obtenerUsuariosModel();
        res.status(200).json(usuarios);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios', error });
    }
}

export const obtenerUsuarioPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const usuario = await obtenerUsuarioPorIdModel(id);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json(usuario);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuario por ID', error });
    }
}

export const crearUsuario = async (req, res) => {
    const usuario = req.body;
    try {
        const nuevoUsuarioId = await crearUsuarioModel(usuario);
        res.status(201).json({ message: 'Usuario creado con éxito', id: nuevoUsuarioId });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear usuario', error });
    }
}

export const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const usuario = req.body;

    try {
        const resultado = await actualizarUsuarioModel(id, usuario);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json({ message: 'Usuario actualizado con éxito' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar usuario', error });
    }
}

export const eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await eliminarUsuarioModel(id);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json({ message: 'Usuario eliminado con éxito' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar usuario', error });
    }
}
