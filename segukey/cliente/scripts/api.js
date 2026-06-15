/* ============================================================
   segukey/scripts/api.js  — VERSIÓN CON BACKEND REAL
   Reemplaza localStorage por llamadas fetch() a la API REST.
   La interfaz del objeto DB se mantiene igual para no tocar
   las páginas HTML existentes.
   ============================================================ */

const API_URL = 'http://localhost:3000/api'; // ← cambia si el backend está en otro host

/* ---- Calcula la ruta relativa a frontend/index.html según el nivel actual ----
   - cliente/paginas/inicio_sesion.html           -> ../index.html
   - cliente/paginas/administrador/panel.html -> ../../index.html */
function getIndexPath() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    const idx = parts.lastIndexOf('paginas');
    // depth = nº de carpetas entre 'pages' y el archivo (sin contar 'pages' ni el archivo)
    const depth = idx === -1 ? 1 : (parts.length - idx - 1);
    return '../'.repeat(depth) + 'index.html';
}

/* ---- Helper: petición autenticada ----
   Si options.body es FormData, NO se fija Content-Type (el navegador
   añade el boundary multipart automáticamente). */
async function apiFetch(path, options = {}) {
    const token = Session.getToken();
    const isFormData = options.body instanceof FormData;
    const headers = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json();

    // Si el token expiró, limpiar sesión y redirigir
    if (res.status === 401) {
        Session.clear();
        window.location.href = getIndexPath();
        return null;
    }

    return data;
}

/* ================================================================
   DB — misma API pública que antes, ahora async/await sobre fetch
   ================================================================ */
const DB = (() => {

    /* init ya no hace falta (el seed está en el SQL) */
    function init() { /* no-op */ }

    /* ================================================================
       USUARIOS
       ================================================================ */
    const usuarios = {
        async getAll() {
            const res = await apiFetch('/usuarios');
            return res?.data || [];
        },

        async getById(id) {
            const res = await apiFetch(`/usuarios/${id}`);
            return res?.data || null;
        },

        async getByCorreo(correo) {
            // No hay endpoint directo; buscar en lista (solo Admin)
            const lista = await this.getAll();
            return lista.find(u => u.correo === correo) || null;
        },

        async create(data) {
            const res = await apiFetch('/usuarios', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return res || { ok: false, msg: 'Error de red.' };
        },

        async update(id, data) {
            const res = await apiFetch(`/usuarios/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return res || { ok: false, msg: 'Error de red.' };
        },

        async delete(id) {
            const res = await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
            return res || { ok: false, msg: 'Error de red.' };
        },

        async login(correo, contrasena, rol, codigo_autorizacion) {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ correo, contrasena, rol, codigo_autorizacion })
            });
            if (res?.ok) {
                Session.setToken(res.token);
                return res.user;
            }
            return null;
        },

        async register(data) {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return res || { ok: false, msg: 'Error de red.' };
        }
    };

    /* ================================================================
       RESPALDOS
       ================================================================ */
    const respaldos = {
        async getByUsuario(usuario_id) {
            // El backend filtra por el usuario del token automáticamente
            const res = await apiFetch('/respaldos');
            return res?.data || [];
        },

        async getAll() {
            const res = await apiFetch('/respaldos');
            return res?.data || [];
        },

        async getById(id) {
            const res = await apiFetch(`/respaldos/${id}`);
            return res?.data || null;
        },

        async create(data) {
            // ubicacion es requerido por el backend; usar placeholder si viene vacío
            const payload = { ubicacion: '/storage/default/', ...data };
            const res = await apiFetch('/respaldos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return res || { ok: false, msg: 'Error de red.' };
        },

        async update(id, data, usuario_id) {
            const res = await apiFetch(`/respaldos/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return res || { ok: false, msg: 'Error de red.' };
        },

        async delete(id, usuario_id) {
            const res = await apiFetch(`/respaldos/${id}`, { method: 'DELETE' });
            return res || { ok: false, msg: 'Error de red.' };
        },

        /**
         * Sube un archivo real desde el PC del usuario.
         * @param {File} file - archivo seleccionado por el usuario
         * @param {string} estado - estado inicial ('Pendiente' | 'Protegido')
         */
        async upload(file, estado = 'Pendiente') {
            const formData = new FormData();
            formData.append('archivo', file);
            formData.append('estado', estado);

            const res = await apiFetch('/respaldos/upload', {
                method: 'POST',
                body: formData
            });
            return res || { ok: false, msg: 'Error de red.' };
        },

        /**
         * Descarga el archivo físico asociado a un respaldo.
         * Abre el archivo en una nueva pestaña / lo descarga vía blob.
         */
        async descargar(id, nombreSugerido) {
            const token = Session.getToken();
            const res = await fetch(`${API_URL}/respaldos/${id}/descargar`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) {
                let msg = 'No se pudo descargar el archivo.';
                try { const data = await res.json(); msg = data.msg || msg; } catch (_) {}
                return { ok: false, msg };
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreSugerido || 'archivo';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            return { ok: true };
        }
    };

    /* ================================================================
       LOGS
       ================================================================ */
    const logs = {
        async getAll() {
            const res = await apiFetch('/logs');
            return res?.data || [];
        },
        async getByNivel(nivel) {
            const qs = nivel ? `?nivel=${nivel}` : '';
            const res = await apiFetch(`/logs${qs}`);
            return res?.data || [];
        }
    };

    /* ================================================================
       ALERTAS
       ================================================================ */
    const alertas = {
        async getAll() {
            const res = await apiFetch('/alertas');
            return res?.data || [];
        },
        async getPendientes() {
            const res = await apiFetch('/alertas?estado=Pendiente');
            return res?.data || [];
        }
    };

    /* ================================================================
       MÉTRICAS
       ================================================================ */
    const metricas = {
        async get() {
            const res = await apiFetch('/metricas');
            return res?.data || {
                usuarios_activos: 0,
                archivos_protegidos: 0,
                accesos_hoy: 0,
                alertas_pendientes: 0
            };
        }
    };

    /* log manual desde el frontend ya no es necesario:
       el backend lo genera automáticamente en cada operación */
    async function log() { /* no-op */ }

    return { init, usuarios, respaldos, logs, alertas, metricas, log };
})();

/* ================================================================
   SESIÓN — ahora guarda token JWT además del usuario
   ================================================================ */
const Session = {
    set(user)  { sessionStorage.setItem('sk_user',  JSON.stringify(user)); },
    get()      {
        try { return JSON.parse(sessionStorage.getItem('sk_user')); }
        catch { return null; }
    },
    setToken(token) { sessionStorage.setItem('sk_token', token); },
    getToken()      { return sessionStorage.getItem('sk_token'); },
    clear()    {
        sessionStorage.removeItem('sk_user');
        sessionStorage.removeItem('sk_token');
    },
    require()  {
        const u = this.get();
        if (!u) { window.location.href = getIndexPath(); return null; }
        return u;
    },
    requireRole(role) {
        const u = this.require();
        if (u && u.rol !== role) { window.location.href = getIndexPath(); return null; }
        return u;
    }
};
