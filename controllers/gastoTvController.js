import { 
  obtenerGastosTv as obtenerGastosTvModel, 
  obtenerGastoTvPorId, 
  crearGastoTv,
  actualizarGastoTv,
  eliminarGastoTv
} from "../models/gastoTvModel.js";

export const obtenerGastosTv = async (req, res) => {
    try {
        const gastos = await obtenerGastosTvModel();
        res.status(200).json(gastos);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener gastos', error});
    }
}

export const obtenerGastoTvPorIdController = async (req, res) => {
  const { id } = req.params;
  const gastoId = Number(id);

  if (!Number.isInteger(gastoId) || gastoId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const gasto = await obtenerGastoTvPorId(gastoId);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }
    res.json(gasto);
  } catch (err) {
    console.error("Error en obtenerGastoPorId:", err);
    res.status(500).json({ error: "Error al obtener el gasto" });
  }
};

export const crearGastoTvController = async (req, res) => {
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
    
    const nuevoGasto = await crearGastoTv({
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

export const actualizarGastoTvController = async (req, res) => {
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
    
    const gastoActualizado = await actualizarGastoTv(gastoId, {
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

export const eliminarGastoTvController = async (req, res) => {
  try {
    const { id } = req.params;
    const gastoId = Number(id);
    
    // Validación
    if (!Number.isInteger(gastoId) || gastoId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    
    const resultado = await eliminarGastoTv(gastoId);
    
    if (!resultado) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }
    
    res.status(200).json({ message: "Gasto eliminado correctamente" });
  } catch (err) {
    console.error("Error en eliminarGastoController:", err);
    res.status(500).json({ error: "Error al eliminar el gasto" });
  }
};
