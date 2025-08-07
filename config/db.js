import dotenv from 'dotenv';
import { createPool } from 'mysql2/promise';

dotenv.config();

let pool;

const connectDB = async () => {
    if (!pool) {
        try {
            pool = createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT,
                ssl: {
                    ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), // Esto convierte \n en saltos de línea
                    rejectUnauthorized: true
                },
                connectionLimit: 10,
                idleTimeout: 30000,
                waitForConnections: true,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            });

            // Test de conexión
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();

            console.log('✅ Conexión exitosa al pool de MySQL (SSL desde variable)');
        } catch (err) {
            console.error('❌ Error al conectar a MySQL:', err);
            throw err;
        }
    }
    return pool;
};

export default connectDB;
