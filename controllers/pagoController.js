import * as PagoModel from '../models/pagoModel.js';
import * as EstadoModel from '../models/estadoMensualModel.js';
import connectDB from '../config/db.js';

export const getPagos = async (req, res) => {
    try {
        const pagos = await PagoModel.obtenerPagos();
        res.json(pagos);
    } catch (error) {
        console.error('Error al obtener pagos:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const getPagoById = async (req, res) => {
    try {
        const pago = await PagoModel.obtenerPagoPorId(req.params.id);
        if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });
        res.json(pago);
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const createPago = async (req, res) => {
    try {
        const { cliente_id, monto, fecha_pago, observacion } = req.body;

        const nuevoId = await PagoModel.crearPago({ cliente_id, monto, fecha_pago, observacion });

        // Obtener mes y año del pago
        const fecha = new Date(fecha_pago);
        const mes = fecha.getMonth() + 1; // 1–12
        const anio = fecha.getFullYear();

        // Obtener precio del plan del cliente
        const db = await connectDB();
        const [planData] = await db.execute(
            `SELECT p.precio_mensual FROM planes p
             JOIN clientes c ON c.plan_id = p.id
             WHERE c.id = ?`,
            [cliente_id]
        );

        if (planData.length === 0) {
            return res.status(400).json({ message: 'No se encontró el plan del cliente.' });
        }

        const precioPlan = planData[0].precio_mensual;

        // Determinar estado
        let estado = 'Pendiente';
        if (monto >= precioPlan) {
            estado = 'Pagado';
        } else if (monto > 0 && monto < precioPlan) {
            estado = 'Pagado Parcial';
        }

        // Verificar si ya existe registro del mes
        const [estadoExistente] = await db.execute(
            'SELECT id FROM estado_mensual WHERE cliente_id = ? AND mes = ? AND anio = ?',
            [cliente_id, mes, anio]
        );

        if (estadoExistente.length > 0) {
            await db.execute(
                'UPDATE estado_mensual SET estado = ? WHERE id = ?',
                [estado, estadoExistente[0].id]
            );
        } else {
            await db.execute(
                'INSERT INTO estado_mensual (cliente_id, mes, anio, estado) VALUES (?, ?, ?, ?)',
                [cliente_id, mes, anio, estado]
            );
        }

        res.status(201).json({ message: 'Pago registrado y estado actualizado.', id: nuevoId });
    } catch (error) {
        console.error('Error al registrar pago:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const updatePago = async (req, res) => {
    try {
        await PagoModel.actualizarPago(req.params.id, req.body);
        res.json({ message: 'Pago actualizado' });
    } catch (error) {
        console.error('Error al actualizar pago:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const deletePago = async (req, res) => {
    try {
        await PagoModel.eliminarPago(req.params.id);
        res.json({ message: 'Pago eliminado' });
    } catch (error) {
        console.error('Error al eliminar pago:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
