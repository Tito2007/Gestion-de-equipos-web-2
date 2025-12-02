// Variables globales
let currentUser = null;
let usuarioSalonSeleccionado = null;
let herramientaSeleccionada = null;
let usuarioEditando = null;
let csvData = null;
let filtroUsuarioHistorial = null;
let filtroHerramientaHistorial = null;
let herramientaParaAsignar = null;
let realtimeChannel = null;
let realtimeInitialized = false;
const refreshTimers = {};
let isAdmin = false;
function debounceRefresh(key, fn, delay = 350) {
    clearTimeout(refreshTimers[key]);
    refreshTimers[key] = setTimeout(fn, delay);
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
console.log('Sesión activa, cargando usuario...');
    currentUser = session.user;
    isAdmin = (currentUser.user_metadata?.role === 'admin');
    
    // Configurar perfil de usuario
    const profileEmail = document.getElementById('profileEmail');
    const profileName = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileAvatarFallback = document.getElementById('profileAvatarFallback');
    
    // Mostrar primero el nombre del usuario (metadata) y debajo el correo
    const nombreUsuario = currentUser.user_metadata?.name
        || currentUser.user_metadata?.full_name
        || (currentUser.email?.split('@')[0] || 'Usuario');
    if (profileName) profileName.textContent = nombreUsuario;
    if (profileEmail) profileEmail.textContent = currentUser.email || '';
    
    // Intentar cargar avatar del usuario
    if (currentUser.user_metadata?.avatar_url) {
        if (profileAvatar) {
            profileAvatar.src = currentUser.user_metadata.avatar_url;
            profileAvatar.style.display = 'block';
        }
        if (profileAvatarFallback) {
            profileAvatarFallback.style.display = 'none';
        }
    }

    // Event listeners
    const btnAsignar = document.getElementById('btnAsignar');
    if (btnAsignar) btnAsignar.addEventListener('click', onAsignarClick);

    // UI solo para admins: ocultar importar CSV si no es admin
    if (!isAdmin) {
        const csvFileEl = document.getElementById('csvFile');
        const btnImportCSV = document.getElementById('btnImportarCSV');
        const csvPreviewEl = document.getElementById('csvPreview');
        if (csvFileEl) csvFileEl.style.display = 'none';
        if (btnImportCSV) btnImportCSV.style.display = 'none';
        if (csvPreviewEl) csvPreviewEl.style.display = 'none';
    }

    // Cargar datos iniciales
    showView('menuPrincipal');
    initRealtime();
    // Comprobar conectividad al iniciar
    setTimeout(checkSupabaseConnectivity, 200);
    // Cargar notificaciones al inicio y mostrar si hay pendientes
    await cargarNotificaciones();
    mostrarNotificacionesSiPendientes();
});

// ===== OVERLAY DE CARGA =====
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'block';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ===== NAVEGACIÓN =====
function showView(viewName) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(viewName);
    if (targetView) {
        targetView.classList.add('active');
        
        // Cargar datos según la vista
        if (viewName === 'salon') {
            cargarDatosSalon();
        } else if (viewName === 'usuarios') {
            cargarUsuarios();
        } else if (viewName === 'reportes') {
            cargarEstadisticas();
        } else if (viewName === 'nuevaHerramienta') {
            cargarListadoHerramientasNueva();
        }
    }
}

// ===== REALTIME =====
function initRealtime() {
    if (realtimeInitialized) return;
    realtimeInitialized = true;
    realtimeChannel = supabase.channel('rt-equipo')
        // Usuarios del salón
        .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios_salon' }, payload => {
            debounceRefresh('usuariosSalon', async () => {
                if (document.getElementById('salon').classList.contains('active')) {
                    await cargarUsuariosSalon();
                }
                if (document.getElementById('usuarios').classList.contains('active')) {
                    await cargarUsuarios();
                }
                // Si el usuario seleccionado fue borrado
                if (usuarioSalonSeleccionado && payload.eventType === 'DELETE' && payload.old?.id === usuarioSalonSeleccionado.id) {
                    deseleccionarUsuarioSalon();
                }
            });
        })
        // Herramientas
        .on('postgres_changes', { event: '*', schema: 'public', table: 'herramientas' }, payload => {
            debounceRefresh('herramientas', async () => {
                if (document.getElementById('salon').classList.contains('active')) {
                    await cargarHerramientas();
                }
                if (document.getElementById('nuevaHerramienta').classList.contains('active')) {
                    await cargarListadoHerramientasNueva();
                }
            });
        })
        // Asignaciones
        .on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones' }, payload => {
            debounceRefresh('asignaciones', async () => {
                if (document.getElementById('salon').classList.contains('active')) {
                    // Actualizar herramientas y badge del usuario involucrado
                    await cargarHerramientas();
                    const usuarioId = payload.new?.usuario_salon_id || payload.old?.usuario_salon_id;
                    if (usuarioId) await actualizarBadgeUsuarioSalon(usuarioId);
                    if (usuarioSalonSeleccionado && usuarioSalonSeleccionado.id === usuarioId) {
                        await cargarHerramientasUsuario();
                    }
                }
            });
        })
        // Movimientos (historial)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos' }, payload => {
            debounceRefresh('movimientos', () => {
                if (document.getElementById('historial').classList.contains('active')) {
                    buscarHistorial();
                }
            });
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                console.log('Realtime conectado');
            }
        });
}

// ===== SESIÓN =====
async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

