import {
  obtenerGastosDePlanilla,
  obtenerGastoPorId,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  obtenerGastoPorCategoria
} from '../models/planillaGastoModel.js';
import { aId, aMontoPositivo, esFecha, responderErrorSql } from '../utils/validaciones.js';

/**
 * Gastos de cuadrilla. No confundir con /api/gastos, que es la caja general
 * de la empresa: sumarlos juntos duplica montos.
 */

export const obtenerGastosController = async (req, res) => {
  const planillaId = aId(req.query.planilla_id);
  if (!planillaId) {
    return res.status(400).json({ error: 'planilla_id es obligatorio' });
  }

  try {
    const soloGenerales = req.query.generales === 'true';
    res.json(await obtenerGastosDePlanilla(planillaId, { soloGenerales }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los gastos de la planilla');
  }
};

export const obtenerGastoPorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const gasto = await obtenerGastoPorId(id);
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(gasto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el gasto');
  }
};

const validarGasto = (body, { exigirPlanilla }) => {
  const { planilla_id, planilla_dia_id, categoria_id, monto, fecha } = body;

  if (exigirPlanilla && !aId(planilla_id)) return 'planilla_id es obligatorio';
  if (!aId(categoria_id)) return 'categoria_id es obligatorio';
  if (aMontoPositivo(monto) === null) return 'El monto debe ser un número positivo';
  if (!esFecha(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';
  if (planilla_dia_id !== undefined && planilla_dia_id !== null && !aId(planilla_dia_id)) {
    return 'planilla_dia_id inválido';
  }

  return null;
};

export const crearGastoController = async (req, res) => {
  const error = validarGasto(req.body, { exigirPlanilla: true });
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const gasto = await crearGasto(
      {
        planilla_id: aId(req.body.planilla_id),
        planilla_dia_id: req.body.planilla_dia_id ? aId(req.body.planilla_dia_id) : null,
        categoria_id: aId(req.body.categoria_id),
        descripcion: req.body.descripcion?.trim() || null,
        monto: aMontoPositivo(req.body.monto),
        fecha: req.body.fecha
      },
      req.usuario?.id ?? null
    );
    res.status(201).json(gasto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear el gasto');
  }
};

export const actualizarGastoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarGasto(req.body, { exigirPlanilla: false });
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const gasto = await actualizarGasto(id, {
      planilla_dia_id: req.body.planilla_dia_id ? aId(req.body.planilla_dia_id) : null,
      categoria_id: aId(req.body.categoria_id),
      descripcion: req.body.descripcion?.trim() || null,
      monto: aMontoPositivo(req.body.monto),
      fecha: req.body.fecha
    });
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(gasto);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el gasto');
  }
};

export const eliminarGastoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarGasto(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json({ message: 'Gasto eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el gasto');
  }
};

/** Gasto agrupado por categoría, para la gráfica de la pantalla de utilidad. */
export const obtenerPorCategoriaController = async (req, res) => {
  const { desde, hasta } = req.query;

  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ error: 'Fechas inválidas. Use YYYY-MM-DD' });
  }

  try {
    res.json(await obtenerGastoPorCategoria({ desde: desde || null, hasta: hasta || null }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el gasto por categoría');
  }
};
