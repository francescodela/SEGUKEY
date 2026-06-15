-- ============================================================
-- SEGUKEY - Sistema de Seguridad Empresarial
-- Script de Base de Datos PostgreSQL
-- ============================================================

-- Eliminar tablas si existen (orden inverso de dependencias)
DROP TABLE IF EXISTS actualizacion_sistema CASCADE;
DROP TABLE IF EXISTS reporte_seguridad CASCADE;
DROP TABLE IF EXISTS registro_actividad CASCADE;
DROP TABLE IF EXISTS alerta CASCADE;
DROP TABLE IF EXISTS respaldo CASCADE;
DROP TABLE IF EXISTS configuracion_sistema CASCADE;
DROP TABLE IF EXISTS tester CASCADE;
DROP TABLE IF EXISTS administrador_cliente CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;

-- ============================================================
-- TABLA: usuario
-- Entidad central del sistema. Representa a cualquier persona
-- que accede a la plataforma (Empleado, Admin, Tester).
-- ============================================================
CREATE TABLE usuario (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(100)        NOT NULL,
    apellido            VARCHAR(100)        NOT NULL,
    correo              VARCHAR(150)        NOT NULL UNIQUE,
    contrasena          VARCHAR(255)        NOT NULL,       -- almacenada con hash
    codigo_autorizacion VARCHAR(20)         NOT NULL,       -- "Código Especial" del prototipo
    rol                 VARCHAR(20)         NOT NULL CHECK (rol IN ('Administrador', 'Empleado', 'Tester')),
    estado              VARCHAR(20)         NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Suspendido')),
    -- Permisos granulares asignables por el Administrador
    permiso_ver_archivos    BOOLEAN DEFAULT FALSE,
    permiso_editar_usuarios BOOLEAN DEFAULT FALSE,
    permiso_ver_auditoria   BOOLEAN DEFAULT FALSE,
    fecha_creacion      TIMESTAMP           NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP           NOT NULL DEFAULT NOW(),
    ultimo_acceso       TIMESTAMP,
    -- Campos adicionales para el perfil del Empleado
    telefono            VARCHAR(20),
    area_departamento   VARCHAR(100),
    cargo               VARCHAR(100)
);

