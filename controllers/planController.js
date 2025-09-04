import { obtenerPlanes as obtenerPlanesModel, obtenerPlanPorId } from "../models/planModel.js";

export const obtenerPlanes = async (req, res) => {
    try {
        const planes = await obtenerPlanesModel();
        res.status(200).json(planes);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener planes', error});
    }
}

export const obtenerPlanesPorId = async (req, res) => {
  const { id } = req.params;
  const planId = Number(id);

  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const plan = await obtenerPlanPorId(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }
    res.json(plan);
  } catch (err) {
    console.error("Error en obtenerPlanesPorId:", err);
    res.status(500).json({ error: "Error al obtener el plan" });
  }
};
