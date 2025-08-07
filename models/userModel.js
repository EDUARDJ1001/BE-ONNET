import connectDB from "../config/db.js";
import bcrypt from 'bcryptjs';

export const obtenerUsuarios = async () => {
    try {
        const connection = await connectDB();
        const query = 'SELECT * FROM usuarios';
        const [rows] = await connection.query(query);
        return rows;
    } catch (err) {
        console.error('Error al obtener usuarios:', err);
        throw err;
    }
}

export const obtenerUsuarioPorId = async (id) => {
    try {
        const connection = await connectDB();
        const query = 'SELECT * FROM usuarios WHERE id = ?';
        const [rows] = await connection.query(query, [id]);
        return rows[0];
    } catch (err) {
        console.error('Error al obtener usuario por ID:', err);
        throw err;
    }
}

//tabla usuarios: id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100) NOT NULL, cargo_id INT NOT NULL, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, -- bcrypt hash
export const crearUsuario = async (usuario) => {
    const { nombre, apellido, cargo_id, username, password } = usuario;

    if (!nombre || !apellido || !cargo_id || !username || !password) {
        throw new Error('Todos los campos son requeridos');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const connection = await connectDB();
        const query = 'INSERT INTO usuarios (nombre, apellido, cargo_id, username, password) VALUES (?, ?, ?, ?, ?)';
        const [result] = await connection.query(query, [nombre, apellido, cargo_id, username, hashedPassword]);
        return result.insertId;
    } catch (err) {
        console.error('Error al crear usuario:', err);
        throw err;
    }
}

export const actualizarUsuario = async (id, usuario) => {
    const { nombre, apellido, cargo_id, username, password } = usuario;

    if (!nombre || !apellido || !cargo_id || !username) {
        throw new Error('Todos los campos son requeridos excepto la contraseña');
    }

    let hashedPassword;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    try {
        const connection = await connectDB();
        const query = 'UPDATE usuarios SET nombre = ?, apellido = ?, cargo_id = ?, username = ?, password = ? WHERE id = ?';
        const [result] = await connection.query(query, [nombre, apellido, cargo_id, username, hashedPassword || null, id]);
        return result.affectedRows > 0;
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        throw err;
    }
}

export const eliminarUsuario = async (id) => {
    try {
        const connection = await connectDB();
        const query = 'DELETE FROM usuarios WHERE id = ?';
        const [result] = await connection.query(query, [id]);
        return result.affectedRows > 0;
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        throw err;
    }
}