-- ============================================================
-- TABLA: administrador_cliente
-- Extiende las capacidades del usuario con rol Administrador.
-- Según el diagrama de clases, tiene métodos propios de gestión.
-- ============================================================
CREATE TABLE administrador_cliente (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT                 NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nivel_acceso        VARCHAR(50)         NOT NULL DEFAULT 'Total',
    correo_institucional VARCHAR(150),
    fecha_registro      TIMESTAMP           NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: tester
-- Rol técnico que verifica el funcionamiento del sistema.
-- Puede ejecutar pruebas pero no gestiona usuarios ni config.
-- ============================================================
CREATE TABLE tester (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT                 NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    permisos_tecnicos   TEXT,                              -- ej: "ejecutar pruebas, ver logs"
    fecha_registro      TIMESTAMP           NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: respaldo (Archivo del Empleado)
-- Archivos protegidos que gestiona cada empleado.
-- Corresponde a la clase "Respaldo" del diagrama de clases.
-- ============================================================
CREATE TABLE respaldo (
    id                  SERIAL PRIMARY KEY,
    nombre_archivo      VARCHAR(255)        NOT NULL,
    tipo                VARCHAR(20)         NOT NULL CHECK (tipo IN ('PDF', 'DOC', 'XLS', 'Imagen', 'Otro')),
    tamano              INT                 NOT NULL,       -- en KB
    fecha_hora          TIMESTAMP           NOT NULL DEFAULT NOW(),
    ubicacion           VARCHAR(500)        NOT NULL,       -- ruta o referencia en almacenamiento
    estado              VARCHAR(20)         NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Protegido', 'Pendiente', 'Restringido')),
    usuario_id          INT                 NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    dispositivo         VARCHAR(100),
    ip                  VARCHAR(45)
);

-- ============================================================
-- TABLA: registro_actividad
-- Auditoría de todas las acciones realizadas en el sistema.
-- Cubre el requisito funcional de Registro y Auditoría.
-- ============================================================
CREATE TABLE registro_actividad (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT                 REFERENCES usuario(id) ON DELETE SET NULL,
    accion              VARCHAR(255)        NOT NULL,       -- descripción de la acción
    fecha_hora          TIMESTAMP           NOT NULL DEFAULT NOW(),
    ip                  VARCHAR(45),
    dispositivo         VARCHAR(100),
    modulo              VARCHAR(50),                        -- Auth, API, Database, Storage
    nivel               VARCHAR(20)         NOT NULL DEFAULT 'Info' CHECK (nivel IN ('Error', 'Warning', 'Info')),
    resultado           VARCHAR(20)         NOT NULL DEFAULT 'Exitoso' CHECK (resultado IN ('Exitoso', 'Fallido', 'Bloqueado'))
);

-- ============================================================
-- TABLA: alerta
-- Notificaciones generadas por eventos críticos del sistema.
-- Conectada al Módulo de Monitoreo y Sistema de Alertas.
-- ============================================================
CREATE TABLE alerta (
    id                  SERIAL PRIMARY KEY,
    mensaje             TEXT                NOT NULL,
    tipo                VARCHAR(50)         NOT NULL,       -- Intrusión, Fallo, Riesgo, Anomalía
    severidad           VARCHAR(20)         NOT NULL DEFAULT 'Media' CHECK (severidad IN ('Baja', 'Media', 'Alta', 'Crítica')),
    fecha_hora          TIMESTAMP           NOT NULL DEFAULT NOW(),
    usuario_id          INT                 REFERENCES usuario(id) ON DELETE SET NULL,
    estado              VARCHAR(20)         NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Revisada', 'Resuelta'))
);

-- ============================================================
-- TABLA: configuracion_sistema
-- Parámetros y políticas de seguridad configurables.
-- Solo accesible por el Administrador.
-- ============================================================
CREATE TABLE configuracion_sistema (
    id                  SERIAL PRIMARY KEY,
    parametro           VARCHAR(100)        NOT NULL UNIQUE,
    valor               VARCHAR(500)        NOT NULL,
    descripcion         TEXT,
    fecha_actualizacion TIMESTAMP           NOT NULL DEFAULT NOW(),
    usuario_actualizacion INT               REFERENCES usuario(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: reporte_seguridad
-- Reportes generados sobre el estado del sistema.
-- Clase "ReporteSeguridad" del diagrama de clases.
-- ============================================================
CREATE TABLE reporte_seguridad (
    id                  SERIAL PRIMARY KEY,
    titulo              VARCHAR(255)        NOT NULL,
    tipo                VARCHAR(50)         NOT NULL,
    descripcion         TEXT,
    fecha_inicio        TIMESTAMP           NOT NULL,
    fecha_fin           TIMESTAMP           NOT NULL,
    fecha_generacion    TIMESTAMP           NOT NULL DEFAULT NOW(),
    usuario_generador   INT                 REFERENCES usuario(id) ON DELETE SET NULL,
    filtros_aplicados   TEXT,
    contenido           TEXT
);

-- ============================================================
-- TABLA: actualizacion_sistema
-- Registro de actualizaciones y cambios aplicados al sistema.
-- Clase "ActualizacionSistema" del diagrama de clases.
-- ============================================================
CREATE TABLE actualizacion_sistema (
    id                  SERIAL PRIMARY KEY,
    version             VARCHAR(20)         NOT NULL,
    tipo                VARCHAR(50)         NOT NULL,       -- Parche, Mejora, Corrección
    descripcion         TEXT                NOT NULL,
    fecha_aplicacion    TIMESTAMP           NOT NULL DEFAULT NOW(),
    usuario_aplicacion  INT                 REFERENCES usuario(id) ON DELETE SET NULL,
    cambios_realizados  TEXT,
    estado              VARCHAR(20)         NOT NULL DEFAULT 'Aplicada' CHECK (estado IN ('Aplicada', 'Pendiente', 'Fallida'))
);

-- ============================================================
-- ÍNDICES para optimizar consultas frecuentes
-- ============================================================
CREATE INDEX idx_usuario_rol       ON usuario(rol);
CREATE INDEX idx_usuario_estado    ON usuario(estado);
CREATE INDEX idx_usuario_correo    ON usuario(correo);
CREATE INDEX idx_registro_usuario  ON registro_actividad(usuario_id);
CREATE INDEX idx_registro_fecha    ON registro_actividad(fecha_hora DESC);
CREATE INDEX idx_registro_nivel    ON registro_actividad(nivel);
CREATE INDEX idx_alerta_estado     ON alerta(estado);
CREATE INDEX idx_respaldo_usuario  ON respaldo(usuario_id);
CREATE INDEX idx_respaldo_estado   ON respaldo(estado);

-- ============================================================
-- DATOS INICIALES (Seed Data)
-- Usuarios de prueba para cada rol del sistema
-- Contraseñas hasheadas: 'Admin123!' → hash de ejemplo
-- En producción usar bcrypt desde el backend
-- ============================================================

-- Usuario Administrador
INSERT INTO usuario (nombre, apellido, correo, contrasena, codigo_autorizacion, rol, estado,
    permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria, cargo)
VALUES (
    'Alnaldo', 'Brun',
    'admin@segukey.com',
    '$2a$10$chnvLZt/8/DXM0ED/ni7DuopDVUvoxgq5WuvYROf/chOceL9pJjki',  -- hash de 'Admin123!'
    'SK-ADMIN-001',
    'Administrador', 'Activo',
    TRUE, TRUE, TRUE,
    'Administrador General'
);

-- Registrar en tabla administrador_cliente
INSERT INTO administrador_cliente (usuario_id, nivel_acceso, correo_institucional)
VALUES (1, 'Total', 'admin@segukey.com');

-- Usuario Empleado
INSERT INTO usuario (nombre, apellido, correo, contrasena, codigo_autorizacion, rol, estado,
    permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
    telefono, area_departamento, cargo)
VALUES (
    'Franklin', 'Hernández',
    'empleado@segukey.com',
    '$2a$10$AXu5ZpU/cwiLv2R7STQTherDjdHtvTh.s6kBrhCFkLr3EwAf6dIOG',  -- hash de 'Emp123!'
    'SK-EMP-001',
    'Empleado', 'Activo',
    TRUE, FALSE, FALSE,
    '3001234567', 'Tecnología', 'Analista de Sistemas'
);

-- Usuario Tester
INSERT INTO usuario (nombre, apellido, correo, contrasena, codigo_autorizacion, rol, estado,
    permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria, cargo)
VALUES (
    'Carlos', 'Martínez',
    'tester@segukey.com',
    '$2a$10$r9YxBhwE0ucLRPx2Cjn5B.pWaKrwEiH74QsEimpfwx5Bh1vpJbpvC',  -- hash de 'Test123!'
    'SK-TEST-001',
    'Tester', 'Activo',
    FALSE, FALSE, TRUE,
    'Tester QA'
);

-- Registrar en tabla tester
INSERT INTO tester (usuario_id, permisos_tecnicos)
VALUES (3, 'ejecutar pruebas, ver logs técnicos, monitorear módulos');

-- Configuraciones iniciales del sistema
INSERT INTO configuracion_sistema (parametro, valor, descripcion, usuario_actualizacion) VALUES
    ('algoritmo_encriptacion', 'AES-256',    'Algoritmo de cifrado para datos en tránsito y reposo', 1),
    ('max_usuarios_concurrentes', '2000',    'Máximo de usuarios simultáneos soportados', 1),
    ('tiempo_respuesta_max_ms', '2000',      'Tiempo máximo de respuesta aceptable en milisegundos', 1),
    ('intentos_login_max', '5',              'Intentos fallidos antes de suspender cuenta', 1),
    ('backup_automatico', 'true',            'Generación automática de copias de seguridad', 1),
    ('sesion_timeout_min', '30',             'Minutos de inactividad antes de cerrar sesión', 1),
    ('version_sistema', '1.0.0',             'Versión actual del sistema Segukey', 1);

-- Respaldos de ejemplo para el empleado
INSERT INTO respaldo (nombre_archivo, tipo, tamano, ubicacion, estado, usuario_id, dispositivo, ip) VALUES
    ('Informe_Q1_2026.pdf',    'PDF',    2048, '/storage/empleado2/informes/', 'Protegido',   2, 'PC-Franklin', '192.168.1.10'),
    ('Presupuesto_2026.xls',   'XLS',    512,  '/storage/empleado2/finanzas/', 'Protegido',   2, 'PC-Franklin', '192.168.1.10'),
    ('Contrato_Servicios.doc', 'DOC',    1024, '/storage/empleado2/contratos/','Pendiente',   2, 'PC-Franklin', '192.168.1.10'),
    ('Logo_Empresa.png',       'Imagen', 256,  '/storage/empleado2/imagenes/', 'Restringido', 2, 'PC-Franklin', '192.168.1.10');

-- Registros de actividad de ejemplo
INSERT INTO registro_actividad (usuario_id, accion, ip, dispositivo, modulo, nivel, resultado) VALUES
    (1, 'Inicio de sesión exitoso',        '192.168.1.1',  'PC-Admin',    'Auth',     'Info',    'Exitoso'),
    (2, 'Inicio de sesión exitoso',        '192.168.1.10', 'PC-Franklin', 'Auth',     'Info',    'Exitoso'),
    (1, 'Creación de usuario: Carlos Martínez', '192.168.1.1', 'PC-Admin', 'Database','Info',   'Exitoso'),
    (2, 'Subida de archivo: Informe_Q1_2026.pdf', '192.168.1.10','PC-Franklin','Storage','Info','Exitoso'),
    (3, 'Ejecución de prueba de módulo Auth', '192.168.1.20','PC-Tester', 'Auth',     'Info',    'Exitoso'),
    (NULL, 'Intento de acceso no autorizado', '10.0.0.99', 'Desconocido','Auth',      'Warning', 'Bloqueado');

-- Alertas de ejemplo
INSERT INTO alerta (mensaje, tipo, severidad, usuario_id, estado) VALUES
    ('Intento de acceso desde IP no reconocida: 10.0.0.99', 'Intrusión', 'Alta',    1, 'Pendiente'),
    ('Uso de almacenamiento al 78%',                         'Riesgo',    'Media',   1, 'Revisada'),
    ('Backup completado exitosamente',                        'Sistema',   'Baja',    1, 'Resuelta');

-- ============================================================
-- VISTAS útiles para el sistema
-- ============================================================

-- Vista: Panel del Administrador (métricas principales)
CREATE OR REPLACE VIEW vista_metricas_admin AS
SELECT
    (SELECT COUNT(*) FROM usuario WHERE estado = 'Activo')                          AS usuarios_activos,
    (SELECT COUNT(*) FROM respaldo WHERE estado = 'Protegido')                      AS archivos_protegidos,
    (SELECT COUNT(*) FROM registro_actividad WHERE DATE(fecha_hora) = CURRENT_DATE) AS accesos_hoy,
    (SELECT COUNT(*) FROM alerta WHERE estado = 'Pendiente')                        AS alertas_pendientes;

-- Vista: Log de auditoría con nombre de usuario
CREATE OR REPLACE VIEW vista_auditoria AS
SELECT
    ra.id,
    COALESCE(u.nombre || ' ' || u.apellido, 'Sistema') AS usuario,
    u.rol,
    ra.accion,
    ra.modulo,
    ra.nivel,
    ra.resultado,
    ra.ip,
    ra.fecha_hora
FROM registro_actividad ra
LEFT JOIN usuario u ON ra.usuario_id = u.id
ORDER BY ra.fecha_hora DESC;


