import {
  obtenerDiasDePlanilla,
  obtenerDiaPorId,
  crearDia,
  actualizarDia,
  eliminarDia,
  sugerirIngreso
} from '../models/planillaDiaModel.js';
import { obtenerPlanillaPorId } from '../models/planillaModel.js';
import {
  aId,
  aMonto,
  aCantidad,
  esFecha,
  responderErrorSql
} from '../utils/validaciones.js';

const ESTADOS_DIA = ['trabajado', 'no_trabajado', 'descanso', 'feriado'];

export const obtenerDiasController = async (req, res) => {
  const planillaId = aId(req.params.id);
  if (!planillaId) {
    return res.status(400).json({ error: 'ID de planilla inválido' });
  }

  try {
    res.json(await obtenerDiasDePlanilla(planillaId));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los días de la planilla');
  }
};

export const obtenerDiaPorIdController = async (req, res) => {
  const id = aId(req.params.diaId);
  if (!id) {
    return res.status(400).json({ error: 'ID de día inválido' });
  }

  try {
    const dia = await obtenerDiaPorId(id);
    if (!dia) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }
    res.json(dia);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el día');
  }
};

/**
 * Valida el día y sus pagos.
 *
 * El jornal se valida con aMonto (permite 0) y no con aMontoPositivo: un
 * colaborador puede haber ido sin cobrar ese día, y el Excel no distinguía ese
 * caso del "no vino". Aquí sí, con el campo `asistio`.
 */