function toggleProfileMenu() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function cambiarCuenta() {
    // Cerrar sesión y redirigir al login para cambiar de cuenta
    cerrarSesion();
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    const profileContainer = document.querySelector('.user-profile-container');
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown && profileContainer && !profileContainer.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ===== NOTIFICACIONES =====
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('slide-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Panel de notificaciones (pendientes de entrega)
async function cargarNotificaciones() {
    try {
        const { data, error } = await supabase
            .from('asignaciones')
            .select('id, usuario_salon_id, herramienta_id, devuelta, fecha_asignacion, usuarios_salon(nombre, equipo), herramientas(nombre)')
            .eq('devuelta', false)
            .order('fecha_asignacion', { ascending: false });
        if (error) throw error;
        const cont = document.getElementById('listaNotificaciones');
        const badge = document.getElementById('notifBadge');
        if (!cont) return;
        cont.innerHTML = '';
        if (!data || data.length === 0) {
            cont.innerHTML = '<div class="info-text">No hay pendientes</div>';
            if (badge) {
                badge.style.display = 'none';
                badge.textContent = '0';
            }
            return;
        }
        if (badge) {
            badge.textContent = String(data.length);
            badge.style.display = 'inline-flex';
        }
        data.forEach(item => {
            const el = document.createElement('div');
            el.className = 'notification-item';
            const u = item.usuarios_salon;
            const h = item.herramientas;
            const fecha = new Date(item.fecha_asignacion);
            const difMin = Math.round((Date.now() - fecha.getTime()) / 60000);
            const tiempo = difMin < 60 ? `${difMin} min` : `${Math.round(difMin/60)} h`;
            el.innerHTML = `
                <div class="notification-title">${u?.nombre || 'Usuario'} no ha entregado: ${h?.nombre || 'Herramienta'}</div>
                <div class="notification-sub">Equipo: ${u?.equipo || '—'} • Asignada hace ${tiempo}</div>
            `;
            cont.appendChild(el);
        });
    } catch (e) {
        console.warn('Error cargando notificaciones:', e);
    }
}

function abrirNotificaciones() {
    const panel = document.getElementById('panelNotificaciones');
    const backdrop = document.getElementById('notificacionesBackdrop');
    if (panel) panel.style.display = 'block';
    if (backdrop) backdrop.style.display = 'block';
    cargarNotificaciones();
}

function cerrarNotificaciones() {
    const panel = document.getElementById('panelNotificaciones');
    const backdrop = document.getElementById('notificacionesBackdrop');
    if (panel) panel.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
}

function mostrarNotificacionesSiPendientes() {
    const cont = document.getElementById('listaNotificaciones');
    if (!cont) return;
    // Abrir si hay elementos además del mensaje vacío
    if (cont.children.length > 0 && !cont.textContent.includes('No hay pendientes')) {
        abrirNotificaciones();
    }
}

// ===== CONFIRMACIÓN PERSONALIZADA =====
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        const btnOk = document.getElementById('confirmOk');
        const btnCancel = document.getElementById('confirmCancel');

        messageEl.textContent = message;
        modal.style.display = 'flex';

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
}

// ===== SALÓN =====
async function cargarDatosSalon() {
    // Reducimos llamadas no críticas al iniciar, para no saturar cuando hay problemas de red
    // await seedDatosPrueba();
    // await eliminarUsuariosPrueba();
    // await eliminarHerramientasPrueba();
    await cargarUsuariosSalon();
    await cargarHerramientas();
    await reconciliarEstadoHerramientas();
}

async function registrarUsuarioSalon() {
    const nombre = document.getElementById('salonNombre').value.trim();
    const equipo = document.getElementById('salonEquipo').value.trim();

    if (!nombre || !equipo) {
        showNotification('Completa todos los campos', 'error');
        return;
    }

    const id = nombre.toLowerCase();

    try {
        const { error } = await supabase
            .from('usuarios_salon')
            .insert([{ id, nombre, equipo }]);

        if (error) throw error;

        showNotification('Usuario registrado correctamente', 'success');
        document.getElementById('salonNombre').value = '';
        document.getElementById('salonEquipo').value = '';
        await cargarUsuariosSalon();
    } catch (error) {
        showNotification('Error al registrar usuario: ' + error.message, 'error');
        setConnStatus(false);
    }
}

async function cargarUsuariosSalon() {
    try {
        const { data: usuarios, error } = await supabase
            .from('usuarios_salon')
            .select('*')
            .order('nombre');

        if (error) throw error;

        // Asignaciones activas para el estado
        const { data: asignacionesActivas } = await supabase
            .from('asignaciones')
            .select('usuario_salon_id, herramienta_id')
            .eq('devuelta', false);

        const conteoPorUsuario = {};
        (asignacionesActivas || []).forEach(a => {
            conteoPorUsuario[a.usuario_salon_id] = (conteoPorUsuario[a.usuario_salon_id] || 0) + 1;
        });

        const lista = document.getElementById('listaUsuariosSalon');
        lista.innerHTML = '';

        usuarios.forEach(usuario => {
            const count = conteoPorUsuario[usuario.id] || 0;
            const badgeClass = count === 0 ? 'ok' : 'warn';
            const badgeText = count === 0 ? 'Sin herramientas' : `${count} herramienta${count>1?'s':''}`;

            const card = document.createElement('div');
            card.className = 'usuario-card';
            card.dataset.userId = usuario.id;
            card.dataset.count = String(count);
            card.innerHTML = `
                <div class="usuario-card-header">
                    <div>
                        <div class="usuario-nombre">${usuario.nombre}</div>
                        <div class="usuario-equipo">${usuario.equipo}</div>
                    </div>
                    <div class="usuario-badge ${badgeClass}">${badgeText}</div>
                </div>
                <div class="usuario-card-actions">
                    <button class="btn-primary btn-seleccionar">Seleccionar</button>
                    <button class="btn-danger btn-eliminar" style="display:none">Eliminar</button>
                </div>
            `;

            card.ondblclick = () => seleccionarUsuarioSalon(usuario, card);
            const btnSel = card.querySelector('.btn-seleccionar');
            btnSel.onclick = () => {
                if (card.classList.contains('selected') && usuarioSalonSeleccionado && usuarioSalonSeleccionado.id === usuario.id) {
                    deseleccionarUsuarioSalon();
                } else {
                    seleccionarUsuarioSalon(usuario, card);
                }
            };
            card.querySelector('.btn-eliminar').onclick = () => {
                const currentCount = parseInt(card.dataset.count || '0', 10);
                if (currentCount > 0) {
                    showNotification('No se puede eliminar: tiene herramientas asignadas', 'error');
                    return;
                }
                eliminarUsuarioSalon(usuario.id, usuario.nombre);
            };

            lista.appendChild(card);
        });
        setConnStatus(true);
    } catch (error) {
        setConnStatus(false);
        console.warn('Error al cargar usuarios del salón:', error);
    }
}

function buscarUsuariosSalon() {
    const busqueda = document.getElementById('buscarUsuarioSalon').value.toLowerCase();
    const items = document.querySelectorAll('#listaUsuariosSalon .usuario-card');

    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(busqueda) ? 'block' : 'none';
    });
}

async function seleccionarUsuarioSalon(usuario, cardEl) {
    usuarioSalonSeleccionado = usuario;
    const nombreEl = document.getElementById('nombreUsuarioSeleccionado');
    if (nombreEl) nombreEl.textContent = `${usuario.nombre} - ${usuario.equipo}`;

    // Marcar selección visual en tarjetas
    document.querySelectorAll('#listaUsuariosSalon .usuario-card').forEach(c => {
        c.classList.remove('selected');
        const delOther = c.querySelector('.btn-eliminar');
        if (delOther) delOther.style.display = 'none';
        const btnOther = c.querySelector('.btn-seleccionar');
        if (btnOther) btnOther.textContent = 'Seleccionar';
    });
    if (cardEl) {
        cardEl.classList.add('selected');
        // Mostrar botón eliminar solo cuando el usuario está seleccionado
        const btn = cardEl.querySelector('.btn-seleccionar');
        if (btn) btn.textContent = 'Deseleccionar';
        const del = cardEl.querySelector('.btn-eliminar');
        if (del) del.style.display = 'inline-block';
    }

    await cargarHerramientasUsuario();
    renderInlineAssignForSelected();
}

function deseleccionarUsuarioSalon() {
    // Limpiar selección y UI del panel derecho
    usuarioSalonSeleccionado = null;
    const nombreEl = document.getElementById('nombreUsuarioSeleccionado');
    if (nombreEl) nombreEl.textContent = 'Ningún usuario seleccionado';
    const listaHerrUsuario = document.getElementById('herramientasUsuario');
    if (listaHerrUsuario) listaHerrUsuario.innerHTML = '';
    const badge = document.getElementById('contadorHerramientasUsuario');
    if (badge) { badge.className = 'badge-counter'; badge.textContent = '—'; }

    // Reset visual en todas las tarjetas
    document.querySelectorAll('#listaUsuariosSalon .usuario-card').forEach(card => {
        card.classList.remove('selected');
        const del = card.querySelector('.btn-eliminar');
        if (del) del.style.display = 'none';
        const btn = card.querySelector('.btn-seleccionar');
        if (btn) btn.textContent = 'Seleccionar';
    });

    // Limpiar acciones inline de herramientas
    clearInlineAssignUI();
}

