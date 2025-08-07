import { obtenerCargos as obtenerCargosModel } from "../models/cargoModel.js";

export const obtenerCargos = async (req, res) => {
    try {
        const cargos = await obtenerCargosModel();
        res.status(200).json(cargos);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cargos', error});
    }
}