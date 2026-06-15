# Segukey — Backend API REST

Conecta el frontend HTML/JS con PostgreSQL mediante una API REST en Node.js + Express.


## Instalación

### 1. Crear la base de datos

```bash
psql -U postgres
CREATE DATABASE segukey;
\q

psql -U postgres -d segukey -f /ruta/a/segukey/database.sql
```

### 2. Instalar dependencias

```bash
cd segukey-backend
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus datos reales de PostgreSQL
```

### 4. Actualizar contraseñas en la BD

El SQL original tiene hashes de ejemplo. Generar hashes reales con bcrypt:

```bash
node -e "const b=require('bcryptjs'); b.hash('Admin123!',10).then(h=>console.log(h))"
```

Luego actualizar en PostgreSQL:

```sql
UPDATE usuario SET contrasena = '$2b$10$HASH_REAL_AQUI' WHERE correo = 'admin@segukey.com';
-- Repetir para empleado@segukey.com y tester@segukey.com
```

### 5. Copiar el nuevo api.js al frontend

```bash
cp api.js ../segukey/scripts/api.js
```

### 6. Iniciar el servidor

```bash
# Desarrollo (recarga automática)
npm run dev

# Producción
npm start
```

---

## Endpoints disponibles

| Método | Ruta                      | Rol requerido        |
|--------|---------------------------|----------------------|
| POST   | /api/auth/login           | Público              |
| POST   | /api/auth/register        | Público              |
| GET    | /api/usuarios             | Administrador        |
| GET    | /api/usuarios/:id         | Dueño o Admin        |
| POST   | /api/usuarios             | Administrador        |
| PUT    | /api/usuarios/:id         | Dueño o Admin        |
| DELETE | /api/usuarios/:id         | Administrador        |
| GET    | /api/respaldos            | Autenticado          |
| POST   | /api/respaldos            | Autenticado          |
| PUT    | /api/respaldos/:id        | Dueño o Admin        |
| DELETE | /api/respaldos/:id        | Dueño o Admin        |
| GET    | /api/logs                 | Admin / Tester       |
| GET    | /api/alertas              | Administrador        |
| GET    | /api/metricas             | Admin / Tester       |
| GET    | /api/health               | Público              |

---

