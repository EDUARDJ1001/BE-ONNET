import {
  obtenerUtilidadMensual,
  obtenerUtilidadDiaria,
  obtenerResumenGeneral
} from '../models/utilidadModel.js';
import { esFecha, responderErrorSql } from '../utils/validaciones.js';

/** Tarjetas de la pantalla principal del módulo. */
export const obtenerResumenController = async (req, res) => {
  const { desde, hasta } = req.query;

  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ error: 'Fechas inválidas. Use YYYY-MM-DD' });
  }

  try {
    res.json(await obtenerResumenGeneral({ desde: desde || null, hasta: hasta || null }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el resumen');
  }
};

export const obtenerMensualController = async (req, res) => {
  const anio = req.query.anio ? Number(req.query.anio) : null;

  if (req.query.anio && (!Number.isInteger(anio) || anio < 2000 || anio > 2100)) {
    return res.status(400).json({ error: 'Año inválido' });
  }

  try {
    res.json(await obtenerUtilidadMensual({ anio }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener la utilidad mensual');
  }
};

export const obtenerDiariaController = async (req, res) => {
  const { desde, hasta } = req.query;

  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ error: 'Fechas inválidas. Use YYYY-MM-DD' });
  }

  try {
    res.json(await obtenerUtilidadDiaria({ desde: desde || null, hasta: hasta || null }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener la utilidad diaria');
  }
};
