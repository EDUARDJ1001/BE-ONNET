import { 
  obtenerPlanes as obtenerPlanesModel, 
  obtenerPlanPorId, 
  crearPlan,
  actualizarPlan,
  eliminarPlan
} from "../models/planModel.js";

export const obtenerPlanes = async (req, res) => {
    try {
        const planes = await obtenerPlanesModel();
        res.status(200).json(planes);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener planes', error});
    }
}

export const obtenerPlanPorIdController = async (req, res) => {
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
    console.error("Error en obtenerPlanPorId:", err);
    res.status(500).json({ error: "Error al obtener el plan" });
  }
};

export const crearPlanController = async (req, res) => {
  try {
    const { nombre, precio_mensual, descripcion } = req.body;
    
    // Validaciones básicas
    if (!nombre || !precio_mensual || !descripcion) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    
    if (isNaN(parseFloat(precio_mensual)) || parseFloat(precio_mensual) <= 0) {
      return res.status(400).json({ error: "El precio debe ser un número positivo" });
    }
    
    const nuevoPlan = await crearPlan({
      nombre,
      precio_mensual: parseFloat(precio_mensual),
      descripcion
    });
    
    res.status(201).json(nuevoPlan);
  } catch (err) {
    console.error("Error en crearPlanController:", err);
    res.status(500).json({ error: "Error al crear el plan" });
  }
};

export const actualizarPlanController = async (req, res) => {
  try {
    const { id } = req.params;
    const planId = Number(id);
    const { nombre, precio_mensual, descripcion } = req.body;
    
    // Validaciones
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    if (!nombre || !precio_mensual || !descripcion) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    
    if (isNaN(parseFloat(precio_mensual)) || parseFloat(precio_mensual) <= 0) {
      return res.status(400).json({ error: "El precio debe ser un número positivo" });
    }
    
    const planActualizado = await actualizarPlan(planId, {
      nombre,
      precio_mensual: parseFloat(precio_mensual),
      descripcion
    });
    
    if (!planActualizado) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }
    
    res.json(planActualizado);
  } catch (err) {
    console.error("Error en actualizarPlanController:", err);
    res.status(500).json({ error: "Error al actualizar el plan" });
  }
};

export const eliminarPlanController = async (req, res) => {
  try {
    const { id } = req.params;
    const planId = Number(id);
    
    // Validación
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    const resultado = await eliminarPlan(planId);
    
    if (!resultado) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }
    
    res.status(200).json({ message: "Plan eliminado correctamente" });
  } catch (err) {
    console.error("Error en eliminarPlanController:", err);
    res.status(500).json({ error: "Error al eliminar el plan" });
  }
};