async function cargarHerramientasUsuario() {
    if (!usuarioSalonSeleccionado) return;

    try {
        const { data, error } = await supabase
            .from('asignaciones')
            .select('*, herramientas(nombre)')
            .eq('usuario_salon_id', usuarioSalonSeleccionado.id)
            .eq('devuelta', false);

        if (error) throw error;

        const lista = document.getElementById('herramientasUsuario');
        lista.innerHTML = '';

        // Actualizar contador en el título
        const badge = document.getElementById('contadorHerramientasUsuario');
        if (badge) {
            badge.className = 'badge-counter ' + (data.length === 0 ? 'ok' : 'warn');
            badge.textContent = data.length === 0 ? 'Sin herramientas' : `${data.length}`;
        }

        if (data.length === 0) {
            lista.innerHTML = '<div class="info-text">No tiene herramientas asignadas</div>';
            return;
        }

        data.forEach(asignacion => {
            const item = document.createElement('div');
            item.className = 'herramienta-item';
            item.textContent = asignacion.herramientas.nombre;
            item.dataset.herramientaId = asignacion.herramienta_id;
            item.onclick = () => seleccionarHerramientaUsuario(item, asignacion.herramienta_id);
            item.draggable = true;
            item.ondragstart = (e) => {
                e.dataTransfer.setData('herramientaId', asignacion.herramienta_id);
            };
            lista.appendChild(item);
        });

        // Configurar zona de drop para herramientas dañadas
        const listaDanadas = document.getElementById('listaHerramientasDanadas');
        listaDanadas.ondragover = (e) => e.preventDefault();
        listaDanadas.ondrop = async (e) => {
            e.preventDefault();
            const herramientaId = e.dataTransfer.getData('herramientaId');
            await marcarComoDanada(herramientaId);
        };

    } catch (error) {
        setConnStatus(false);
        console.error('Error al cargar herramientas del usuario:', error);
    }
}

