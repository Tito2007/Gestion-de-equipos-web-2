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
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
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
    
    document.body.appendChild(notification);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
      closeNotification(notification);
    });
    
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

  var registroForm = document.querySelector('.registro-box');
  if (registroForm) {
    registroForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const nombre = document.getElementById('registro-nombre').value;
      const email = document.getElementById('registro-email').value;
      const password = document.getElementById('registro-password').value;
      const passwordConfirm = document.getElementById('registro-password-confirm').value;

      if (password !== passwordConfirm) {
        showNotification('Error', 'Las contraseñas no coinciden', 'error');
        return;
      }

      if (password.length < 6) {
        showNotification('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      try {
        const { data, error } = await supabaseClient.auth.signUp({
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
        
        registroForm.reset();
        
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

  var loginForm = document.querySelector('.login-box');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        showNotification('¡Bienvenido!', 'Has iniciado sesión correctamente', 'success');
        
        setTimeout(function() {
          window.location.href = 'inicio.html';
        }, 1500);
        
      } catch (error) {
        console.error('Error en login:', error);
        
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

  var recuperarForm = document.querySelector('.recuperar-box');
  if (recuperarForm) {
    recuperarForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('recuperar-email').value;

      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;

        showNotification('Correo enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña', 'success');
        
        recuperarForm.reset();
        
      } catch (error) {
        console.error('Error al recuperar contraseña:', error);
        showNotification('Error', error.message, 'error');
      }
    });
  }

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
