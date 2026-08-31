import {
  obtenerVales,
  obtenerValePorId,
  crearVale,
  actualizarVale,
  eliminarVale
} from '../models/valeModel.js';
import { aId, aMontoPositivo, esFecha, responderErrorSql } from '../utils/validaciones.js';

export const obtenerValesController = async (req, res) => {
  const { colaborador_id, planilla_id } = req.query;

  if (colaborador_id && !aId(colaborador_id)) {
    return res.status(400).json({ error: 'colaborador_id inválido' });
  }
  if (planilla_id && !aId(planilla_id)) {
    return res.status(400).json({ error: 'planilla_id inválido' });
  }

  try {
    res.json(await obtenerVales({
      colaboradorId: colaborador_id ? aId(colaborador_id) : null,
      planillaId: planilla_id ? aId(planilla_id) : null
    }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los vales');
  }
};

export const obtenerValePorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const vale = await obtenerValePorId(id);
    if (!vale) {
      return res.status(404).json({ error: 'Vale no encontrado' });
    }
    res.json(vale);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el vale');
  }
};

const validarVale = ({ colaborador_id, planilla_id, monto, fecha }) => {
  if (!aId(colaborador_id)) return 'colaborador_id es obligatorio';
  if (aMontoPositivo(monto) === null) return 'El monto debe ser un número positivo';
  if (!esFecha(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';
  if (planilla_id !== undefined && planilla_id !== null && !aId(planilla_id)) {
    return 'planilla_id inválido';
  }
  return null;
};

/**
 * El vale se descuenta de la liquidación de la planilla que se indique. Sin
 * planilla_id queda como adelanto suelto: aparece en el estado de cuenta del
 * colaborador pero no rebaja ninguna liquidación.
 */
export const crearValeController = async (req, res) => {
  const error = validarVale(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const vale = await crearVale(
      {
        colaborador_id: aId(req.body.colaborador_id),
        planilla_id: req.body.planilla_id ? aId(req.body.planilla_id) : null,
        fecha: req.body.fecha,
        monto: aMontoPositivo(req.body.monto),
        descripcion: req.body.descripcion?.trim() || null
      },
      req.usuario?.id ?? null
    );
    res.status(201).json(vale);
  } catch (err) {
    responderErrorSql(res, err, 'Error al registrar el vale');
  }
};

export const actualizarValeController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarVale(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const vale = await actualizarVale(id, {
      colaborador_id: aId(req.body.colaborador_id),
      planilla_id: req.body.planilla_id ? aId(req.body.planilla_id) : null,
      fecha: req.body.fecha,
      monto: aMontoPositivo(req.body.monto),
      descripcion: req.body.descripcion?.trim() || null
    });
    if (!vale) {
      return res.status(404).json({ error: 'Vale no encontrado' });
    }
    res.json(vale);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el vale');
  }
};

export const eliminarValeController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await eliminarVale(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Vale no encontrado' });
    }
    res.json({ message: 'Vale eliminado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al eliminar el vale');
  }
};