function seleccionarHerramientaUsuario(item, herramientaId) {
    // Toggle: si ya está seleccionada, deseleccionar y limpiar UI inline
    if (item.classList.contains('selected')) {
        document.querySelectorAll('#herramientasUsuario .herramienta-item').forEach(el => el.classList.remove('selected'));
        herramientaSeleccionada = null;
        clearInlineUserToolUI();
        return;
    }

    // Seleccionar este ítem y mostrar acciones inline
    document.querySelectorAll('#herramientasUsuario .herramienta-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    herramientaSeleccionada = herramientaId;
    renderInlineUserToolActions(item, herramientaId);
}

async function marcarComoDevuelta() {
    if (!herramientaSeleccionada || !usuarioSalonSeleccionado) {
        showNotification('Selecciona una herramienta', 'error');
        return;
    }

    // Guardar referencias antes de limpiar las variables
    const herramientaId = herramientaSeleccionada;
    const usuarioId = usuarioSalonSeleccionado.id;

    try {
        // Marcar como devuelta
        const { error: errorAsignacion } = await supabase
            .from('asignaciones')
            .update({ devuelta: true, fecha_devolucion: new Date() })
            .eq('herramienta_id', herramientaId)
            .eq('usuario_salon_id', usuarioId)
            .eq('devuelta', false);

        if (errorAsignacion) throw errorAsignacion;

        // Verificar si hay otras asignaciones activas de esta herramienta
        const { data: asignacionesActivas, error: errorCheck } = await supabase
            .from('asignaciones')
            .select('id')
            .eq('herramienta_id', herramientaId)
            .eq('devuelta', false);

        if (errorCheck) throw errorCheck;

        // Solo marcar como libre si no hay otras asignaciones activas
        const debeEstarLibre = !asignacionesActivas || asignacionesActivas.length === 0;
        
        console.log('🔍 DEBUG - Herramienta:', herramientaId);
        console.log('🔍 Asignaciones activas restantes:', asignacionesActivas);
        console.log('🔍 Debe estar libre:', debeEstarLibre);
        
        const { error: errorHerramienta } = await supabase
            .from('herramientas')
            .update({ en_uso: !debeEstarLibre })
            .eq('id', herramientaId);

        if (errorHerramienta) throw errorHerramienta;

        // Registrar movimiento
        await registrarMovimiento('devolucion', usuarioId, herramientaId);

        showNotification('Herramienta devuelta correctamente', 'success');
        
        // Limpiar selecciones DESPUÉS de todas las operaciones
        herramientaSeleccionada = null;
        
        // Recargar todas las vistas para asegurar sincronización
        await cargarHerramientasUsuario();
        await cargarHerramientas();
        await cargarListadoHerramientasNueva();
        
        filtrarHerramientas();
        clearInlineAssignUI();
        // Actualizar badge del usuario en tarjetas sin refrescar toda la lista
        await actualizarBadgeUsuarioSalon(usuarioSalonSeleccionado.id);
    } catch (error) {
        showNotification('Error al devolver herramienta: ' + error.message, 'error');
    }
}

async function marcarComoDanada(herramientaId) {
    if (!usuarioSalonSeleccionado) return;

    try {
        // Marcar asignación como devuelta
        const { error: errorAsignacion } = await supabase
            .from('asignaciones')
            .update({ devuelta: true, fecha_devolucion: new Date() })
            .eq('herramienta_id', herramientaId)
            .eq('usuario_salon_id', usuarioSalonSeleccionado.id)
            .eq('devuelta', false);

        if (errorAsignacion) throw errorAsignacion;

        // Marcar herramienta como dañada
        const { error: errorHerramienta } = await supabase
            .from('herramientas')
            .update({ en_uso: false, danada: true })
            .eq('id', herramientaId);

        if (errorHerramienta) throw errorHerramienta;

        // Registrar movimiento
        await registrarMovimiento('danada', usuarioSalonSeleccionado.id, herramientaId);

        showNotification('Herramienta marcada como dañada', 'warning');
        await cargarHerramientasUsuario();
        await cargarHerramientas();
        await reconciliarEstadoHerramientas();
        filtrarHerramientas();
        clearInlineAssignUI();
        await actualizarBadgeUsuarioSalon(usuarioSalonSeleccionado.id);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function cargarHerramientas() {
    try {
        console.log('Cargando herramientas...');
        const { data, error } = await supabase
            .from('herramientas')
            .select('*')
            .eq('danada', false)
            .order('nombre');
console.log('Se envio a supabase...');
        if (error) throw error;
console.log('Correcto...');
        const lista = document.getElementById('listaHerramientas');
        lista.innerHTML = '';

        data.forEach(herramienta => {
            const item = document.createElement('div');
            item.className = `lista-item ${herramienta.en_uso ? 'en-uso' : 'libre'}`;

            const left = document.createElement('div');
            left.textContent = `${herramienta.nombre} - ${herramienta.en_uso ? 'En uso' : 'Libre'}`;
            item.appendChild(left);

            // Click: usa el flujo estándar de selección para mostrar acciones abajo
            item.onclick = () => seleccionarHerramientaParaAsignar(item, herramienta);

            lista.appendChild(item);
        });

        // Cargar herramientas dañadas
        await cargarHerramientasDanadas();
        filtrarHerramientas();
    } catch (error) {
        setConnStatus(false);
        console.error('Error al cargar herramientas:', error);
    }
}

async function cargarHerramientasDanadas() {
    try {
        const { data, error } = await supabase
            .from('herramientas')
            .select('*')
            .eq('danada', true)
            .order('nombre');

        if (error) throw error;

        const lista = document.getElementById('listaHerramientasDanadas');
        lista.innerHTML = '';

        if (data.length === 0) {
            lista.innerHTML = '<div class="info-text">No hay herramientas dañadas</div>';
            return;
        }

        data.forEach(herramienta => {
            const item = document.createElement('div');
            item.className = 'lista-item danada';
            item.textContent = herramienta.nombre;
            item.onclick = () => seleccionarHerramientaDanada(item, herramienta);
            lista.appendChild(item);
        });
    } catch (error) {
        setConnStatus(false);
        console.error('Error al cargar herramientas dañadas:', error);
    }
}

function filtrarHerramientasDanadas() {
    const qInput = document.getElementById('buscarHerramientaDanada');
    const q = (qInput ? qInput.value : '').toLowerCase();
    const items = document.querySelectorAll('#listaHerramientasDanadas .lista-item');
    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(q) ? 'block' : 'none';
    });
}

// Selección y acciones inline para herramientas dañadas
function seleccionarHerramientaDanada(item, herramienta) {
    // Toggle selección: si ya está seleccionada, limpiar
    if (item.classList.contains('selected')) {
        clearInlineDamagedUI();
        return;
    }

    document.querySelectorAll('#listaHerramientasDanadas .lista-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    renderInlineDamagedActions(item, herramienta);
}

function renderInlineDamagedActions(itemEl, herramienta) {
    clearInlineDamagedUI();

    const container = document.createElement('div');
    container.className = 'damaged-actions';

    const info = document.createElement('div');
    info.className = 'info-text';
    info.textContent = 'Marcar como reparada para volver a disponibles.';
    container.appendChild(info);

    const btnReparado = document.createElement('button');
    btnReparado.className = 'btn-primary';
    btnReparado.textContent = 'Reparado';
    btnReparado.onclick = async () => {
        await repararHerramienta(herramienta.id);
        clearInlineDamagedUI();
    };
    container.appendChild(btnReparado);

    itemEl.appendChild(container);
}

function clearInlineDamagedUI() {
    document.querySelectorAll('#listaHerramientasDanadas .damaged-actions').forEach(el => el.remove());
    document.querySelectorAll('#listaHerramientasDanadas .lista-item').forEach(el => el.classList.remove('selected'));
}

async function repararHerramienta(herramientaId) {
    try {
        const { error } = await supabase
            .from('herramientas')
            .update({ danada: false, en_uso: false })
            .eq('id', herramientaId);

        if (error) throw error;

        await registrarMovimiento('reparada', usuarioSalonSeleccionado ? usuarioSalonSeleccionado.id : null, herramientaId);
        showNotification('Herramienta reparada y disponible', 'success');

        // Recargar listas
        await cargarHerramientas();
        await cargarHerramientasDanadas();
        filtrarHerramientas();
    } catch (e) {
        setConnStatus(false);
        showNotification('Error al reparar herramienta: ' + e.message, 'error');
    }
}

function filtrarHerramientas() {
    const filtro = document.querySelector('input[name="filtroHerramientas"]:checked').value;
    const queryInput = document.getElementById('buscarHerramientaSalon');
    const q = (queryInput ? queryInput.value : '').toLowerCase();
    const items = document.querySelectorAll('#listaHerramientas .lista-item');

    items.forEach(item => {
        const coincideTexto = item.textContent.toLowerCase().includes(q);
        const esLibre = item.classList.contains('libre');
        const esEnUso = item.classList.contains('en-uso');

        let coincideEstado = true;
        if (filtro === 'libres') coincideEstado = esLibre;
        else if (filtro === 'enUso') coincideEstado = esEnUso;

        item.style.display = (coincideTexto && coincideEstado) ? 'block' : 'none';
    });
}

// ===== Asignación inline por item =====
function seleccionarHerramientaParaAsignar(item, herramienta) {
    // Toggle selección: si ya está seleccionada, deseleccionar y limpiar UI
    if (item.classList.contains('selected')) {
        clearInlineAssignUI();
        return;
    }

    // Seleccionar nuevo item
    document.querySelectorAll('#listaHerramientas .lista-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    // Guardar la herramienta seleccionada (aunque esté en uso para mostrar mensaje)
    herramientaParaAsignar = herramienta;
    renderInlineAssignForSelected();
}

function renderInlineAssignForSelected() {
    // Eliminar acciones previas
    document.querySelectorAll('#listaHerramientas .tool-actions').forEach(el => el.remove());

    const selectedItem = document.querySelector('#listaHerramientas .lista-item.selected');
    if (!selectedItem || !herramientaParaAsignar) return;

    const container = document.createElement('div');
    container.className = 'tool-actions';
    if (herramientaParaAsignar.en_uso) {
        // Mostrar quién la tiene y permitir seleccionar ese usuario
        const info = document.createElement('div');
        info.className = 'info-text';
        info.textContent = 'Esta herramienta está en uso.';
        container.appendChild(info);

        const sep = document.createElement('div');
        sep.className = 'divider';
        container.appendChild(sep);

        const acciones = document.createElement('div');
        acciones.className = 'actions-inline';

        // Consultar asignación activa para obtener usuario
        (async () => {
            const { data: asign } = await supabase
                .from('asignaciones')
                .select('usuario_salon_id, usuarios_salon:usuario_salon_id(id, nombre, equipo)')
                .eq('herramienta_id', herramientaParaAsignar.id)
                .eq('devuelta', false)
                .limit(1)
                .maybeSingle();

            if (asign && asign.usuarios_salon) {
                const btnSel = document.createElement('button');
                btnSel.className = 'btn-secondary';
                btnSel.textContent = `${asign.usuarios_salon.nombre} · ${asign.usuarios_salon.equipo}`;
                btnSel.onclick = async () => {
                    // Seleccionar tarjeta del usuario
                    const cards = document.querySelectorAll('#listaUsuariosSalon .usuario-card');
                    let cardEl = null;
                    cards.forEach(card => {
                        if (card.dataset.userId === asign.usuarios_salon.id) cardEl = card;
                    });
                    await seleccionarUsuarioSalon(asign.usuarios_salon, cardEl);
                };
                acciones.appendChild(btnSel);
            } else {
                const noInfo = document.createElement('div');
                noInfo.className = 'info-text';
                noInfo.textContent = 'No se encontró el usuario asignado.';
                acciones.appendChild(noInfo);
            }

            container.appendChild(acciones);
        })();

        selectedItem.appendChild(container);
        return;
    }

    const info = document.createElement('div');
    info.className = 'info-text';
    if (usuarioSalonSeleccionado) {
        info.textContent = `Asignar "${herramientaParaAsignar.nombre}" a ${usuarioSalonSeleccionado.nombre} - ${usuarioSalonSeleccionado.equipo}.`;
    } else {
        info.textContent = `Seleccionada: ${herramientaParaAsignar.nombre}. Elige un usuario para asignar.`;
    }
    container.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = 'Asignar';
    btn.disabled = !usuarioSalonSeleccionado;
    btn.onclick = async () => {
        if (!usuarioSalonSeleccionado) return;
        await asignarHerramienta(herramientaParaAsignar.id);
        clearInlineAssignUI();
    };
    container.appendChild(btn);

    selectedItem.appendChild(container);
}
// Acciones inline dentro del ítem de herramienta del usuario
function renderInlineUserToolActions(itemEl, herramientaId) {
    // Limpiar cualquier bloque previo
    clearInlineUserToolUI();

    const container = document.createElement('div');
    container.className = 'user-tool-actions';

    const info = document.createElement('div');
    info.className = 'info-text';
    info.textContent = 'Puedes entregar o marcar como dañada.';
    container.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'actions-inline';

    const btnEntregar = document.createElement('button');
    btnEntregar.className = 'btn-primary';
    btnEntregar.textContent = 'Entregar';
    btnEntregar.onclick = async () => {
        herramientaSeleccionada = herramientaId;
        await marcarComoDevuelta();
        clearInlineUserToolUI();
    };

    const btnDanada = document.createElement('button');
    btnDanada.className = 'btn-danger';
    btnDanada.textContent = 'Marcar como dañada';
    btnDanada.onclick = async () => {
        await marcarComoDanada(herramientaId);
        clearInlineUserToolUI();
    };

    actions.appendChild(btnEntregar);
    actions.appendChild(btnDanada);
    container.appendChild(actions);

    itemEl.appendChild(container);
}

function clearInlineUserToolUI() {
    document.querySelectorAll('#herramientasUsuario .user-tool-actions').forEach(el => el.remove());
}

function clearInlineAssignUI() {
    herramientaParaAsignar = null;
    document.querySelectorAll('#listaHerramientas .tool-actions').forEach(el => el.remove());
    document.querySelectorAll('#listaHerramientas .lista-item').forEach(el => el.classList.remove('selected'));
}

async function asignarHerramienta(herramientaId) {
    if (!usuarioSalonSeleccionado) {
        showNotification('Selecciona un usuario primero', 'error');
        return;
    }

    try {
        // Verificar que la herramienta esté libre
        const { data: herramienta } = await supabase
            .from('herramientas')
            .select('en_uso')
            .eq('id', herramientaId)
            .single();

        if (herramienta.en_uso) {
            showNotification('Esta herramienta ya está en uso', 'error');
            return;
        }

        // Crear asignación
        const { error: errorAsignacion } = await supabase
            .from('asignaciones')
            .insert([{
                usuario_salon_id: usuarioSalonSeleccionado.id,
                herramienta_id: herramientaId,
                fecha_asignacion: new Date(),
                devuelta: false
            }]);

        if (errorAsignacion) throw errorAsignacion;

        // Actualizar estado de herramienta
        const { error: errorHerramienta } = await supabase
            .from('herramientas')
            .update({ en_uso: true })
            .eq('id', herramientaId);

        if (errorHerramienta) throw errorHerramienta;

        // Registrar movimiento
        await registrarMovimiento('asignacion', usuarioSalonSeleccionado.id, herramientaId);

        showNotification('Herramienta asignada correctamente', 'success');
        await cargarHerramientasUsuario();
        await cargarHerramientas();
        await reconciliarEstadoHerramientas();
        filtrarHerramientas();
        clearInlineAssignUI();
        await actualizarBadgeUsuarioSalon(usuarioSalonSeleccionado.id);
    } catch (error) {
        showNotification('Error al asignar herramienta: ' + error.message, 'error');
    }
}

// Actualiza el badge de conteo en la tarjeta del usuario del salón sin recargar toda la lista
async function actualizarBadgeUsuarioSalon(usuarioId) {
    try {
        const { count } = await supabase
            .from('asignaciones')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_salon_id', usuarioId)
            .eq('devuelta', false);

        const card = Array.from(document.querySelectorAll('#listaUsuariosSalon .usuario-card'))
            .find(c => c.dataset.userId === usuarioId);
        if (!card) return;

        const badge = card.querySelector('.usuario-badge');
        if (!badge) return;

        const cnt = count || 0;
        badge.classList.remove('ok', 'warn');
        badge.classList.add(cnt === 0 ? 'ok' : 'warn');
        badge.textContent = cnt === 0 ? 'Sin herramientas' : `${cnt} herramienta${cnt>1?'s':''}`;
        // Actualizar dataset para reflejar el conteo y validar en el clic
        card.dataset.count = String(cnt);
        // No ocultamos el botón eliminar; mostramos mensaje cuando cnt>0
    } catch (e) {
        console.warn('No se pudo actualizar el badge del usuario:', e.message);
    }
}

async function refrescarSalon() {
    try {
        showLoading();
        await reconciliarEstadoHerramientas();
        await cargarDatosSalon();
        await cargarListadoHerramientasNueva();
    } finally {
        hideLoading();
    }
    usuarioSalonSeleccionado = null;
    herramientaSeleccionada = null;
    document.getElementById('nombreUsuarioSeleccionado').textContent = 'Ningún usuario seleccionado';
    document.getElementById('herramientasUsuario').innerHTML = '';
    const badge = document.getElementById('contadorHerramientasUsuario');
    if (badge) { badge.className = 'badge-counter'; badge.textContent = '—'; }
    clearInlineAssignUI();
    showNotification('Datos actualizados y sincronizados', 'success');
}

// Eliminar usuario del salón (solo si no tiene herramientas activas)
async function eliminarUsuarioSalon(usuarioId, nombreUsuario) {
    try {
        // Confirmación previa
        const confirmado = await showConfirm(`¿Eliminar al usuario "${nombreUsuario || usuarioId}"? Esta acción no se puede deshacer.`);
        if (!confirmado) return;

        const { count } = await supabase
            .from('asignaciones')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_salon_id', usuarioId)
            .eq('devuelta', false);

        if ((count || 0) > 0) {
            showNotification('No se puede eliminar: tiene herramientas asignadas', 'error');
            return;
        }

        // Ya no intentamos actualizar 'movimientos' desde el front.
        // La FK en BD debe encargarse (ON DELETE SET NULL) al eliminar el usuario.

        const { error } = await supabase
            .from('usuarios_salon')
            .delete()
            .eq('id', usuarioId);

        if (error) throw error;

        if (usuarioSalonSeleccionado && usuarioSalonSeleccionado.id === usuarioId) {
            usuarioSalonSeleccionado = null;
            document.getElementById('nombreUsuarioSeleccionado').textContent = 'Ningún usuario seleccionado';
            document.getElementById('herramientasUsuario').innerHTML = '';
            const badge = document.getElementById('contadorHerramientasUsuario');
            if (badge) { badge.className = 'badge-counter'; badge.textContent = '—'; }
        }

        showNotification('Usuario eliminado', 'success');
        await cargarUsuariosSalon();
    } catch (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('foreign key') || msg.includes('violates')) {
            showNotification('No se pudo eliminar: existe una referencia en el historial. Verifica la configuración de la base de datos.', 'error');
        } else {
            showNotification('Error al eliminar usuario: ' + error.message, 'error');
        }
    }
}

// Sembrado de datos de prueba si tablas están vacías
async function seedDatosPrueba() {
    try {
        const { count: usuariosCount } = await supabase
            .from('usuarios_salon')
            .select('*', { count: 'exact', head: true });
        // Ya no insertamos usuarios de prueba automáticamente

        const { count: herramientasCount } = await supabase
            .from('herramientas')
            .select('*', { count: 'exact', head: true });

        // Ya no insertamos herramientas de prueba automáticamente
    } catch (e) {
        console.warn('Seed opcional falló:', e.message);
    }
}

// Eliminar usuarios de prueba si existen
async function eliminarUsuariosPrueba() {
    try {
        const ids = ['mathew gomez','ana perez','luis torres'];
        const { data: existentes } = await supabase
            .from('usuarios_salon')
            .select('id')
            .in('id', ids);
        if (existentes && existentes.length > 0) {
            await supabase
                .from('usuarios_salon')
                .delete()
                .in('id', ids);
        }
    } catch (e) {
        console.warn('No se pudieron eliminar usuarios de prueba:', e.message);
    }
}

// Eliminar herramientas de prueba si existen
async function eliminarHerramientasPrueba() {
    try {
        const ids = ['microfono inalambrico','camara hd','proyector led','laptop hp','consola de audio'];
        const { data: existentes } = await supabase
            .from('herramientas')
            .select('id')
            .in('id', ids);
        if (existentes && existentes.length > 0) {
            // Antes de eliminar, marcar asignaciones como devueltas para coherencia
            for (const h of existentes) {
                await supabase
                    .from('asignaciones')
                    .update({ devuelta: true, fecha_devolucion: new Date() })
                    .eq('herramienta_id', h.id)
                    .eq('devuelta', false);
            }
            await supabase
                .from('herramientas')
                .delete()
                .in('id', ids);
        }
    } catch (e) {
        console.warn('No se pudieron eliminar herramientas de prueba:', e.message);
    }
}

// ===== USUARIOS =====
async function cargarUsuarios() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('nombre');

        if (error) throw error;

        const lista = document.getElementById('listaUsuarios');
        lista.innerHTML = '';

        data.forEach(usuario => {
            const item = document.createElement('div');
            item.className = 'lista-item';
            item.innerHTML = `
                <div><strong>${usuario.nombre}</strong></div>
                <div class="info-text">Equipo: ${usuario.equipo}</div>
            `;
            item.ondblclick = () => editarUsuario(usuario);
            lista.appendChild(item);
        });
    } catch (error) {
        setConnStatus(false);
        console.error('Error al cargar usuarios:', error);
    }
}

