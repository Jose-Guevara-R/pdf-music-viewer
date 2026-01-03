// sw.js - Service Worker básico para PWA
const CACHE_NAME = 'visor-music-v1';

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/script.js',
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
            ]);
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Estrategia simple: Intenta red primero, si falla, usa caché (para que la app cargue offline lo básico)
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});