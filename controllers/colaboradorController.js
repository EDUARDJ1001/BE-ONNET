import {
  obtenerColaboradores,
  obtenerColaboradorPorId,
  crearColaborador,
  actualizarColaborador,
  desactivarColaborador,
  obtenerSaldos,
  obtenerEstadoCuenta
} from '../models/colaboradorModel.js';
import { aId, aMonto, responderErrorSql } from '../utils/validaciones.js';

export const obtenerColaboradoresController = async (req, res) => {
  try {
    const soloActivos = req.query.activos === 'true';
    res.json(await obtenerColaboradores({ soloActivos }));
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los colaboradores');
  }
};

/** Devengado, vales, pagado y saldo de todos. Es la pantalla de "a quién le debo". */
export const obtenerSaldosController = async (req, res) => {
  try {
    res.json(await obtenerSaldos());
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener los saldos');
  }
};

export const obtenerColaboradorPorIdController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const colaborador = await obtenerColaboradorPorId(id);
    if (!colaborador) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    res.json(colaborador);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el colaborador');
  }
};

/** Saldo + liquidación por planilla + vales + pagos de una persona. */
export const obtenerEstadoCuentaController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const estado = await obtenerEstadoCuenta(id);
    if (!estado) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    res.json(estado);
  } catch (err) {
    responderErrorSql(res, err, 'Error al obtener el estado de cuenta');
  }
};

const validarDatos = (body) => {
  const { nombre, tarifa_diaria } = body;

  if (!nombre || !nombre.trim()) {
    return 'El nombre es obligatorio';
  }

  if (tarifa_diaria !== undefined && aMonto(tarifa_diaria) === null) {
    return 'La tarifa diaria debe ser un número mayor o igual a 0';
  }

  return null;
};

export const crearColaboradorController = async (req, res) => {
  const error = validarDatos(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const colaborador = await crearColaborador({
      ...req.body,
      nombre: req.body.nombre.trim(),
      alias: req.body.alias?.trim() || null,
      tarifa_diaria: aMonto(req.body.tarifa_diaria) ?? 500,
      usuario_id: req.body.usuario_id ? aId(req.body.usuario_id) : null
    });
    res.status(201).json(colaborador);
  } catch (err) {
    responderErrorSql(res, err, 'Error al crear el colaborador');
  }
};

export const actualizarColaboradorController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const error = validarDatos(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const colaborador = await actualizarColaborador(id, {
      ...req.body,
      nombre: req.body.nombre.trim(),
      alias: req.body.alias?.trim() || null,
      tarifa_diaria: aMonto(req.body.tarifa_diaria) ?? 500,
      usuario_id: req.body.usuario_id ? aId(req.body.usuario_id) : null
    });
    if (!colaborador) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    res.json(colaborador);
  } catch (err) {
    responderErrorSql(res, err, 'Error al actualizar el colaborador');
  }
};

/**
 * Baja lógica, no borrado. Si tiene días trabajados, borrarlo dejaría la
 * planilla sin cuadrar; el FK lo impide y aquí ni siquiera se intenta.
 */
export const desactivarColaboradorController = async (req, res) => {
  const id = aId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const resultado = await desactivarColaborador(id);
    if (!resultado) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    res.json({ message: 'Colaborador desactivado correctamente' });
  } catch (err) {
    responderErrorSql(res, err, 'Error al desactivar el colaborador');
  }
};