function buscarUsuarios() {
    const busqueda = document.getElementById('buscarUsuario').value.toLowerCase();
    const items = document.querySelectorAll('#listaUsuarios .lista-item');

    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(busqueda) ? 'block' : 'none';
    });
}

function editarUsuario(usuario) {
    usuarioEditando = usuario;
    document.getElementById('usuarioFormTitle').textContent = 'Editar Usuario';
    document.getElementById('usuarioNombre').value = usuario.nombre;
    document.getElementById('usuarioEquipo').value = usuario.equipo;
    document.getElementById('btnCancelarUsuario').style.display = 'inline-block';
}

function cancelarEdicionUsuario() {
    usuarioEditando = null;
    document.getElementById('usuarioFormTitle').textContent = 'Crear Nuevo Usuario';
    document.getElementById('usuarioNombre').value = '';
    document.getElementById('usuarioEquipo').value = '';
    document.getElementById('btnCancelarUsuario').style.display = 'none';
}

async function guardarUsuario() {
    const nombre = document.getElementById('usuarioNombre').value.trim();
    const equipo = document.getElementById('usuarioEquipo').value.trim();

    if (!nombre || !equipo) {
        showNotification('Completa todos los campos', 'error');
        return;
    }

    const id = nombre.toLowerCase();

    try {
        if (usuarioEditando) {
            // Actualizar
            const { error } = await supabase
                .from('usuarios')
                .update({ nombre, equipo })
                .eq('id', usuarioEditando.id);

            if (error) throw error;
            showNotification('Usuario actualizado correctamente', 'success');
        } else {
            // Crear
            const { error } = await supabase
                .from('usuarios')
                .insert([{ id, nombre, equipo }]);

            if (error) throw error;
            showNotification('Usuario creado correctamente', 'success');
        }

        cancelarEdicionUsuario();
        await cargarUsuarios();
    } catch (error) {
        showNotification('Error al guardar usuario: ' + error.message, 'error');
    }
}

