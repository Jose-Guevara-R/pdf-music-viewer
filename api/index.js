// api/index.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();

// 1. Configuración de conexión a NEON (PostgreSQL)
// Vercel requiere SSL activado para conexiones externas seguras.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});

// 2. Configuración de subida de archivos (Multer)
// Guardamos en memoria RAM (buffer) antes de enviar a la BD.
// IMPORTANTE: Establecemos un límite de seguridad de 4.5MB para cumplir con Vercel.
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 4500000 } // 4.5 MB aprox.
});

app.use(express.json());

// --- RUTAS DE LA API ---

// Ruta A: Obtener lista de todas las partituras
app.get('/api/partituras', async (req, res) => {
    try {
        // Solo traemos ID y Nombre para no sobrecargar la lista inicial
        const result = await pool.query('SELECT id, nombre, tipo_mime FROM partituras ORDER BY nombre ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error obteniendo lista:', err);
        res.status(500).json({ error: 'Error interno al obtener partituras' });
    }
});

// Ruta B: Obtener el archivo binario (PDF o Imagen)
app.get('/api/partituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Consultar el archivo binario (datos)
        const result = await pool.query('SELECT tipo_mime, datos FROM partituras WHERE id = $1', [id]);

        if (result.rows.length > 0) {
            const file = result.rows[0];
            
            // Le decimos al navegador qué tipo de archivo es (PDF, PNG, etc)
            res.setHeader('Content-Type', file.tipo_mime);
            // Enviamos los datos crudos
            res.send(file.datos);
        } else {
            res.status(404).send('Archivo no encontrado');
        }
    } catch (err) {
        console.error('Error obteniendo archivo:', err);
        res.status(500).send('Error al descargar el archivo');
    }
});

// Ruta C: Subir una nueva partitura
app.post('/api/subir', upload.single('archivo'), async (req, res) => {
    try {
        // Validaciones
        if (!req.file) {
            return res.status(400).json({ error: 'No has seleccionado ningún archivo.' });
        }

        const nombre = req.file.originalname;
        const tipo = req.file.mimetype;
        const datos = req.file.buffer;

        // Insertar en Base de Datos Neon
        await pool.query(
            'INSERT INTO partituras (nombre, tipo_mime, datos) VALUES ($1, $2, $3)',
            [nombre, tipo, datos]
        );

        res.status(201).json({ message: 'Partitura guardada exitosamente' });

    } catch (err) {
        console.error('Error subiendo archivo:', err);
        
        // Manejo específico si el archivo es muy grande (Error de Multer)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'El archivo es muy pesado para la versión gratuita (Máx 4.5MB).' });
        }
        
        res.status(500).json({ error: 'Error al guardar en la base de datos.' });
    }
});

// --- IMPORTANTE PARA VERCEL ---
// En Vercel NO se usa app.listen(3000).
// Simplemente exportamos la aplicación para que Vercel la ejecute como una función Serverless.

// [NUEVO] Ruta D: Borrar una partitura
app.delete('/api/partituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM partituras WHERE id = $1', [id]);
        res.json({ message: 'Partitura eliminada correctamente' });
    } catch (err) {
        console.error('Error borrando:', err);
        res.status(500).json({ error: 'No se pudo eliminar la partitura' });
    }
});


module.exports = app;