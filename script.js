let wakeLock = null;

// 1. Cargar lista al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarLista();
});

// Función para obtener la lista desde Neon
async function cargarLista() {
    try {
        const res = await fetch('/api/partituras');
        const lista = await res.json();
        const ul = document.getElementById('listaPartituras');
        ul.innerHTML = '';

        lista.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.nombre;
            li.onclick = () => verPartitura(item.id, item.tipo_mime, li);
            ul.appendChild(li);
        });
    } catch (error) {
        console.error('Error cargando lista:', error);
    }
}

// Función para subir archivo a Neon
async function subirArchivo() {
    const input = document.getElementById('fileInput');
    if (input.files.length === 0) return alert('Selecciona un archivo');

    const formData = new FormData();
    formData.append('archivo', input.files[0]);

    try {
        const res = await fetch('/api/subir', { method: 'POST', body: formData });
        if (res.ok) {
            alert('Partitura guardada en la Nube');
            input.value = ''; // Limpiar
            cargarLista(); // Recargar lista
        } else {
            alert('Error al subir');
        }
    } catch (error) {
        console.error(error);
        alert('Error de red');
    }
}

// Función principal: Ver Partitura y Bloquear Pantalla
async function verPartitura(id, tipo, elementoLi) {
    // UI: Resaltar selección
    document.querySelectorAll('#listaPartituras li').forEach(l => l.classList.remove('active'));
    elementoLi.classList.add('active');

    const container = document.getElementById('contenidoPartitura');
    container.innerHTML = '<p>Cargando partitura...</p>';

    // Activar Wake Lock (Pantalla encendida)
    activarWakeLock();

    // Obtener el archivo binario desde el servidor
    const res = await fetch(`/api/partituras/${id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    container.innerHTML = ''; // Limpiar mensaje de carga

    if (tipo.includes('pdf')) {
        renderizarPDF(url, container);
    } else {
        // Es imagen
        const img = document.createElement('img');
        img.src = url;
        container.appendChild(img);
    }
}

// Lógica de PDF.js para pintar el PDF en Canvas
async function renderizarPDF(url, container) {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    // Renderizar todas las páginas una debajo de otra
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const scale = 1.5; // Zoom inicial
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        container.appendChild(canvas);
        await page.render(renderContext).promise;
    }
}

// Lógica de Wake Lock (Pantalla siempre encendida)
async function activarWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            actualizarEstadoWakeLock(true);
            
            // Si el usuario cambia de pestaña y vuelve, reactivar
            wakeLock.addEventListener('release', () => {
                actualizarEstadoWakeLock(false);
                console.log('Wake Lock liberado');
            });

            console.log('Pantalla bloqueada (No se apagará)');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    } else {
        console.warn('Este navegador no soporta Wake Lock');
    }
}

// Reactivar Wake Lock si la pestaña vuelve a ser visible
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        activarWakeLock();
    }
});

function actualizarEstadoWakeLock(activo) {
    const div = document.getElementById('statusWakeLock');
    if (activo) {
        div.textContent = "Pantalla: SIEMPRE ON 💡";
        div.className = "status-on";
    } else {
        div.textContent = "Pantalla: Normal";
        div.className = "status-off";
    }
}