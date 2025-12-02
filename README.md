# Sistema de Gestión de Equipos - Salón de Asambleas

Sistema web completo para la gestión de herramientas y equipos en el Salón de Asambleas de Guayaquil, Ecuador.

## 🚀 Características

### 1. Autenticación
- Login con email y contraseña
- Registro de nuevos usuarios
- Recuperación de contraseña
- Sesión persistente con Supabase Auth

### 2. Salón (Gestión Principal)
- **Registrar usuarios del salón** con nombre y equipo (ID automático en minúsculas)
- **Buscar usuarios** con filtro de texto y selección por doble clic
- **Ver herramientas asignadas** al usuario seleccionado
- **Ver todas las herramientas** disponibles (Libre / En uso)
- **Asignar herramienta**: Doble clic en herramienta libre
- **Devolver herramienta**: Seleccionar herramienta del usuario → botón "Marcar como devuelta"
- **Marcar dañada**: Arrastrar herramienta desde usuario a lista de dañadas (drag & drop)
- **Eliminar usuario**: Solo si no tiene herramientas asignadas
- **Botón Refrescar**: Recargar todos los datos

### 3. Nueva Herramienta
- **Crear manualmente**: Ingresar nombre (ID automático en minúsculas)
- **Importar CSV**: 
  - Con cabeceras: `id, nombre, enUso`
  - Sin cabecera: `nombre[,enUso]`
  - Valores aceptados para enUso: `true, 1, si, sí, en uso, usada, ocupada`

### 4. Menú Principal
Accesos rápidos a:
- Salón
- Usuarios (CRUD)
- Nueva Herramienta
- Reportes
- Historial
- Ayuda

### 5. Usuarios (CRUD)
- Buscar usuarios por nombre
- Crear/editar usuarios (nombre + equipo)
- ID generado automáticamente en minúsculas
- Doble clic para editar

### 6. Reportes
- Exportar todos los movimientos a `reporte_movimientos.csv`
- Campos: `tipo, usuarioSalonId, herramientaId, usuarioSistema, fecha`
- Estadísticas en tiempo real:
  - Total de herramientas
  - Herramientas en uso
  - Herramientas libres
  - Herramientas dañadas
  - Total de usuarios registrados

### 7. Historial
- Buscar por usuario (texto + doble clic)
- Buscar por herramienta (texto + doble clic)
- Aplicar filtros combinados
- Ver detalles de cada movimiento con fecha y usuario del sistema

### 8. Sesión
- Botón "Cerrar Sesión" en el header
- Limpieza automática del contexto
- Redirección al login

## 📋 Requisitos Previos

- Cuenta en [Supabase](https://supabase.com/)
- Navegador web moderno (Chrome, Firefox, Safari, Edge)

## 🔧 Configuración

### 1. Configurar Supabase

1. Crea un proyecto en Supabase
2. Ve a `SQL Editor` en tu proyecto de Supabase
3. Copia y ejecuta el contenido del archivo `database_setup.sql`
4. Esto creará todas las tablas necesarias con sus políticas de seguridad

### 2. Configurar credenciales

1. Abre el archivo `config.js`
2. Reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY` con tus credenciales:

```javascript
const SUPABASE_URL = 'TU_URL_DE_SUPABASE';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_DE_SUPABASE';
```

**Para obtener tus credenciales:**
- Ve a tu proyecto en Supabase
- Menú lateral → Settings → API
- Copia `Project URL` y `anon/public key`

### 3. Habilitar Email Auth en Supabase

1. Ve a Authentication → Providers
2. Habilita "Email" provider
3. Configura las URLs de redirección si es necesario

## 🌐 Despliegue

### Opción 1: Local
1. Abre `login.html` en tu navegador
2. Asegúrate de que los archivos CSS y JS estén en la misma carpeta

### Opción 2: Servidor Web
1. Sube todos los archivos a tu servidor web
2. Asegúrate de que el servidor permita servir archivos estáticos
3. Accede a través de tu dominio

### Opción 3: Netlify/Vercel (Recomendado)
1. Conecta tu repositorio
2. No necesitas configuración de build
3. Deploy automático

## 📁 Estructura de Archivos

```
/
├── login.html              # Página de inicio de sesión
├── login.css              # Estilos del login
├── login.js               # Lógica del login
├── inicio.html            # Página principal del sistema
├── inicio.css             # Estilos de la aplicación
├── inicio.js              # Lógica principal
├── config.js              # Configuración de Supabase
├── database_setup.sql     # Script SQL para crear tablas
└── README.md             # Este archivo
```

## 📊 Estructura de Base de Datos

### Tablas

1. **usuarios_salon**: Usuarios que usan el salón
   - `id` (TEXT, PK)
   - `nombre` (TEXT)
   - `equipo` (TEXT)
   - `created_at` (TIMESTAMP)

2. **usuarios**: Usuarios del sistema
   - `id` (TEXT, PK)
   - `nombre` (TEXT)
   - `equipo` (TEXT)
   - `created_at` (TIMESTAMP)

3. **herramientas**: Catálogo de herramientas
   - `id` (TEXT, PK)
   - `nombre` (TEXT)
   - `en_uso` (BOOLEAN)
   - `danada` (BOOLEAN)
   - `created_at` (TIMESTAMP)

4. **asignaciones**: Registro de asignaciones
   - `id` (BIGSERIAL, PK)
   - `usuario_salon_id` (TEXT, FK)
   - `herramienta_id` (TEXT, FK)
   - `fecha_asignacion` (TIMESTAMP)
   - `fecha_devolucion` (TIMESTAMP)
   - `devuelta` (BOOLEAN)

5. **movimientos**: Historial completo
   - `id` (BIGSERIAL, PK)
   - `tipo` (TEXT): 'asignacion', 'devolucion', 'danada'
   - `usuario_salon_id` (TEXT, FK)
   - `herramienta_id` (TEXT, FK)
   - `usuario_sistema` (TEXT)
   - `fecha` (TIMESTAMP)

## ⚠️ Notas Importantes

- Todos los IDs se generan automáticamente en **minúsculas**
- Una herramienta **"En uso" no se puede asignar** a otro usuario
- **No se puede eliminar** un usuario que tenga herramientas asignadas
- Los movimientos se registran automáticamente para auditoría
- El sistema requiere autenticación para todas las operaciones

## 🎨 Diseño Responsivo

El sistema está completamente optimizado para:
- ✅ Desktop (1920x1080 y superiores)
- ✅ Tablets (768px - 1024px)
- ✅ Móviles (320px - 767px)

## 🔐 Seguridad

- Autenticación con Supabase Auth
- Row Level Security (RLS) habilitado en todas las tablas
- Solo usuarios autenticados pueden acceder al sistema
- Sesiones seguras con tokens JWT
- Políticas de acceso configuradas en la base de datos

## 🐛 Solución de Problemas

### Error: "No se puede conectar a Supabase"
- Verifica que las credenciales en `config.js` sean correctas
- Asegúrate de que tu proyecto de Supabase esté activo

### Error: "No se pueden cargar los datos"
- Verifica que las tablas estén creadas ejecutando `database_setup.sql`
- Revisa que RLS esté configurado correctamente
- Verifica las políticas de seguridad en Supabase

### Error en el login
- Verifica que Email Auth esté habilitado en Supabase
- Asegúrate de que el usuario esté registrado

## 📝 Licencia

© 2025 Gestión de equipos - Salón de Asambleas Guayaquil Ecuador

## 👥 Soporte

Para soporte o preguntas, contacta al administrador del sistema.
