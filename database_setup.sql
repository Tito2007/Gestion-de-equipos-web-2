-- =====================================================
- ESTRUCTURA DE BASE DE DATOS PARA GESTIÓN DE EQUIPOS
-- =====================================================

-- Tabla: usuarios_salon
-- Usuarios que utilizan el salón
CREATE TABLE IF NOT EXISTS usuarios_salon (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    equipo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: usuarios
-- Usuarios del sistema (adicional a usuarios_salon)
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    equipo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: herramientas
-- Catálogo de herramientas disponibles
CREATE TABLE IF NOT EXISTS herramientas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    en_uso BOOLEAN DEFAULT FALSE,
    danada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: asignaciones
-- Registro de asignaciones de herramientas a usuarios
CREATE TABLE IF NOT EXISTS asignaciones (-
    id BIGSERIAL PRIMARY KEY,
    usuario_salon_id TEXT REFERENCES usuarios_salon(id) ON DELETE CASCADE,
    herramienta_id TEXT REFERENCES herramientas(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_devolucion TIMESTAMP WITH TIME ZONE,
    devuelta BOOLEAN DEFAULT FALSE
);

-- Tabla: movimientos
-- Historial de todos los movimientos (asignaciones, devoluciones, daños)
CREATE TABLE IF NOT EXISTS movimientos (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'asignacion', 'devolucion', 'danada'
    usuario_salon_id TEXT REFERENCES usuarios_salon(id),
    herramienta_id TEXT REFERENCES herramientas(id),
    usuario_sistema TEXT NOT NULL, -- Email del usuario que realizó la acción
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON asignaciones(usuario_salon_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_herramienta ON asignaciones(herramienta_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_devuelta ON asignaciones(devuelta);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_salon_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_herramienta ON movimientos(herramienta_id);

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios_salon ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios_salon
CREATE POLICY "Usuarios autenticados pueden ver usuarios_salon" 
    ON usuarios_salon FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar usuarios_salon" 
    ON usuarios_salon FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar usuarios_salon" 
    ON usuarios_salon FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar usuarios_salon" 
    ON usuarios_salon FOR DELETE 
    TO authenticated 
    USING (true);

-- Políticas para usuarios
CREATE POLICY "Usuarios autenticados pueden ver usuarios" 
    ON usuarios FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar usuarios" 
    ON usuarios FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar usuarios" 
    ON usuarios FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar usuarios" 
    ON usuarios FOR DELETE 
    TO authenticated 
    USING (true);

-- Políticas para herramientas
CREATE POLICY "Usuarios autenticados pueden ver herramientas" 
    ON herramientas FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar herramientas" 
    ON herramientas FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar herramientas" 
    ON herramientas FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar herramientas" 
    ON herramientas FOR DELETE 
    TO authenticated 
    USING (true);

-- Políticas para asignaciones
CREATE POLICY "Usuarios autenticados pueden ver asignaciones" 
    ON asignaciones FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar asignaciones" 
    ON asignaciones FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones" 
    ON asignaciones FOR UPDATE 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar asignaciones" 
    ON asignaciones FOR DELETE 
    TO authenticated 
    USING (true);

-- Políticas para movimientos
CREATE POLICY "Usuarios autenticados pueden ver movimientos" 
    ON movimientos FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar movimientos" 
    ON movimientos FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =====================================================

-- Insertar herramientas de ejemplo
-- INSERT INTO herramientas (id, nombre, en_uso, danada) VALUES
--     ('microfono1', 'Micrófono inalámbrico 1', false, false),
--     ('microfono2', 'Micrófono inalámbrico 2', false, false),
--     ('camara1', 'Cámara HD 1', false, false),
--     ('proyector1', 'Proyector LED', false, false),
--     ('laptop1', 'Laptop HP', false, false);

-- Insertar usuarios de ejemplo
-- INSERT INTO usuarios_salon (id, nombre, equipo) VALUES
--     ('juan perez', 'Juan Pérez', '1'),
--     ('maria garcia', 'María García', '2'),
--     ('carlos ruiz', 'Carlos Ruiz', '1');