const validarDia = (body, planilla) => {
  const { fecha, estado, colaboradores = [], gastos = [] } = body;

  if (!esFecha(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';

  if (planilla && (fecha < planilla.fecha_inicio || fecha > planilla.fecha_fin)) {
    return `La fecha ${fecha} está fuera del periodo de la planilla (${planilla.fecha_inicio} a ${planilla.fecha_fin})`;
  }

  if (estado && !ESTADOS_DIA.includes(estado)) {
    return `Estado inválido. Use: ${ESTADOS_DIA.join(', ')}`;
  }

  for (const campo of ['tarifa_instalacion', 'metros_fibra', 'punta_inicial', 'punta_final', 'tarifa_metro', 'bono_onnet', 'ingreso']) {
    if (body[campo] !== undefined && aMonto(body[campo]) === null) {
      return `${campo} debe ser un número mayor o igual a 0`;
    }
  }

  if (body.instalaciones !== undefined && aCantidad(body.instalaciones) === null) {
    return 'instalaciones debe ser un número entero mayor o igual a 0';
  }

  if (!Array.isArray(colaboradores)) return 'Se espera un arreglo "colaboradores"';

  for (const c of colaboradores) {
    if (!aId(c.colaborador_id)) return 'Hay un colaborador_id inválido';
    if (c.monto !== undefined && aMonto(c.monto) === null) {
      return `El monto del colaborador ${c.colaborador_id} debe ser un número mayor o igual a 0`;
    }
    if (c.bono !== undefined && aMonto(c.bono) === null) {
      return `El bono del colaborador ${c.colaborador_id} debe ser un número mayor o igual a 0`;
    }
  }

  const ids = colaboradores.map((c) => Number(c.colaborador_id));
  if (new Set(ids).size !== ids.length) return 'Hay colaboradores repetidos en el día';

  if (!Array.isArray(gastos)) return 'Se espera un arreglo "gastos"';

  for (const g of gastos) {
    if (!aId(g.categoria_id)) return 'Hay una categoría de gasto inválida';
    if (aMonto(g.monto) === null || Number(g.monto) <= 0) {
      return 'Los gastos deben tener un monto positivo';
    }
    if (g.fecha && !esFecha(g.fecha)) return 'Hay un gasto con fecha inválida';
  }

  return null;
};

/** Normaliza el cuerpo antes de mandarlo al modelo. */
const normalizarDia = (body) => ({
  fecha: body.fecha,
  proyecto_id: body.proyecto_id ? aId(body.proyecto_id) : null,
  sector: body.sector?.trim() || null,
  trabajo_realizado: body.trabajo_realizado?.trim() || null,
  estado: body.estado || 'trabajado',
  instalaciones: aCantidad(body.instalaciones),
  tarifa_instalacion: aMonto(body.tarifa_instalacion) ?? 0,
  metros_fibra: aMonto(body.metros_fibra) ?? 0,
  punta_inicial: aMonto(body.punta_inicial) ?? 0,
  punta_final: aMonto(body.punta_final) ?? 0,
  tarifa_metro: aMonto(body.tarifa_metro) ?? 0,
  tipo_fibra_id: body.tipo_fibra_id ? aId(body.tipo_fibra_id) : null,
  bono_onnet: aMonto(body.bono_onnet) ?? 0,
  ingreso: aMonto(body.ingreso) ?? 0,
  observaciones: body.observaciones?.trim() || null,
  colaboradores: (body.colaboradores ?? []).map((c) => ({
    colaborador_id: aId(c.colaborador_id),
    asistio: c.asistio,
    monto: aMonto(c.monto) ?? 0,
    bono: aMonto(c.bono) ?? 0,
    observacion: c.observacion ?? null
  })),
  gastos: (body.gastos ?? []).map((g) => ({
    categoria_id: aId(g.categoria_id),
    descripcion: g.descripcion?.trim() || null,
    monto: aMonto(g.monto),
    fecha: g.fecha || body.fecha
  }))
});

export const crearDiaController = async (req, res) => {
  const planillaId = aId(req.params.id);
  if (!planillaId) {
    return res.status(400).json({ error: 'ID de planilla inválido' });
  }

  try {
    const planilla = await obtenerPlanillaPorId(planillaId);
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }

    // Una planilla ya pagada no admite días nuevos: cambiaría una liquidación
    // que el colaborador ya cobró y firmó.
    if (planilla.estado === 'pagada') {
      return res.status(409).json({ error: 'La planilla ya está pagada. Reábrala para modificarla.' });
    }

    const error = validarDia(req.body, planilla);
    if (error) {
      return res.status(400).json({ error });
    }

    const dia = await crearDia(planillaId, normalizarDia(req.body), req.usuario?.id ?? null);
    res.status(201).json(dia);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear el día de la planilla');
  }
};

export const actualizarDiaController = async (req, res) => {
  const planillaId = aId(req.params.id);
  const diaId = aId(req.params.diaId);

  if (!planillaId || !diaId) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const planilla = await obtenerPlanillaPorId(planillaId);
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    if (planilla.estado === 'pagada') {
      return res.status(409).json({ error: 'La planilla ya está pagada. Reábrala para modificarla.' });
    }

    const error = validarDia(req.body, planilla);
    if (error) {
      return res.status(400).json({ error });
    }

    const dia = await actualizarDia(diaId, normalizarDia(req.body));
    if (!dia) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }
    res.json(dia);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el día de la planilla');
  }
};

export const eliminarDiaController = async (req, res) => {
  const diaId = aId(req.params.diaId);
  if (!diaId) {
    return res.status(400).json({ error: 'ID de día inválido' });
  }

  try {
    const resultado = await eliminarDia(diaId);
    if (!resultado) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }
    res.json({ message: 'Día eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el día');
  }
};

/**
 * Propone el valor de "entrada" a partir de metros e instalaciones.
 * Es una sugerencia: la fórmula cambia según el trabajo, así que el número que
 * manda es el que el administrador guarde en `ingreso`.
 */
export const sugerirIngresoController = (req, res) => {
  try {
    res.json({ ingreso_sugerido: sugerirIngreso(req.body) });
  } catch (err) {
    console.error('Error al calcular el ingreso sugerido:', err);
    res.status(400).json({ error: 'No se pudo calcular el ingreso sugerido' });
  }
};
