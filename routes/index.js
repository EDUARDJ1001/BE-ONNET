import authRoutes from './authRoutes.js';
import cargoRoutes from './cargoRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import estadoMensualRoutes from './estadoMensualRoutes.js';
import estadoMensualTvRoutes from './estadoMensualTvRoutes.js';
import gastoRoutes from './gastoRoutes.js';
import metodosPagoRoutes from './metodosPagoRoutes.js';
import pagoRoutes from './pagoRoutes.js';
import planRoutes from './planRoutes.js';
import tvRoutes from './tvRoutes.js';
import userRoutes from './userRoutes.js';

const registerRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/cargos', cargoRoutes);
    app.use('/api/clientes', clienteRoutes);
    app.use('/api/estado-mensual', estadoMensualRoutes);
    app.use('/api/estado-mensual-tv', estadoMensualTvRoutes);
    app.use('/api/gastos', gastoRoutes);
    app.use('/api/metodos-pago', metodosPagoRoutes);
    app.use('/api/pagos', pagoRoutes);
    app.use('/api/planes', planRoutes);
    app.use('/api/tv', tvRoutes);
    app.use('/api/users', userRoutes);

};
export default registerRoutes;