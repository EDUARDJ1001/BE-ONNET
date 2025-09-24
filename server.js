import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import registerRoutes from './routes/index.js';

dotenv.config();

const app = express();

app.use(cors({
//   origin: 'https://onnethn.vercel.app', 
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Backend ON-NET</title>
            </head>
            <body>
                <h1>Conexión a la base de datos establecida correctamente</h1>
            </body>
        </html>
    `);
});

registerRoutes(app);

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
    try {
        await connectDB();
        console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    } catch (err) {
        console.error('Error al conectar la base de datos al iniciar el servidor:', err);
    }
});
