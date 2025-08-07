import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import connectDB from '../config/db.js';

export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }

    try {
        const db = await connectDB();

        const [rows] = await db.execute(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Usuario no encontrado.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        // Asignar ruta de dashboard según cargo
        let dashboardRoute;
        switch (user.cargo_id) {
            case 1:
                dashboardRoute = '/pages/admin';
                break;
            case 2:
                dashboardRoute = '/pages/cajero';
                break;
            case 3:
                dashboardRoute = '/pages/tecnico';
                break;
            default:
                return res.status(403).json({ message: 'Rol no autorizado.' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                cargoId: user.cargo_id,
                nombre: user.nombre,
                apellido: user.apellido
            },
            process.env.JWT_SECRET,
            { expiresIn: '9h' }
        );

        return res.json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                username: user.username,
                cargoId: user.cargo_id,
                nombre: user.nombre,
                apellido: user.apellido
            },
            dashboardRoute
        });

    } catch (error) {
        console.error('Error en el login:', error);
        return res.status(500).json({ message: 'Error en el servidor.' });
    }
};
