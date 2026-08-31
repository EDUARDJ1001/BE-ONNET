import {
  obtenerCatalogos,
  obtenerCuadrillas,
  crearCuadrilla,
  actualizarCuadrilla,
  obtenerTiposFibra,
  obtenerCategoriasGasto
} from '../models/catalogoPlanillaModel.js';
import { aId, responderErrorSql } from '../utils/validaciones.js';

/** Cuadrillas, tipos de fibra y categorías de gasto en una sola llamada. */
export const obtenerCatalogosController = async (req, res) => {
  try {
    const catalogos = await obtenerCatalogos();
    res.json(catalogos);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los catálogos');
  }
};

export const obtenerCuadrillasController = async (req, res) => {
  try {
    const incluirInactivas = req.query.todas === 'true';
    const cuadrillas = await obtenerCuadrillas(!incluirInactivas);
    res.json(cuadrillas);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener las cuadrillas');
  }
};

export const crearCuadrillaController = async (req, res) => {
  const { nombre, descripcion = null } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la cuadrilla es obligatorio' });
  }

  try {
    const cuadrilla = await crearCuadrilla({ nombre: nombre.trim(), descripcion });
    res.status(201).json(cuadrilla);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear la cuadrilla');
  }
};

export const actualizarCuadrillaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { nombre, descripcion = null, activo = 1 } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la cuadrilla es obligatorio' });
  }

  try {
    const cuadrilla = await actualizarCuadrilla(id, { nombre: nombre.trim(), descripcion, activo });
    if (!cuadrilla) {
      return res.status(404).json({ error: 'Cuadrilla no encontrada' });
    }
    res.json(cuadrilla);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar la cuadrilla');
  }
};

export const obtenerTiposFibraController = async (req, res) => {
  try {
    res.json(await obtenerTiposFibra());
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los tipos de fibra');
  }
};

export const obtenerCategoriasGastoController = async (req, res) => {
  try {
    res.json(await obtenerCategoriasGasto());
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener las categorías de gasto');
  }
};