// ===== NUEVA HERRAMIENTA =====
async function crearHerramienta() {
    const nombre = document.getElementById('herramientaNombre').value.trim();

    if (!nombre) {
        showNotification('Ingresa el nombre de la herramienta', 'error');
        return;
    }

    const id = nombre.toLowerCase();

    try {
        // Verificar existencia previa (por id / nombre normalizado)
        const { data: existente } = await supabase
            .from('herramientas')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (existente) {
            showNotification('La herramienta ya existe', 'error');
            return;
        }

        const { error } = await supabase
            .from('herramientas')
            .insert([{ id, nombre, en_uso: false, danada: false }]);

        if (error) throw error;

        showNotification('Herramienta creada correctamente', 'success');
        document.getElementById('herramientaNombre').value = '';
        await cargarListadoHerramientasNueva();
    } catch (error) {
        setConnStatus(false);
        showNotification('Error al crear herramienta: ' + error.message, 'error');
    }
}

// Listado completo para vista Nueva Herramienta
async function cargarListadoHerramientasNueva() {
    try {
        const { data, error } = await supabase
            .from('herramientas')
            .select('*')
            .order('nombre');
        if (error) throw error;
        const cont = document.getElementById('listaHerramientasNueva');
        if (!cont) return;
        cont.innerHTML = '';
        if (!data || data.length === 0) {
            cont.innerHTML = '<div class="info-text">No hay herramientas registradas</div>';
            return;
        }
        data.forEach(h => {
            const item = document.createElement('div');
            item.className = 'lista-item';
            const estado = h.danada ? 'Dañada' : (h.en_uso ? 'En uso' : 'Libre');
            item.textContent = `${h.nombre} - ${estado}`;
            item.dataset.herramientaId = h.id;
            item.onclick = () => seleccionarHerramientaNueva(item, h);
            cont.appendChild(item);
        });
    } catch (e) {
        setConnStatus(false);
        console.error('Error al cargar listado de herramientas:', e);
    }
}

// Búsqueda en listado de nueva herramienta
function buscarHerramientasNueva() {
    const qInput = document.getElementById('buscarHerramientaNueva');
    const q = (qInput ? qInput.value : '').toLowerCase();
    const items = document.querySelectorAll('#listaHerramientasNueva .lista-item');
    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(q) ? 'block' : 'none';
    });
}

function seleccionarHerramientaNueva(itemEl, herramienta) {
    // Toggle: si ya está seleccionada, limpiar
    if (itemEl.classList.contains('selected')) {
        clearInlineDeleteHerramientaNueva();
        return;
    }
    document.querySelectorAll('#listaHerramientasNueva .lista-item').forEach(el => el.classList.remove('selected'));
    clearInlineDeleteHerramientaNueva();
    itemEl.classList.add('selected');
    renderInlineDeleteHerramientaNueva(itemEl, herramienta);
}

