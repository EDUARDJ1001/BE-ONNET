import { obtenerTiposServicio as obtenerTiposServicioModel } from '../models/tipoServicioModel.js';

export const obtenerTiposServicio = async (_req, res) => {
  try {
    const tiposServicio = await obtenerTiposServicioModel();
    res.status(200).json(tiposServicio);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tipos de servicio', error });
  }
};

