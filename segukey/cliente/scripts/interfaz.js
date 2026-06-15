/* ============================================================
   segukey/scripts/interfaz.js
   Utilidades de interfaz reutilizables en todas las páginas
   ============================================================ */

/* ---- TOAST ---- */
const Toast = (() => {
    let container;

    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function show(msg, type = 'info', duration = 3500) {
        const c = getContainer();
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = msg;
        c.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    return {
        success: (m) => show(m, 'success'),
        error:   (m) => show(m, 'error'),
        warning: (m) => show(m, 'warning'),
        info:    (m) => show(m, 'info')
    };
})();

/* ---- MODAL ---- */
const Modal = {
    /**
     * Abre el modal con id dado y opcionalmente lo rellena.
     * @param {string} id - id del elemento .modal-overlay
     */
    open(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); }
    },
    close(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); }
    },
    /**
     * Modal de confirmación dinámico para eliminaciones.
     * @param {string} msg - Mensaje a mostrar
     * @param {Function} onConfirm - Callback al confirmar
     */
    confirm(msg, onConfirm) {
        const existing = document.getElementById('_confirm_modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = '_confirm_modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal confirm-modal" style="max-width:420px">
                <div class="modal__header">
                    <span class="modal__title">Confirmar eliminación</span>
                </div>
                <div class="modal__body">
                    <p style="color:var(--color-text-secondary);font-size:var(--size-sm)">${msg}</p>
                </div>
                <div class="modal__footer">
                    <button class="btn btn--ghost" id="_confirm_cancel">Cancelar</button>
                    <button class="btn btn--danger" id="_confirm_ok">Eliminar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('_confirm_cancel').onclick = () => overlay.remove();
        document.getElementById('_confirm_ok').onclick = () => { overlay.remove(); onConfirm(); };
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }
};

/* ---- BADGES de estado ---- */
const Badge = {
    estado(estado) {
        const map = {
            'Activo':     '<span class="badge badge--success">Activo</span>',
            'Suspendido': '<span class="badge badge--danger">Suspendido</span>',
            'Protegido':  '<span class="badge badge--success">Protegido</span>',
            'Pendiente':  '<span class="badge badge--warning">Pendiente</span>',
            'Restringido':'<span class="badge badge--danger">Restringido</span>',
            'Resuelta':   '<span class="badge badge--success">Resuelta</span>',
            'Revisada':   '<span class="badge badge--info">Revisada</span>',
        };
        return map[estado] || `<span class="badge badge--info">${estado}</span>`;
    },
    nivel(nivel) {
        const map = {
            'Error':   '<span class="badge badge--danger">Error</span>',
            'Warning': '<span class="badge badge--warning">Warning</span>',
            'Info':    '<span class="badge badge--primary">Info</span>',
        };
        return map[nivel] || nivel;
    },
    rol(rol) {
        const map = {
            'Administrador': '<span class="badge badge--danger">Admin</span>',
            'Empleado':      '<span class="badge badge--success">Empleado</span>',
            'Tester':        '<span class="badge badge--info">Tester</span>',
        };
        return map[rol] || rol;
    }
};

/* ---- Formateo de fecha ---- */
function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
        + ' ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}

function fmtSize(kb) {
    if (kb >= 1024) return (kb/1024).toFixed(1) + ' MB';
    return kb + ' KB';
}

/* ---- Reloj en tiempo real ---- */
function startClock(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    function tick() {
        el.textContent = new Date().toLocaleString('es-CO', {
            weekday:'short', day:'2-digit', month:'short',
            hour:'2-digit', minute:'2-digit', second:'2-digit'
        });
    }
    tick();
    setInterval(tick, 1000);
}

/* ---- Llenar sidebar con usuario activo ---- */
function fillSidebarUser(user) {
    const nameEl = document.getElementById('sb-user-name');
    const roleEl = document.getElementById('sb-user-role');
    const avatarEl = document.getElementById('sb-avatar');
    if (nameEl) nameEl.textContent = `${user.nombre} ${user.apellido}`;
    if (roleEl) roleEl.textContent = user.rol;
    if (avatarEl) avatarEl.textContent = user.nombre[0] + user.apellido[0];
}

/* ---- Navegación activa del sidebar ---- */
function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

/* ---- Cerrar sesión ---- */
function logout() {
    Session.clear();
    window.location.href = getIndexPath();
}

/* ---- Validar formulario básico ---- */
function validateRequired(fields) {
    let ok = true;
    fields.forEach(({ el, msg }) => {
        const wrapper = el.closest('.form-group');
        const existing = wrapper && wrapper.querySelector('.form-error-msg');
        if (existing) existing.remove();
        if (!el.value.trim()) {
            ok = false;
            el.classList.add('error');
            if (wrapper) {
                const err = document.createElement('span');
                err.className = 'form-error-msg';
                err.textContent = msg || 'Campo requerido';
                wrapper.appendChild(err);
            }
        } else {
            el.classList.remove('error');
        }
    });
    return ok;
}

/* ---- Limpiar errores de un form ---- */
function clearErrors(form) {
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.form-error-msg').forEach(el => el.remove());
}

/* ---- Tabla vacía ---- */
function emptyRow(cols, msg = 'No hay registros para mostrar.') {
    return `<tr><td colspan="${cols}" class="table-empty">
        <div class="table-empty__text">${msg}</div>
    </td></tr>`;
}

/* ---- Contador de alertas en sidebar badge ---- */
function updateAlertBadge() {
    const count = DB.alertas.getPendientes().length;
    const badge = document.getElementById('alert-badge');
    if (badge) badge.textContent = count > 0 ? count : '';
}