function renderInlineDeleteHerramientaNueva(itemEl, herramienta) {
    if (!isAdmin) return; // Solo admins ven acciones de borrado
    const container = document.createElement('div');
    container.className = 'tool-actions';
    const info = document.createElement('div');
    info.className = 'info-text';
    info.textContent = 'Eliminar esta herramienta del sistema.';
    container.appendChild(info);

    const acciones = document.createElement('div');
    acciones.className = 'actions-inline';

    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn-danger';
    btnEliminar.textContent = 'Eliminar Herramienta';
    btnEliminar.onclick = async (e) => {
        e.stopPropagation();
        await eliminarHerramientaNueva(herramienta.id, herramienta.nombre);
    };

    acciones.appendChild(btnEliminar);
    container.appendChild(acciones);
    itemEl.appendChild(container);
}

function clearInlineDeleteHerramientaNueva() {
    document.querySelectorAll('#listaHerramientasNueva .tool-actions').forEach(el => el.remove());
    document.querySelectorAll('#listaHerramientasNueva .lista-item').forEach(el => el.classList.remove('selected'));
}

async function eliminarHerramientaNueva(herramientaId, nombreHerramienta) {
    if (!isAdmin) {
        showNotification('Solo administradores pueden eliminar herramientas', 'error');
        return;
    }
    try {
        // Confirmación
        const ok = await showConfirm(`¿Eliminar la herramienta "${nombreHerramienta}"? Esta acción no se puede deshacer.`);
        if (!ok) return;

        // Marcar asignaciones activas como devueltas antes de eliminar
        const { data: asignActivas } = await supabase
            .from('asignaciones')
            .select('id')
            .eq('herramienta_id', herramientaId)
            .eq('devuelta', false);
        if (asignActivas && asignActivas.length > 0) {
            await supabase
                .from('asignaciones')
                .update({ devuelta: true, fecha_devolucion: new Date() })
                .eq('herramienta_id', herramientaId)
                .eq('devuelta', false);
        }

        // Borrado duro: NO registramos movimiento para evitar nueva referencia

        // Con ON DELETE CASCADE ya no necesitamos borrar movimientos manualmente
        // Solo eliminamos la herramienta y la BD se encarga de sus movimientos vinculados.
        const { error: elimError } = await supabase
            .from('herramientas')
            .delete()
            .eq('id', herramientaId);
        if (elimError) throw elimError;

        showNotification('Herramienta eliminada', 'success');
        clearInlineDeleteHerramientaNueva();
        await cargarListadoHerramientasNueva();
        // Si estamos en salón, refrescar también lista principal
        if (document.getElementById('salon').classList.contains('active')) {
            await cargarHerramientas();
        }
    } catch (e) {
        if ((e.message || '').toLowerCase().includes('foreign key')) {
            showNotification('Aún no está aplicada la FK ON DELETE CASCADE. Ejecuta el SQL indicado.', 'error');
        } else {
            showNotification('Error al eliminar herramienta: ' + e.message, 'error');
        }
        setConnStatus(false);
    }
}

function previewCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        
        csvData = [];
        let tieneCabecera = false;

        // Detectar si tiene cabecera
        const primeraLinea = lines[0].toLowerCase();
        if (primeraLinea.includes('id') || primeraLinea.includes('nombre')) {
            tieneCabecera = true;
            lines.shift(); // Remover cabecera
        }

        lines.forEach(line => {
            const campos = line.split(',').map(c => c.trim());
            if (campos.length >= 1) {
                const nombre = campos[0] || campos[1];
                const enUsoStr = (campos[2] || campos[1] || '').toLowerCase();
                const enUso = ['true', '1', 'si', 'sí', 'en uso', 'usada', 'ocupada'].includes(enUsoStr);
                
                csvData.push({
                    id: nombre.toLowerCase(),
                    nombre: nombre,
                    en_uso: enUso,
                    danada: false
                });
            }
        });

        // Mostrar preview
        const preview = document.getElementById('csvPreview');
        preview.innerHTML = `
            <div><strong>Herramientas detectadas: ${csvData.length}</strong></div>
            <div class="info-text">Primeras 5 entradas:</div>
            ${csvData.slice(0, 5).map(h => 
                `<div>${h.nombre} - ${h.en_uso ? 'En uso' : 'Libre'}</div>`
            ).join('')}
        `;

        document.getElementById('btnImportarCSV').disabled = false;
    };

    reader.readAsText(file);
}

async function importarCSV() {
    if (!isAdmin) {
        showNotification('Solo administradores pueden importar CSV', 'error');
        return;
    }
    if (!csvData || csvData.length === 0) {
        showNotification('No hay datos para importar', 'error');
        return;
    }

    try {
        const { error } = await supabase
            .from('herramientas')
            .insert(csvData);

        if (error) throw error;

        showNotification(`${csvData.length} herramientas importadas correctamente`, 'success');
        document.getElementById('csvFile').value = '';
        document.getElementById('csvPreview').innerHTML = '';
        document.getElementById('btnImportarCSV').disabled = true;
        csvData = null;
    } catch (error) {
        showNotification('Error al importar CSV: ' + error.message, 'error');
    }
}

