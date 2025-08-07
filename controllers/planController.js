import { obtenerPlanes as obtenerPlanesModel } from "../models/planModel.js";

export const obtenerPlanes = async (req, res) => {
    try {
        const planes = await obtenerPlanesModel();
        res.status(200).json(planes);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener planes', error});
    }
}
