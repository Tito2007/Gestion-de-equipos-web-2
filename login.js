// Animación de transición suave entre pantallas
document.addEventListener('DOMContentLoaded', function() {
  var recuperarBtn = document.querySelector('.login-box .actions button[type="button"]');
  var volverBtn = document.querySelector('.recuperar-box .volver-login');
  var registroLink = document.querySelector('.login-box .register-link');
  var volverRegistroBtn = document.querySelector('.registro-box .volver-login-registro');
  var loginBox = document.querySelector('.login-box');
  var recuperarBox = document.querySelector('.recuperar-box');
  var registroBox = document.querySelector('.registro-box');

  // --- SISTEMA DE NOTIFICACIONES PERSONALIZADAS ---
  function showNotification(title, message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Iconos según el tipo
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <p class="notification-message">${message}</p>
      </div>
      <button class="notification-close">×</button>
    `;
    
    // Agregar al body
    document.body.appendChild(notification);
    
    // Botón de cerrar
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
      closeNotification(notification);
    });
    
    // Auto cerrar después de 5 segundos
    setTimeout(function() {
      closeNotification(notification);
    }, 5000);
  }
  
  function closeNotification(notification) {
    notification.classList.add('slide-out');
    setTimeout(function() {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // --- FUNCIONALIDAD DE SUPABASE ---

  // REGISTRO DE USUARIO
  var registroForm = document.querySelector('.registro-box');
  if (registroForm) {
    registroForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const nombre = document.getElementById('registro-nombre').value;
      const email = document.getElementById('registro-email').value;
      const password = document.getElementById('registro-password').value;
      const passwordConfirm = document.getElementById('registro-password-confirm').value;

      // Validar que las contraseñas coincidan
      if (password !== passwordConfirm) {
        showNotification('Error', 'Las contraseñas no coinciden', 'error');
        return;
      }

      // Validar longitud de contraseña
      if (password.length < 6) {
        showNotification('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      try {
        // Registrar usuario en Supabase
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              nombre_completo: nombre
            }
          }
        });

        if (error) throw error;

        showNotification('¡Registro exitoso!', 'Ya puedes iniciar sesión con tu cuenta', 'success');
        
        // Limpiar formulario
        registroForm.reset();
        
        // Volver al login
        setTimeout(function() {
          registroBox.classList.add('fade-out');
          setTimeout(function() {
            registroBox.style.display = 'none';
            loginBox.style.display = 'flex';
            loginBox.classList.add('fade-in');
          }, 500);
        }, 1500);

      } catch (error) {
        console.error('Error en registro:', error);
        if (error.message.includes('already registered')) {
          showNotification('Correo duplicado', 'Este correo ya está registrado. Intenta iniciar sesión.', 'warning');
        } else {
          showNotification('Error al registrar', error.message, 'error');
        }
      }
    });
  }

  // LOGIN DE USUARIO
  var loginForm = document.querySelector('.login-box');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        showNotification('¡Bienvenido!', 'Has iniciado sesión correctamente', 'success');
        
        // Redirigir a inicio.html
        setTimeout(function() {
          window.location.href = 'inicio.html';
        }, 1500);
        
      } catch (error) {
        console.error('Error en login:', error);
        
        // Animación shake
        loginBox.classList.add('shake');
        setTimeout(function() {
          loginBox.classList.remove('shake');
        }, 400);
        
        if (error.message.includes('Invalid login credentials')) {
          showNotification('Credenciales incorrectas', 'El correo o la contraseña son incorrectos', 'error');
        } else {
          showNotification('Error al iniciar sesión', error.message, 'error');
        }
      }
    });
  }

  // RECUPERAR CONTRASEÑA
  var recuperarForm = document.querySelector('.recuperar-box');
  if (recuperarForm) {
    recuperarForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('recuperar-email').value;

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;

        showNotification('Correo enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña', 'success');
        
        // Limpiar formulario
        recuperarForm.reset();
        
      } catch (error) {
        console.error('Error al recuperar contraseña:', error);
        showNotification('Error', error.message, 'error');
      }
    });
  }

  // --- NAVEGACIÓN ENTRE FORMULARIOS ---

  // Botón para ir a Recuperar contraseña
  if (recuperarBtn && loginBox && recuperarBox) {
    recuperarBtn.addEventListener('click', function(e) {
      e.preventDefault();
      loginBox.classList.add('fade-out');
      setTimeout(function() {
        loginBox.style.display = 'none';
        recuperarBox.style.display = 'flex';
        recuperarBox.classList.add('fade-in');
      }, 500);
    });
  }

  // Botón para volver al Login desde Recuperar contraseña
  if (volverBtn && loginBox && recuperarBox) {
    volverBtn.addEventListener('click', function(e) {
      e.preventDefault();
      recuperarBox.classList.add('fade-out');
      setTimeout(function() {
        recuperarBox.style.display = 'none';
        loginBox.style.display = 'flex';
        loginBox.classList.remove('fade-out');
        loginBox.classList.add('fade-in');
      }, 500);
    });
  }

  // Enlace para ir a Registro
  if (registroLink && loginBox && registroBox) {
    registroLink.addEventListener('click', function(e) {
      e.preventDefault();
      loginBox.classList.add('fade-out');
      setTimeout(function() {
        loginBox.style.display = 'none';
        registroBox.style.display = 'flex';
        registroBox.classList.add('fade-in');
      }, 500);
    });
  }

  // Botón para volver al Login desde Registro
  if (volverRegistroBtn && loginBox && registroBox) {
    volverRegistroBtn.addEventListener('click', function(e) {
      e.preventDefault();
      registroBox.classList.add('fade-out');
      setTimeout(function() {
        registroBox.style.display = 'none';
        loginBox.style.display = 'flex';
        loginBox.classList.remove('fade-out');
        loginBox.classList.add('fade-in');
      }, 500);
    });
  }

  // Limpiar clases de animación al terminar
  if (loginBox) {
    loginBox.addEventListener('animationend', function() {
      loginBox.classList.remove('fade-in');
    });
  }
  if (recuperarBox) {
    recuperarBox.addEventListener('animationend', function() {
      recuperarBox.classList.remove('fade-in');
    });
  }
  if (registroBox) {
    registroBox.addEventListener('animationend', function() {
      registroBox.classList.remove('fade-in');
    });
  }
});
