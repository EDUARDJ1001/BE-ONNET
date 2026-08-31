import authRoutes from './authRoutes.js';
import cargoRoutes from './cargoRoutes.js';
import catalogoPlanillaRoutes from './catalogoPlanillaRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import colaboradorRoutes from './colaboradorRoutes.js';
import colaboradorPagoRoutes from './colaboradorPagoRoutes.js';
import estadoMensualRoutes from './estadoMensualRoutes.js';
import estadoMensualTvRoutes from './estadoMensualTvRoutes.js';
import gastoRoutes from './gastoRoutes.js';
import gastoTvRoutes from './gastoTvRoutes.js';
import intervencionTecnicaRoutes from './intervencionTecnicaRoutes.js';
import metodosPagoRoutes from './metodosPagoRoutes.js';
import moduloRoutes from './moduloRoutes.js';
import pagoRoutes from './pagoRoutes.js';
import pagoTvRoutes from './pagoTvRoutes.js';
import planRoutes from './planRoutes.js';
import planillaRoutes from './planillaRoutes.js';
import planillaGastoRoutes from './planillaGastoRoutes.js';
import proyectoRoutes from './proyectoRoutes.js';
import tipoServicioRoutes from './tipoServicioRoutes.js';
import tvRoutes from './tvRoutes.js';
import userRoutes from './userRoutes.js';
import utilidadRoutes from './utilidadRoutes.js';
import valeRoutes from './valeRoutes.js';

const registerRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/cargos', cargoRoutes);
    app.use('/api/clientes', clienteRoutes);
    app.use('/api/estado-mensual', estadoMensualRoutes);
    app.use('/api/estado-mensual-tv', estadoMensualTvRoutes);
    app.use('/api/gastos', gastoRoutes);
    app.use('/api/gastos-tv', gastoTvRoutes);
    app.use('/api/intervenciones-tecnicas', intervencionTecnicaRoutes);
    app.use('/api/metodos-pago', metodosPagoRoutes);
    app.use('/api/pagos', pagoRoutes);
    app.use('/api/pagos-tv', pagoTvRoutes);
    app.use('/api/planes', planRoutes);
    app.use('/api/tipo_servicios', tipoServicioRoutes);
    app.use('/api/tv', tvRoutes);
    app.use('/api/users', userRoutes);

    // Módulo de planillas de campo. Todo esto exige token y permiso de módulo
    // (cargo_modulo); hoy sólo lo tiene el cargo 1, Administrador.
    app.use('/api/modulos', moduloRoutes);
    app.use('/api/planillas', planillaRoutes);
    app.use('/api/planilla-catalogos', catalogoPlanillaRoutes);
    app.use('/api/planilla-gastos', planillaGastoRoutes);
    app.use('/api/colaboradores', colaboradorRoutes);
    app.use('/api/colaborador-pagos', colaboradorPagoRoutes);
    app.use('/api/vales', valeRoutes);
    app.use('/api/proyectos', proyectoRoutes);
    app.use('/api/utilidades', utilidadRoutes);
};
export default registerRoutes;
