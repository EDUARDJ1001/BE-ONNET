import {
  obtenerProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  obtenerAbonos,
  crearAbono,
  asignarAbono,
  eliminarAbono
} from '../models/proyectoModel.js';
import { aId, aMonto, aMontoPositivo, esFecha, responderErrorSql } from '../utils/validaciones.js';

const ESTADOS = ['planificado', 'en_proceso', 'finalizado', 'cancelado'];

export const obtenerProyectosController = async (req, res) => {
  const { estado } = req.query;
  if (estado && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  }

  try {
    res.json(await obtenerProyectos({ estado: estado || null }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los proyectos');
  }
};

export const obtenerProyectoPorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const proyecto = await obtenerProyectoPorId(id);
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json(proyecto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el proyecto');
  }
};

const validarProyecto = ({ nombre, costo, estado, fecha_inicio, fecha_fin }) => {
  if (!nombre || !nombre.trim()) return 'El nombre del proyecto es obligatorio';
  if (costo !== undefined && aMonto(costo) === null) return 'El costo debe ser un número mayor o igual a 0';
  if (estado && !ESTADOS.includes(estado)) return `Estado inválido. Use: ${ESTADOS.join(', ')}`;
  if (fecha_inicio && !esFecha(fecha_inicio)) return 'fecha_inicio inválida. Use YYYY-MM-DD';
  if (fecha_fin && !esFecha(fecha_fin)) return 'fecha_fin inválida. Use YYYY-MM-DD';
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
    return 'La fecha final no puede ser anterior a la inicial';
  }
  return null;
};

export const crearProyectoController = async (req, res) => {
  const error = validarProyecto(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const proyecto = await crearProyecto(
      { ...req.body, nombre: req.body.nombre.trim(), costo: aMonto(req.body.costo) ?? 0 },
      req.usuario?.id ?? null
    );
    res.status(201).json(proyecto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear el proyecto');
  }
};

export const actualizarProyectoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarProyecto(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const proyecto = await actualizarProyecto(id, {
      ...req.body,
      nombre: req.body.nombre.trim(),
      costo: aMonto(req.body.costo) ?? 0
    });
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json(proyecto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el proyecto');
  }
};

export const eliminarProyectoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarProyecto(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json({ message: 'Proyecto eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el proyecto');
  }
};

/* ============================
   Abonos
   ============================ */

/**
 * `?sinAsignar=true` devuelve los depósitos que todavía no tienen proyecto.
 * Son los que entraron así desde la hoja CONTROL, donde DEPOSITO y PROYECTO
 * eran dos listas separadas.
 */
export const obtenerAbonosController = async (req, res) => {
  const sinAsignar = req.query.sinAsignar === 'true';
  const proyectoId = req.query.proyecto_id ? aId(req.query.proyecto_id) : null;

  if (req.query.proyecto_id && !proyectoId) {
    return res.status(400).json({ error: 'proyecto_id inválido' });
  }

  try {
    res.json(await obtenerAbonos({ proyectoId, sinAsignar }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los abonos');
  }
};

export const crearAbonoController = async (req, res) => {
  const { monto, fecha, proyecto_id = null, metodo_id = null } = req.body;

  if (aMontoPositivo(monto) === null) {
    return res.status(400).json({ error: 'El monto debe ser un número positivo' });
  }
  if (!esFecha(fecha)) {
    return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
  }
  if (proyecto_id !== null && aId(proyecto_id) === null) {
    return res.status(400).json({ error: 'proyecto_id inválido' });
  }
  if (metodo_id !== null && aId(metodo_id) === null) {
    return res.status(400).json({ error: 'metodo_id inválido' });
  }

  try {
    const abono = await crearAbono(
      { ...req.body, monto: aMontoPositivo(monto) },
      req.usuario?.id ?? null
    );
    res.status(201).json(abono);
  } catch (err) {
    responderErrorSql(res, err, 'Error al registrar el abono');
  }
};

/** Asignar un depósito suelto a su proyecto. */
export const asignarAbonoController = async (req, res) => {
  const id = aId(req.params.id);
  const proyectoId = aId(req.body.proyecto_id);

  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!proyectoId) {
    return res.status(400).json({ error: 'proyecto_id inválido' });
  }

  try {
    const resultado = await asignarAbono(id, proyectoId);
    if (!resultado) {
      return res.status(404).json({ error: 'Abono no encontrado' });
    }
    res.json(resultado);
  } catch (err) {
    responderErrorSql(res, err, 'Error al asignar el abono');
  }
};

export const eliminarAbonoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarAbono(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Abono no encontrado' });
    }
    res.json({ message: 'Abono eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el abono');
  }
};
