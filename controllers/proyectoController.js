import {
  obtenerProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  obtenerAbonos,
  crearAbono,
  asignarAbono,
  eliminarAbono,
  guardarControl
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

/* ============================
   Hoja de control (guardado en bloque)
   ============================ */

/**
 * Valida la hoja de control completa antes de tocar la base.
 * Las filas marcadas para borrar no se validan: se van a ir.
 */
const validarControl = ({ proyectos, abonos }) => {
  if (!Array.isArray(proyectos) || !Array.isArray(abonos)) {
    return 'Se esperan los arreglos "proyectos" y "abonos"';
  }

  const claves = new Set();
  const nombres = new Set();

  for (const p of proyectos) {
    if (p.clave) claves.add(p.clave);
    if (p.eliminar) {
      if (!aId(p.id)) return 'Sólo se puede borrar un proyecto ya guardado';
      continue;
    }
    if (p.id !== undefined && p.id !== null && !aId(p.id)) return 'Referencia de proyecto inválida';

    const nombre = typeof p.nombre === 'string' ? p.nombre.trim() : '';
    if (!nombre) return 'Hay un proyecto sin nombre';

    // El nombre es único en la base; se revisa aquí para dar un mensaje claro
    // en vez del error genérico de clave duplicada.
    const llave = nombre.toLowerCase();
    if (nombres.has(llave)) return `El proyecto "${nombre}" está escrito dos veces`;
    nombres.add(llave);

    if (aMonto(p.costo ?? 0) === null) return `El costo de "${nombre}" debe ser un número mayor o igual a 0`;
    if (p.estado && !ESTADOS.includes(p.estado)) return `Estado inválido en "${nombre}"`;
  }

  for (const a of abonos) {
    if (a.eliminar) {
      if (!aId(a.id)) return 'Sólo se puede borrar un depósito ya guardado';
      continue;
    }
    if (a.id !== undefined && a.id !== null && !aId(a.id)) return 'Referencia de depósito inválida';
    if (aMontoPositivo(a.monto) === null) return 'Cada depósito necesita un monto mayor que cero';
    if (!esFecha(a.fecha)) return 'Cada depósito necesita su fecha de abono';
    if (a.proyecto_id !== undefined && a.proyecto_id !== null && !aId(a.proyecto_id)) {
      return 'Hay un depósito con un proyecto inválido';
    }
    if (a.proyecto_clave && !claves.has(a.proyecto_clave)) {
      return 'Hay un depósito asignado a un proyecto que no está en la hoja';
    }
  }

  return null;
};

export const guardarControlController = async (req, res) => {
  const cuerpo = { proyectos: req.body.proyectos ?? [], abonos: req.body.abonos ?? [] };

  const error = validarControl(cuerpo);
  if (error) {
    return res.status(400).json({ error });
  }

  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  try {
    const resultado = await guardarControl(
      {
        proyectos: cuerpo.proyectos.map((p) => ({
          id: p.id ? aId(p.id) : null,
          clave: p.clave ? String(p.clave) : null,
          eliminar: Boolean(p.eliminar),
          nombre: texto(p.nombre),
          costo: aMonto(p.costo ?? 0) ?? 0,
          estado: p.estado || 'en_proceso'
        })),
        abonos: cuerpo.abonos.map((a) => ({
          id: a.id ? aId(a.id) : null,
          eliminar: Boolean(a.eliminar),
          monto: aMonto(a.monto ?? 0) ?? 0,
          fecha: a.fecha,
          proyecto_id: a.proyecto_id ? aId(a.proyecto_id) : null,
          proyecto_clave: a.proyecto_clave ? String(a.proyecto_clave) : null,
          referencia: texto(a.referencia)
        }))
      },
      req.usuario?.id ?? null
    );

    // Se devuelve la hoja recargada: los saldos que se muestran después de
    // guardar son los que calculó la base.
    const [proyectos, abonos] = await Promise.all([obtenerProyectos(), obtenerAbonos({})]);
    res.json({ ...resultado, proyectos, abonos });
  } catch (err) {
    if (err.codigo === 'CONFLICTO_CONTROL') {
      return res.status(409).json({ error: err.message });
    }
    responderErrorSql(res, err, 'Error al guardar la hoja de control');
  }
};
