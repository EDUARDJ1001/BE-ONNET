import {
  // Planes
  obtenerPlanesTV,
  obtenerPlanTVPorId,
  crearPlanTV,
  actualizarPlanTV,
  eliminarPlanTV,
  // Estados
  obtenerEstadosClientesTV,
  obtenerEstadoClienteTVPorId,
  crearEstadoClienteTV,
  actualizarEstadoClienteTV,
  eliminarEstadoClienteTV,
  // Clientes
  obtenerClientesTV,
  obtenerClienteTVPorId,
  crearClienteTV,
  actualizarClienteTV,
  eliminarClienteTV,
  // Dispositivos
  obtenerDispositivosPorCliente,
  obtenerDispositivoTVPorId,
  crearDispositivoTV,
  actualizarDispositivoTV,
  eliminarDispositivoTV,
  obtenerDispositivoPorMAC
} from "../models/tvModel.js";

/** =========================
 *  PLANES TV
 *  ========================= */
export const getPlanesTV = async (_req, res) => {
  try {
    const data = await obtenerPlanesTV();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener planes TV", error: e.message });
  }
};

export const getPlanTVById = async (req, res) => {
  try {
    const plan = await obtenerPlanTVPorId(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan no encontrado" });
    res.status(200).json(plan);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener plan TV", error: e.message });
  }
};

export const postPlanTV = async (req, res) => {
  try {
    const id = await crearPlanTV(req.body);
    res.status(201).json({ message: "Plan creado", id });
  } catch (e) {
    res.status(500).json({ message: "Error al crear plan TV", error: e.message });
  }
};

export const putPlanTV = async (req, res) => {
  try {
    const ok = await actualizarPlanTV(req.params.id, req.body);
    if (!ok) return res.status(404).json({ message: "Plan no encontrado" });
    res.status(200).json({ message: "Plan actualizado" });
  } catch (e) {
    res.status(500).json({ message: "Error al actualizar plan TV", error: e.message });
  }
};

export const deletePlanTV = async (req, res) => {
  try {
    const ok = await eliminarPlanTV(req.params.id);
    if (!ok) return res.status(404).json({ message: "Plan no encontrado" });
    res.status(200).json({ message: "Plan eliminado" });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar plan TV", error: e.message });
  }
};

/** ==============================
 *  ESTADOS CLIENTES
 *  ============================== */
export const getEstadosClientesTV = async (_req, res) => {
  try {
    const data = await obtenerEstadosClientesTV();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener estados", error: e.message });
  }
};

export const getEstadoClienteTVById = async (req, res) => {
  try {
    const est = await obtenerEstadoClienteTVPorId(req.params.id);
    if (!est) return res.status(404).json({ message: "Estado no encontrado" });
    res.status(200).json(est);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener estado", error: e.message });
  }
};

export const postEstadoClienteTV = async (req, res) => {
  try {
    const id = await crearEstadoClienteTV(req.body);
    res.status(201).json({ message: "Estado creado", id });
  } catch (e) {
    res.status(500).json({ message: "Error al crear estado", error: e.message });
  }
};

export const putEstadoClienteTV = async (req, res) => {
  try {
    const ok = await actualizarEstadoClienteTV(req.params.id, req.body);
    if (!ok) return res.status(404).json({ message: "Estado no encontrado" });
    res.status(200).json({ message: "Estado actualizado" });
  } catch (e) {
    res.status(500).json({ message: "Error al actualizar estado", error: e.message });
  }
};

export const deleteEstadoClienteTV = async (req, res) => {
  try {
    const ok = await eliminarEstadoClienteTV(req.params.id);
    if (!ok) return res.status(404).json({ message: "Estado no encontrado" });
    res.status(200).json({ message: "Estado eliminado" });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar estado", error: e.message });
  }
};

/** =========================
 *  CLIENTES TV
 *  ========================= */
export const getClientesTV = async (req, res) => {
  try {
    const { estado_id, plantv_id, search } = req.query;
    const data = await obtenerClientesTV({
      estado_id: estado_id ? Number(estado_id) : undefined,
      plantv_id: plantv_id ? Number(plantv_id) : undefined,
      search: search || undefined
    });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener clientes", error: e.message });
  }
};

export const getClienteTVById = async (req, res) => {
  try {
    const cli = await obtenerClienteTVPorId(req.params.id);
    if (!cli) return res.status(404).json({ message: "Cliente no encontrado" });
    res.status(200).json(cli);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener cliente", error: e.message });
  }
};

export const postClienteTV = async (req, res) => {
  try {
    const id = await crearClienteTV(req.body);
    res.status(201).json({ message: "Cliente creado", id });
  } catch (e) {
    res.status(500).json({ message: "Error al crear cliente", error: e.message });
  }
};

export const putClienteTV = async (req, res) => {
  try {
    const ok = await actualizarClienteTV(req.params.id, req.body);
    if (!ok) return res.status(404).json({ message: "Cliente no encontrado" });
    res.status(200).json({ message: "Cliente actualizado" });
  } catch (e) {
    res.status(500).json({ message: "Error al actualizar cliente", error: e.message });
  }
};

export const deleteClienteTV = async (req, res) => {
  try {
    const ok = await eliminarClienteTV(req.params.id);
    if (!ok) return res.status(404).json({ message: "Cliente no encontrado" });
    res.status(200).json({ message: "Cliente eliminado" });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar cliente", error: e.message });
  }
};

/** =================================
 *  DISPOSITIVOS TV
 *  ================================= */
export const getDispositivosPorCliente = async (req, res) => {
  try {
    const dispositivos = await obtenerDispositivosPorCliente(req.params.cliente_id);
    res.status(200).json(dispositivos);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener dispositivos", error: e.message });
  }
};

export const getDispositivoTVById = async (req, res) => {
  try {
    const disp = await obtenerDispositivoTVPorId(req.params.id);
    if (!disp) return res.status(404).json({ message: "Dispositivo no encontrado" });
    res.status(200).json(disp);
  } catch (e) {
    res.status(500).json({ message: "Error al obtener dispositivo", error: e.message });
  }
};

export const postDispositivoTV = async (req, res) => {
  try {
    const id = await crearDispositivoTV(req.body);
    res.status(201).json({ message: "Dispositivo creado", id });
  } catch (e) {
    res.status(500).json({ message: "Error al crear dispositivo", error: e.message });
  }
};

export const putDispositivoTV = async (req, res) => {
  try {
    const ok = await actualizarDispositivoTV(req.params.id, req.body);
    if (!ok) return res.status(404).json({ message: "Dispositivo no encontrado" });
    res.status(200).json({ message: "Dispositivo actualizado" });
  } catch (e) {
    res.status(500).json({ message: "Error al actualizar dispositivo", error: e.message });
  }
};

export const deleteDispositivoTV = async (req, res) => {
  try {
    const ok = await eliminarDispositivoTV(req.params.id);
    if (!ok) return res.status(404).json({ message: "Dispositivo no encontrado" });
    res.status(200).json({ message: "Dispositivo eliminado" });
  } catch (e) {
    res.status(500).json({ message: "Error al eliminar dispositivo", error: e.message });
  }
};

/** Opcional: validar si existe MAC ya registrada */
export const getDispositivoPorMAC = async (req, res) => {
  try {
    const { mac } = req.query;
    if (!mac) return res.status(400).json({ message: "Parámetro mac requerido" });
    const disp = await obtenerDispositivoPorMAC(mac);
    if (!disp) return res.status(404).json({ message: "No existe dispositivo con esa MAC" });
    res.status(200).json(disp);
  } catch (e) {
    res.status(500).json({ message: "Error al buscar por MAC", error: e.message });
  }
};
