import {
  obtenerModulos,
  obtenerModulosPorCargo,
  asignarCargosAModulo
} from '../models/moduloModel.js';
import { aId, responderErrorSql } from '../utils/validaciones.js';

/**
 * Módulos del usuario que hace la petición. El frontend arma el menú con esto,
 * así no lleva el cargo_id escrito en el código.
 */
export const obtenerMisModulos = async (req, res) => {
  try {
    const modulos = await obtenerModulosPorCargo(req.usuario.cargoId);
    res.json(modulos);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los módulos del usuario');
  }
};

export const obtenerModulosController = async (req, res) => {
  try {
    const modulos = await obtenerModulos();
    res.json(modulos);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los módulos');
  }
};

export const asignarCargosController = async (req, res) => {
  const moduloId = aId(req.params.id);
  if (!moduloId) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { cargos } = req.body;
  if (!Array.isArray(cargos)) {
    return res.status(400).json({ error: 'Se espera un arreglo "cargos" con los ids de cargo' });
  }

  const cargoIds = cargos.map(aId);
  if (cargoIds.some((id) => id === null)) {
    return res.status(400).json({ error: 'Hay ids de cargo inválidos' });
  }

  try {
    const resultado = await asignarCargosAModulo(moduloId, cargoIds);
    if (!resultado) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }
    res.json(resultado);
  } catch (err) {
    responderErrorSql(res, err, 'Error al asignar cargos al módulo');
  }
};
