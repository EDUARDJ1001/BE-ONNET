import {
  obtenerPlanillas,
  obtenerPlanillaPorId,
  crearPlanilla,
  actualizarPlanilla,
  cambiarEstadoPlanilla,
  eliminarPlanilla,
  obtenerColaboradoresDePlanilla,
  guardarColaboradoresDePlanilla,
  obtenerLiquidacion
} from '../models/planillaModel.js';
import { aId, aMonto, esFecha, responderErrorSql } from '../utils/validaciones.js';

const ESTADOS = ['abierta', 'cerrada', 'pagada'];

export const obtenerPlanillasController = async (req, res) => {
  const { cuadrilla_id, estado, desde, hasta } = req.query;

  if (cuadrilla_id && !aId(cuadrilla_id)) {
    return res.status(400).json({ error: 'cuadrilla_id inválido' });
  }
  if (estado && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  }
  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ error: 'Fechas inválidas. Use YYYY-MM-DD' });
  }

  try {
    res.json(await obtenerPlanillas({
      cuadrillaId: cuadrilla_id ? aId(cuadrilla_id) : null,
      estado: estado || null,
      desde: desde || null,
      hasta: hasta || null
    }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener las planillas');
  }
};

/** Planilla completa: resumen, integrantes, días y gastos del periodo. */
export const obtenerPlanillaPorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const planilla = await obtenerPlanillaPorId(id);
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json(planilla);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener la planilla');
  }
};

const validarPlanilla = ({ cuadrilla_id, nombre, fecha_inicio, fecha_fin, estado }) => {
  if (!aId(cuadrilla_id)) return 'cuadrilla_id es obligatorio';
  if (!nombre || !nombre.trim()) return 'El nombre de la planilla es obligatorio';
  if (!esFecha(fecha_inicio)) return 'fecha_inicio inválida. Use YYYY-MM-DD';
  if (!esFecha(fecha_fin)) return 'fecha_fin inválida. Use YYYY-MM-DD';
  if (fecha_fin < fecha_inicio) return 'La fecha final no puede ser anterior a la inicial';
  if (estado && !ESTADOS.includes(estado)) return `Estado inválido. Use: ${ESTADOS.join(', ')}`;
  return null;
};

/** Valida la lista de integrantes que puede venir en el alta o en el PUT del roster. */
const validarColaboradores = (colaboradores) => {
  if (!Array.isArray(colaboradores)) return 'Se espera un arreglo "colaboradores"';

  for (const c of colaboradores) {
    if (!aId(c.colaborador_id)) return 'Hay un colaborador_id inválido';
    if (aMonto(c.tarifa_diaria) === null) {
      return `La tarifa diaria del colaborador ${c.colaborador_id} debe ser un número mayor o igual a 0`;
    }
  }

  const ids = colaboradores.map((c) => Number(c.colaborador_id));
  if (new Set(ids).size !== ids.length) return 'Hay colaboradores repetidos en la lista';

  return null;
};

export const crearPlanillaController = async (req, res) => {
  const error = validarPlanilla(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const colaboradores = req.body.colaboradores ?? [];
  const errorColaboradores = validarColaboradores(colaboradores);
  if (errorColaboradores) {
    return res.status(400).json({ error: errorColaboradores });
  }

  try {
    const planilla = await crearPlanilla(
      {
        ...req.body,
        nombre: req.body.nombre.trim(),
        colaboradores: colaboradores.map((c) => ({
          colaborador_id: aId(c.colaborador_id),
          tarifa_diaria: aMonto(c.tarifa_diaria),
          observaciones: c.observaciones ?? null
        }))
      },
      req.usuario?.id ?? null
    );
    res.status(201).json(planilla);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear la planilla');
  }
};

export const actualizarPlanillaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarPlanilla(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const planilla = await actualizarPlanilla(id, { ...req.body, nombre: req.body.nombre.trim() });
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json(planilla);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar la planilla');
  }
};

/** abierta -> cerrada -> pagada. */
export const cambiarEstadoController = async (req, res) => {
  const id = aId(req.params.id);
  const { estado } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  }

  try {
    const resultado = await cambiarEstadoPlanilla(id, estado);
    if (!resultado) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json(resultado);
  } catch (err) {
    responderErrorSql(res, err, 'Error al cambiar el estado de la planilla');
  }
};

export const eliminarPlanillaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarPlanilla(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json({ message: 'Planilla eliminada correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar la planilla');
  }
};

/* ============================
   Integrantes
   ============================ */

export const obtenerColaboradoresController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    res.json(await obtenerColaboradoresDePlanilla(id));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los integrantes de la planilla');
  }
};

/**
 * Reemplaza la lista de integrantes.
 * Si se intenta sacar a alguien que ya tiene días capturados, el modelo lo
 * rechaza: sus jornales quedarían fuera de la liquidación.
 */
export const guardarColaboradoresController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { colaboradores } = req.body;
  const error = validarColaboradores(colaboradores);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const resultado = await guardarColaboradoresDePlanilla(
      id,
      colaboradores.map((c) => ({
        colaborador_id: aId(c.colaborador_id),
        tarifa_diaria: aMonto(c.tarifa_diaria),
        observaciones: c.observaciones ?? null
      }))
    );

    if (!resultado) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    res.json(resultado);
  } catch (err) {
    if (err.codigo === 'COLABORADOR_CON_DIAS') {
      return res.status(409).json({ error: err.message });
    }
    responderErrorSql(res, err, 'Error al guardar los integrantes de la planilla');
  }
};

/* ============================
   Liquidación
   ============================ */

/** Días, devengado, vales, pagado y saldo de cada integrante. */
export const obtenerLiquidacionController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    res.json(await obtenerLiquidacion(id));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener la liquidación');
  }
};
