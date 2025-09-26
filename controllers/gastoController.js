import { 
  obtenerGastos as obtenerGastosModel, 
  obtenerGastoPorId, 
  crearGasto,
  actualizarGasto,
  eliminarGasto
} from "../models/gastoModel.js";

export const obtenerGastos = async (req, res) => {
    try {
        const gastos = await obtenerGastosModel();
        res.status(200).json(gastos);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener gastos', error});
    }
}

export const obtenerGastoPorIdController = async (req, res) => {
  const { id } = req.params;
  const gastoId = Number(id);

  if (!Number.isInteger(gastoId) || gastoId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const gasto = await obtenerGastoPorId(gastoId);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }
    res.json(gasto);
  } catch (err) {
    console.error("Error en obtenerGastoPorId:", err);
    res.status(500).json({ error: "Error al obtener el gasto" });
  }
};

export const crearGastoController = async (req, res) => {
  try {
    const { descripcion, monto, fecha } = req.body;
    
    // Validaciones básicas
    if (!descripcion || monto === undefined || !fecha) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    
    if (isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: "El monto debe ser un número positivo" });
    }
    
    // Validar formato de fecha (YYYY-MM-DD)
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" });
    }
    
    const nuevoGasto = await crearGasto({
      descripcion,
      monto: parseFloat(monto),
      fecha
    });
    
    res.status(201).json(nuevoGasto);
  } catch (err) {
    console.error("Error en crearGastoController:", err);
    res.status(500).json({ error: "Error al crear el gasto" });
  }
};

export const actualizarGastoController = async (req, res) => {
  try {
    const { id } = req.params;
    const gastoId = Number(id);
    const { descripcion, monto, fecha } = req.body;
    
    // Validaciones
    if (!Number.isInteger(gastoId) || gastoId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    if (!descripcion || monto === undefined || !fecha) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    
    if (isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: "El monto debe ser un número positivo" });
    }
    
    // Validar formato de fecha
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" });
    }
    
    const gastoActualizado = await actualizarGasto(gastoId, {
      descripcion,
      monto: parseFloat(monto),
      fecha
    });
    
    if (!gastoActualizado) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }
    
    res.json(gastoActualizado);
  } catch (err) {
    console.error("Error en actualizarGastoController:", err);
    res.status(500).json({ error: "Error al actualizar el gasto" });
  }
};

export const eliminarGastoController = async (req, res) => {
  try {
    const { id } = req.params;
    const gastoId = Number(id);
    
    // Validación
    if (!Number.isInteger(gastoId) || gastoId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    const resultado = await eliminarGasto(gastoId);
    
    if (!resultado) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }
    
    res.status(200).json({ message: "Gasto eliminado correctamente" });
  } catch (err) {
    console.error("Error en eliminarGastoController:", err);
    res.status(500).json({ error: "Error al eliminar el gasto" });
  }
};
