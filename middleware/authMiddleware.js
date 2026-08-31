import jwt from 'jsonwebtoken';
import connectDB from '../config/db.js';

/**
 * Lee el token del header Authorization y deja el usuario en req.usuario.
 *
 * Hasta ahora las rutas se montaban sin verificar nada: cualquiera con la URL
 * podía llamarlas. Todo lo del módulo de planillas pasa por aquí.
 */
export const verificarToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * Corta el paso a quien no sea Administrador (cargo_id = 1).
 *
 * Se deja disponible para rutas que no cuelgan de un módulo. Para las que sí,
 * usar requiereModulo(): no lleva el 1 escrito en el código.
 */
export const soloAdmin = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  if (Number(req.usuario.cargoId) !== 1) {
    return res.status(403).json({ error: 'Acceso restringido al administrador' });
  }

  return next();
};

/**
 * Autorización contra la tabla cargo_modulo.
 *
 * Es la misma fuente de verdad con la que el frontend pinta el menú, así que
 * botón y endpoint nunca se desincronizan. Dar acceso a otro cargo mañana es
 * un INSERT, no un despliegue.
 *
 * Esto NO reemplaza a verificarToken: va después.
 */
export const requiereModulo = (clave) => async (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const connection = await connectDB();
    const [rows] = await connection.query(
      `SELECT 1
         FROM cargo_modulo cm
         JOIN modulos m ON m.id = cm.modulo_id
        WHERE cm.cargo_id = ? AND m.clave = ? AND m.activo = 1
        LIMIT 1`,
      [req.usuario.cargoId, clave]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'No tiene acceso a este módulo' });
    }

    return next();
  } catch (err) {
    console.error('Error al verificar acceso al módulo:', err);
    return res.status(500).json({ error: 'Error al verificar permisos' });
  }
};
