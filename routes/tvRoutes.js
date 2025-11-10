import express from "express";
import {
  // Planes
  getPlanesTV,
  getPlanTVById,
  postPlanTV,
  putPlanTV,
  deletePlanTV,
  // Estados
  getEstadosClientesTV,
  getEstadoClienteTVById,
  postEstadoClienteTV,
  putEstadoClienteTV,
  deleteEstadoClienteTV,
  // Clientes
  getClientesTV,
  getClienteTVById,
  getClienteTVPorUsuario,
  getClientesProximosAVencer,
  postClienteTV,
  putClienteTV,
  deleteClienteTV,
  // Dispositivos
  getDispositivosPorCliente,
  getDispositivoTVById,
  postDispositivoTV,
  putDispositivoTV,
  deleteDispositivoTV,
  // Extra
  getDispositivoPorMAC
} from "../controllers/tvController.js";

const router = express.Router();

/** =========================
 *  PLANES TV
 *  Base: /api/tv/planes
 *  ========================= */
router.get("/planes", getPlanesTV);
router.get("/planes/:id", getPlanTVById);
router.post("/planes", postPlanTV);
router.put("/planes/:id", putPlanTV);
router.delete("/planes/:id", deletePlanTV);

/** =========================
 *  ESTADOS CLIENTES
 *  Base: /api/tv/estados
 *  ========================= */
router.get("/estados", getEstadosClientesTV);
router.get("/estados/:id", getEstadoClienteTVById);
router.post("/estados", postEstadoClienteTV);
router.put("/estados/:id", putEstadoClienteTV);
router.delete("/estados/:id", deleteEstadoClienteTV);

/** =========================
 *  CLIENTES TV
 *  Base: /api/tv/clientes
 *  Query opcionales: ?estado_id=1&plantv_id=2&search=texto
 *  ========================= */
router.get("/clientes", getClientesTV);
router.get("/clientes/:id", getClienteTVById);
router.get("/clientes/usuario/:usuario", getClienteTVPorUsuario);
router.get("/clientes/vencimientos/proximos", getClientesProximosAVencer);
router.post("/clientes", postClienteTV);
router.put("/clientes/:id", putClienteTV);
router.delete("/clientes/:id", deleteClienteTV);

/** =========================
 *  DISPOSITIVOS TV
 *  Base: /api/tv/dispositivos
 *  ========================= */
router.get("/dispositivos/by-cliente/:cliente_id", getDispositivosPorCliente);
router.get("/dispositivos/:id", getDispositivoTVById);
router.post("/dispositivos", postDispositivoTV);
router.put("/dispositivos/:id", putDispositivoTV);
router.delete("/dispositivos/:id", deleteDispositivoTV);

/** Extra: buscar por MAC */
router.get("/dispositivos", getDispositivoPorMAC);

export default router;
