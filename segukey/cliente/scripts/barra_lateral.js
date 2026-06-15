/* ============================================================
   segukey/scripts/barra_lateral.js
   Genera el HTML del sidebar según el rol del usuario.
   Se inyecta en todas las páginas de panel.
   ============================================================ */

/**
 * Renderiza el sidebar dentro del elemento #sidebar-container.
 * @param {string} activeId - id del nav-item activo
 * @param {object} user     - usuario de la sesión
 */
function renderSidebar(activeId, user) {
    const navs = {
        Administrador: `
            <div class="nav-group">
                <div class="nav-group__label">Principal</div>
                <a class="nav-item" id="nav-dashboard" href="panel.html">Dashboard</a>
                <a class="nav-item" id="nav-usuarios" href="usuarios.html">Gestión de Usuarios</a>
            </div>
            <div class="nav-group">
                <div class="nav-group__label">Seguridad</div>
                <a class="nav-item" id="nav-auditoria" href="auditoria.html">Auditoría y Logs
                    <span class="nav-item__badge" id="alert-badge"></span>
                </a>
                <a class="nav-item" id="nav-config" href="configuracion.html">Configuración</a>
            </div>`,
        Empleado: `
            <div class="nav-group">
                <div class="nav-group__label">Mi espacio</div>
                <a class="nav-item" id="nav-dashboard" href="panel.html">Panel Principal</a>
                <a class="nav-item" id="nav-archivos" href="archivos.html">Mis Archivos</a>
                <a class="nav-item" id="nav-perfil" href="perfil.html">Mi Perfil</a>
            </div>`,
        Tester: `
            <div class="nav-group">
                <div class="nav-group__label">Sistema</div>
                <a class="nav-item" id="nav-dashboard" href="panel.html">Estado del Sistema</a>
                <a class="nav-item" id="nav-perfil" href="perfil.html">Mi Perfil</a>
            </div>`
    };

    const html = `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar__brand">
                <div class="sidebar__brand-text">
                    <span class="sidebar__brand-name">SEGUKEY</span>
                    <span class="sidebar__brand-sub">Seguridad</span>
                </div>
            </div>
            <nav class="sidebar__nav">
                ${navs[user.rol] || ''}
            </nav>
            <div class="sidebar__footer">
                <div class="sidebar__user">
                    <div class="sidebar__avatar" id="sb-avatar">??</div>
                    <div class="sidebar__user-info">
                        <div class="sidebar__user-name" id="sb-user-name">—</div>
                        <div class="sidebar__user-role" id="sb-user-role">—</div>
                    </div>
                </div>
                <button class="nav-item" onclick="logout()" style="width:100%;margin-top:4px;color:var(--color-danger)">Cerrar Sesión</button>
            </div>
        </aside>`;

    const container = document.getElementById('sidebar-container');
    if (container) container.innerHTML = html;

    fillSidebarUser(user);
    setActiveNav(activeId);
    updateAlertBadge();
}
