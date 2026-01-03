require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();

// 1. Configuración de Base de Datos (Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 2. Configuración de subida (Límite 4.5MB para Vercel)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 4500000 } 
});

app.use(express.json());

// --- RUTAS ---

// A. Listar partituras
app.get('/api/partituras', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, tipo_mime FROM partituras ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar');
    }
});

// B. Obtener archivo
app.get('/api/partituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT tipo_mime, datos FROM partituras WHERE id = $1', [id]);
        
        if (result.rows.length > 0) {
            const file = result.rows[0];
            res.setHeader('Content-Type', file.tipo_mime);
            res.send(file.datos);
        } else {
            res.status(404).send('No encontrado');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error');
    }
});

// C. Subir archivo
app.post('/api/subir', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Falta archivo' });

        await pool.query(
            'INSERT INTO partituras (nombre, tipo_mime, datos) VALUES ($1, $2, $3)',
            [req.file.originalname, req.file.mimetype, req.file.buffer]
        );
        res.json({ message: 'Guardado' });
    } catch (err) {
        console.error(err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Archivo muy grande (Máx 4.5MB)' });
        }
        res.status(500).send('Error al guardar');
    }
});

// D. Borrar archivo (NUEVO)
app.delete('/api/partituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM partituras WHERE id = $1', [id]);
        res.json({ message: 'Eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al eliminar');
    }
});

// Exportar para Vercel
module.exports = app;