// ===== REPORTES =====
async function cargarEstadisticas() {
    try {
        // Total de herramientas
        const { count: totalHerramientas } = await supabase
            .from('herramientas')
            .select('*', { count: 'exact', head: true });

        // Herramientas en uso
        const { count: herramientasEnUso } = await supabase
            .from('herramientas')
            .select('*', { count: 'exact', head: true })
            .eq('en_uso', true);

        // Herramientas dañadas
        const { count: herramientasDanadas } = await supabase
            .from('herramientas')
            .select('*', { count: 'exact', head: true })
            .eq('danada', true);

        // Total de usuarios
        const { count: totalUsuarios } = await supabase
            .from('usuarios_salon')
            .select('*', { count: 'exact', head: true });

        const estadisticas = document.getElementById('estadisticas');
        estadisticas.innerHTML = `
            <div class="estadistica-item">
                <div class="estadistica-valor">${totalHerramientas || 0}</div>
                <div class="estadistica-label">Total Herramientas</div>
            </div>
            <div class="estadistica-item">
                <div class="estadistica-valor">${herramientasEnUso || 0}</div>
                <div class="estadistica-label">En Uso</div>
            </div>
            <div class="estadistica-item">
                <div class="estadistica-valor">${(totalHerramientas - herramientasEnUso - herramientasDanadas) || 0}</div>
                <div class="estadistica-label">Libres</div>
            </div>
            <div class="estadistica-item">
                <div class="estadistica-valor">${herramientasDanadas || 0}</div>
                <div class="estadistica-label">Dañadas</div>
            </div>
            <div class="estadistica-item">
                <div class="estadistica-valor">${totalUsuarios || 0}</div>
                <div class="estadistica-label">Usuarios Registrados</div>
            </div>
        `;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

async function exportarMovimientos() {
    try {
        const { data, error } = await supabase
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        // Crear CSV
        const csv = ['tipo,usuarioSalonId,herramientaId,usuarioSistema,fecha'];
        data.forEach(mov => {
            csv.push(`${mov.tipo},${mov.usuario_salon_id},${mov.herramienta_id},${mov.usuario_sistema},${mov.fecha}`);
        });

        // Descargar
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_movimientos.csv';
        a.click();
        window.URL.revokeObjectURL(url);

        showNotification('Reporte exportado correctamente', 'success');
    } catch (error) {
        setConnStatus(false);
        showNotification('Error al exportar reporte: ' + error.message, 'error');
    }
}

// ===== HISTORIAL =====
function buscarHistorialUsuarios() {
    const busqueda = document.getElementById('buscarHistorialUsuario').value.toLowerCase();
    if (busqueda.length < 2) {
        document.getElementById('listaHistorialUsuarios').innerHTML = '';
        return;
    }

    supabase
        .from('usuarios_salon')
        .select('*')
        .ilike('nombre', `%${busqueda}%`)
        .limit(10)
        .then(({ data }) => {
            const lista = document.getElementById('listaHistorialUsuarios');
            lista.innerHTML = '';

            data.forEach(usuario => {
                const item = document.createElement('div');
                item.className = 'lista-item';
                item.textContent = `${usuario.nombre} - Equipo ${usuario.equipo}`;
                item.ondblclick = () => {
                    filtroUsuarioHistorial = usuario.id;
                    document.getElementById('buscarHistorialUsuario').value = usuario.nombre;
                    lista.innerHTML = '';
                };
                lista.appendChild(item);
            });
        });
}

function buscarHistorialHerramientas() {
    const busqueda = document.getElementById('buscarHistorialHerramienta').value.toLowerCase();
    if (busqueda.length < 2) {
        document.getElementById('listaHistorialHerramientas').innerHTML = '';
        return;
    }

    supabase
        .from('herramientas')
        .select('*')
        .ilike('nombre', `%${busqueda}%`)
        .limit(10)
        .then(({ data }) => {
            const lista = document.getElementById('listaHistorialHerramientas');
            lista.innerHTML = '';

            data.forEach(herramienta => {
                const item = document.createElement('div');
                item.className = 'lista-item';
                item.textContent = herramienta.nombre;
                item.ondblclick = () => {
                    filtroHerramientaHistorial = herramienta.id;
                    document.getElementById('buscarHistorialHerramienta').value = herramienta.nombre;
                    lista.innerHTML = '';
                };
                lista.appendChild(item);
            });
        });
}

async function buscarHistorial() {
    try {
        let query = supabase
            .from('movimientos')
            .select('*, usuarios_salon(nombre), herramientas(nombre)')
            .order('fecha', { ascending: false });

        if (filtroUsuarioHistorial) {
            query = query.eq('usuario_salon_id', filtroUsuarioHistorial);
        }

        if (filtroHerramientaHistorial) {
            query = query.eq('herramienta_id', filtroHerramientaHistorial);
        }

        const { data, error } = await query;

        if (error) throw error;

        const resultados = document.getElementById('resultadosHistorial');
        resultados.innerHTML = '';

        if (data.length === 0) {
            resultados.innerHTML = '<div class="info-text">No se encontraron resultados</div>';
            return;
        }

        data.forEach(mov => {
            const item = document.createElement('div');
            item.className = 'historial-item';
            item.innerHTML = `
                <div class="historial-fecha">${new Date(mov.fecha).toLocaleString('es-ES')}</div>
                <div class="historial-detalle">
                    <strong>${mov.tipo.toUpperCase()}</strong> - 
                    Usuario: ${mov.usuarios_salon?.nombre || 'N/A'} - 
                    Herramienta: ${mov.herramientas?.nombre || 'N/A'}
                </div>
                <div class="info-text">Por: ${mov.usuario_sistema}</div>
            `;
            resultados.appendChild(item);
        });
    } catch (error) {
        setConnStatus(false);
        showNotification('Error al buscar historial: ' + error.message, 'error');
    }
}

function limpiarFiltrosHistorial() {
    filtroUsuarioHistorial = null;
    filtroHerramientaHistorial = null;
    document.getElementById('buscarHistorialUsuario').value = '';
    document.getElementById('buscarHistorialHerramienta').value = '';
    document.getElementById('listaHistorialUsuarios').innerHTML = '';
    document.getElementById('listaHistorialHerramientas').innerHTML = '';
    document.getElementById('resultadosHistorial').innerHTML = '';
}

// ===== MOVIMIENTOS =====
async function registrarMovimiento(tipo, usuarioSalonId, herramientaId) {
    try {
        await supabase
            .from('movimientos')
            .insert([{
                tipo,
                usuario_salon_id: usuarioSalonId,
                herramienta_id: herramientaId,
                usuario_sistema: currentUser.email,
                fecha: new Date()
            }]);
    } catch (error) {
        console.error('Error al registrar movimiento:', error);
    }
}

// ===== RECONCILIACIÓN DE ESTADO =====
async function reconciliarEstadoHerramientas() {
    try {
        console.log('🔧 Iniciando reconciliación de estado...');
        
        // Obtener TODAS las herramientas (no solo las no dañadas)
        const { data: herramientas } = await supabase
            .from('herramientas')
            .select('id, nombre, en_uso, danada');

        const { data: asignacionesActivas } = await supabase
            .from('asignaciones')
            .select('herramienta_id')
            .eq('devuelta', false);

        console.log('📊 Total herramientas:', herramientas?.length || 0);
        console.log('📊 Asignaciones activas:', asignacionesActivas?.length || 0);

        const enUsoIds = new Set((asignacionesActivas || []).map(a => a.herramienta_id));
        const updates = [];

        (herramientas || []).forEach(h => {
            // Si está dañada, no debe estar en uso
            // Si no está dañada, debe estar en uso solo si tiene asignación activa
            const debeEstarEnUso = h.danada ? false : enUsoIds.has(h.id);
            
            if (h.en_uso !== debeEstarEnUso) {
                console.log(`🔄 "${h.nombre}" (dañada: ${h.danada}) - Actual: ${h.en_uso ? 'EN USO' : 'LIBRE'} → Correcto: ${debeEstarEnUso ? 'EN USO' : 'LIBRE'}`);
                updates.push({ id: h.id, nombre: h.nombre, en_uso: debeEstarEnUso });
            }
        });

        console.log(`✏️ Actualizando ${updates.length} herramientas...`);
        
        for (const u of updates) {
            const { error } = await supabase
                .from('herramientas')
                .update({ en_uso: u.en_uso })
                .eq('id', u.id);
            
            if (error) {
                console.error(`❌ Error actualizando "${u.nombre}":`, error);
            } else {
                console.log(`✅ "${u.nombre}" actualizada correctamente`);
            }
        }

        // Siempre recargar las vistas para asegurar sincronización
        await cargarHerramientas();
        await cargarListadoHerramientasNueva();
        filtrarHerramientas();
        
        console.log('✅ Reconciliación completada');
    } catch (e) {
        console.warn('⚠️ Reconciliación falló:', e.message);
    }
}

// ===== CONECTIVIDAD =====
function setConnStatus(ok) {
    const el = document.getElementById('profileBtn');
    if (!el) return;
    el.classList.remove('conn-ok','conn-bad','conn-unknown');
    el.title = ok === true ? 'Conectado a Supabase' : ok === false ? 'Sin conexión a Supabase' : 'Comprobando conexión...';
    el.classList.add(ok === true ? 'conn-ok' : ok === false ? 'conn-bad' : 'conn-unknown');
}

async function checkSupabaseConnectivity() {
    try {
        // Petición mínima: contar herramientas (no descarga datos)
        const { error } = await supabase
            .from('herramientas')
            .select('*', { count: 'exact', head: true })
            .limit(1);
        if (error) {
            setConnStatus(false);
        } else {
            setConnStatus(true);
        }
    } catch (e) {
        setConnStatus(false);
    }
}

window.addEventListener('online', () => { setConnStatus(); checkSupabaseConnectivity(); });
window.addEventListener('offline', () => setConnStatus(false));
