import {
  obtenerPagos,
  obtenerPagoPorId,
  crearPago,
  actualizarPago,
  eliminarPago,
  obtenerPagosDesfasados
} from '../models/colaboradorPagoModel.js';
import { aId, aMontoPositivo, esFecha, responderErrorSql } from '../utils/validaciones.js';

export const obtenerPagosController = async (req, res) => {
  const { colaborador_id, planilla_id, desde, hasta } = req.query;

  if (colaborador_id && !aId(colaborador_id)) {
    return res.status(400).json({ error: 'colaborador_id inválido' });
  }
  if (planilla_id && !aId(planilla_id)) {
    return res.status(400).json({ error: 'planilla_id inválido' });
  }
  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ error: 'Fechas inválidas. Use YYYY-MM-DD' });
  }

  try {
    res.json(await obtenerPagos({
      colaboradorId: colaborador_id ? aId(colaborador_id) : null,
      planillaId: planilla_id ? aId(planilla_id) : null,
      desde: desde || null,
      hasta: hasta || null
    }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los pagos');
  }
};

export const obtenerPagoPorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const pago = await obtenerPagoPorId(id);
    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(pago);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el pago');
  }
};

const validarPago = ({ colaborador_id, planilla_id, monto, fecha_pago, metodo_id }) => {
  if (!aId(colaborador_id)) return 'colaborador_id es obligatorio';
  if (aMontoPositivo(monto) === null) return 'El monto debe ser un número positivo';
  if (!esFecha(fecha_pago)) return 'Formato de fecha_pago inválido. Use YYYY-MM-DD';
  if (planilla_id !== undefined && planilla_id !== null && !aId(planilla_id)) {
    return 'planilla_id inválido';
  }
  if (metodo_id !== undefined && metodo_id !== null && !aId(metodo_id)) {
    return 'metodo_id inválido';
  }
  return null;
};

/**
 * Registra el pago entregado.
 *
 * `fecha_registro` no se recibe ni se envía: la pone la base de datos. Es lo
 * único que permite detectar después un comprobante fechado en otro mes.
 * `creado_por` sale del token, no del cuerpo de la petición.
 */
export const crearPagoController = async (req, res) => {
  const error = validarPago(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const pago = await crearPago(
      {
        colaborador_id: aId(req.body.colaborador_id),
        planilla_id: req.body.planilla_id ? aId(req.body.planilla_id) : null,
        monto: aMontoPositivo(req.body.monto),
        fecha_pago: req.body.fecha_pago,
        metodo_id: req.body.metodo_id ? aId(req.body.metodo_id) : null,
        referencia: req.body.referencia?.trim() || null,
        observacion: req.body.observacion?.trim() || null
      },
      req.usuario?.id ?? null
    );
    res.status(201).json(pago);
  } catch (err) {
    responderErrorSql(res, err, 'Error al registrar el pago');
  }
};

export const actualizarPagoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarPago(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const pago = await actualizarPago(id, {
      planilla_id: req.body.planilla_id ? aId(req.body.planilla_id) : null,
      monto: aMontoPositivo(req.body.monto),
      fecha_pago: req.body.fecha_pago,
      metodo_id: req.body.metodo_id ? aId(req.body.metodo_id) : null,
      referencia: req.body.referencia?.trim() || null,
      observacion: req.body.observacion?.trim() || null
    });
    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(pago);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el pago');
  }
};

export const eliminarPagoController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarPago(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json({ message: 'Pago eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el pago');
  }
};

/**
 * Pagos cuyo comprobante está fechado lejos de cuándo se capturaron.
 * Es la consulta de control del cierre. Lo normal es que salga vacía.
 */
export const obtenerDesfasadosController = async (req, res) => {
  const dias = req.query.dias ? Number(req.query.dias) : 7;

  if (!Number.isFinite(dias) || dias < 0) {
    return res.status(400).json({ error: 'El parámetro "dias" debe ser un número mayor o igual a 0' });
  }

  try {
    res.json(await obtenerPagosDesfasados(dias));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los pagos desfasados');
  }
};
