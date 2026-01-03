let wakeLock = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarLista();
    // [NUEVO] Inicializar estado del botón en móvil (si empezamos con menú abierto)
    checkMenuState();
});

// --- 1. LISTA Y BORRADO ---
async function cargarLista() {
    try {
        const res = await fetch('/api/partituras');
        const lista = await res.json();
        const ul = document.getElementById('listaPartituras');
        ul.innerHTML = '';

        lista.forEach(item => {
            const li = document.createElement('li');
            
            const span = document.createElement('span');
            span.textContent = item.nombre;
            span.className = 'song-name';
            span.onclick = () => verPartitura(item.id, item.tipo_mime, li);

            const btn = document.createElement('button');
            btn.innerHTML = '🗑️'; 
            btn.className = 'btn-delete';
            btn.onclick = (e) => {
                e.stopPropagation(); 
                borrarPartitura(item.id, item.nombre);
            };

            li.appendChild(span);
            li.appendChild(btn);
            ul.appendChild(li);
        });
    } catch (error) { console.error(error); }
}

async function borrarPartitura(id, nombre) {
    if(!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
        const res = await fetch(`/api/partituras/${id}`, { method: 'DELETE' });
        if(res.ok) {
            document.getElementById('contenidoPartitura').innerHTML = '<p style="color:#aaa; margin-top:50px;">Selecciona una partitura</p>';
            actualizarEstadoWakeLock(false);
            cargarLista();
        } else { alert('Error al eliminar'); }
    } catch(e) { alert('Error de red'); }
}

// --- 2. SUBIDA ---
async function subirArchivo() {
    const input = document.getElementById('fileInput');
    if (input.files.length === 0) return alert('Selecciona archivo');
    
    const file = input.files[0];
    const formData = new FormData();
    const btn = document.querySelector('.upload-section button');

    if (file.type === 'application/pdf') {
        if (file.size > 4.5 * 1024 * 1024) return alert('PDF muy pesado (Máx 4.5MB).');
        formData.append('archivo', file);
        await enviarData(formData, input);
    } 
    else if (file.type.startsWith('image/')) {
        btn.textContent = "Comprimiendo...";
        btn.disabled = true;
        try {
            const blob = await comprimirImagen(file);
            formData.append('archivo', blob, file.name);
            await enviarData(formData, input);
        } catch(e) { console.error(e); alert('Error imagen'); }
        btn.textContent = "+ Guardar Partitura";
        btn.disabled = false;
    } 
    else { alert('Formato no válido'); }
}

async function enviarData(formData, input) {
    try {
        const res = await fetch('/api/subir', { method: 'POST', body: formData });
        if (res.ok) { alert('Guardado!'); input.value = ''; cargarLista(); } 
        else { const d = await res.json(); alert('Error: ' + (d.error || 'Desconocido')); }
    } catch(e) { alert('Error de red'); }
}

function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxW = 1200; 
                let w = img.width; let h = img.height;
                if(w > maxW) { h *= maxW/w; w = maxW; }
                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(resolve, 'image/jpeg', 0.7);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// --- 3. VISOR ---
async function verPartitura(id, type, li) {
    // Si estamos en móvil, ocultamos menú y activamos botón transparente
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.add('oculto');
        checkMenuState(); // Actualiza transparencia
    }

    document.querySelectorAll('li').forEach(l => l.classList.remove('active'));
    li.classList.add('active');
    
    const container = document.getElementById('contenidoPartitura');
    container.innerHTML = '<p>Cargando...</p>';
    activarWakeLock();

    try {
        const res = await fetch(`/api/partituras/${id}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        container.innerHTML = '';

        if(type.includes('pdf')) {
            const pdf = await pdfjsLib.getDocument(url).promise;
            for(let i=1; i<=pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const cvs = document.createElement('canvas');
                const ctx = cvs.getContext('2d');
                cvs.width = viewport.width; cvs.height = viewport.height;
                container.appendChild(cvs);
                await page.render({ canvasContext: ctx, viewport }).promise;
            }
        } else {
            const img = document.createElement('img');
            img.src = url;
            container.appendChild(img);
        }
    } catch(e) { container.innerHTML = '<p>Error al cargar</p>'; }
}

// --- 4. CONTROL MENÚ Y TRANSPARENCIA ---

function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('oculto');
    checkMenuState(); // Revisar si debemos ponerlo transparente
}

// Función auxiliar para decidir si el botón debe ser transparente
function checkMenuState() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileMenuBtn');
    
    // Si tiene la clase 'oculto', significa que estamos viendo partitura -> Poner fantasma
    if (sidebar.classList.contains('oculto')) {
        btn.classList.add('btn-ghost');
    } else {
        // Si el menú está visible -> Botón normal
        btn.classList.remove('btn-ghost');
    }
}

// Wake Lock
async function activarWakeLock() {
    if('wakeLock' in navigator) {
        try { 
            wakeLock = await navigator.wakeLock.request('screen');
            actualizarEstadoWakeLock(true);
            wakeLock.addEventListener('release', () => actualizarEstadoWakeLock(false));
        } catch(e) {}
    }
}
document.addEventListener('visibilitychange', () => {
    if(wakeLock && document.visibilityState === 'visible') activarWakeLock();
});
function actualizarEstadoWakeLock(on) {
    const el = document.getElementById('statusWakeLock');
    if(on) { el.textContent = "Pantalla: SIEMPRE ON 💡"; el.className = "status-on"; }
    else { el.textContent = "Pantalla: Normal"; el.className = "status-off"; }
}