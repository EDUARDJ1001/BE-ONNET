import authRoutes from './authRoutes.js';
import cargoRoutes from './cargoRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import estadoMensualRoutes from './estadoMensualRoutes.js';
import pagoRoutes from './pagoRoutes.js';
import planRoutes from './planRoutes.js';
import userRoutes from './userRoutes.js';

const registerRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/cargos', cargoRoutes);
    app.use('/api/clientes', clienteRoutes);
    app.use('/api/estado-mensual', estadoMensualRoutes);
    app.use('/api/pagos', pagoRoutes);
    app.use('/api/planes', planRoutes);
    app.use('/api/users', userRoutes);

};
export default registerRoutes;