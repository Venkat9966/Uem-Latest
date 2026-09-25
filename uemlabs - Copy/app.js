const modal = document.querySelector('#modal');
const title = document.querySelector('#modal-title');
const copy = document.querySelector('#modal-copy');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const form = document.querySelector('#auth-form');

function redirectToRoleDashboard(role) {
  window.location.href = role === 'candidate' ? 'dashboard.html' : 'tutor-dashboard.html';
}

function setModalMode(mode) {
  if (!form) return;

  const nameField = form.querySelector('.name-field');
  const submitButton = form.querySelector('button[type="submit"]');
  const nameInput = form.querySelector('[name="name"]');
  const passwordField = form.querySelector('[name="password"]');
  const isLogin = mode === 'login';

  if (nameField) {
    nameField.style.display = isLogin ? 'none' : 'block';
  }

  if (nameInput) {
    nameInput.required = !isLogin;
  }

  if (passwordField) {
    passwordField.style.display = isLogin ? 'block' : 'none';
    passwordField.required = isLogin;
  }

  if (isLogin) {
    title.textContent = 'Welcome back';
    copy.textContent = 'Access your candidate or tutor dashboard securely.';
    if (submitButton) submitButton.textContent = 'Login →';
  } else {
    title.textContent = 'Create your free account';
    copy.textContent = 'We will send a temporary password to your email to start securely.';
    if (submitButton) submitButton.textContent = 'Send temporary password →';
  }
}

function openModal(type, course) {
  if (!modal || !form) return;

  const mode = type === 'login' ? 'login' : 'signup';
  // Record current modal mode on the form so the submit handler knows which flow to use
  form.dataset.mode = mode;
  // expose forgot-password action
  const forgotLink = form.querySelector('.forgot-link');
  if (forgotLink) forgotLink.style.display = mode === 'login' ? 'block' : 'none';
  // Clear any previous error message and reset transient fields
  const existingError = form.querySelector('.auth-error');
  if (existingError) existingError.remove();
  // Ensure password field is cleared when opening signup modal
  const pwd = form.querySelector('[name="password"]');
  if (pwd) pwd.value = '';

  setModalMode(mode);

  if (type === 'signup' && course) {
    title.textContent = `Start ${course}`;
    copy.textContent = `Create an account to begin ${course}.`;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  const focusTarget = mode === 'login' ? form.querySelector('[name="email"]') : form.querySelector('[name="name"]');
  if (focusTarget) focusTarget.focus();
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function showFormMessage(message, isError = true) {
  if (!form) return;

  let alertBox = form.querySelector('.auth-error');
  if (!alertBox) {
    alertBox = document.createElement('p');
    alertBox.className = 'auth-error';
    form.insertBefore(alertBox, form.querySelector('button[type="submit"]'));
  }

  alertBox.textContent = message;
  alertBox.style.color = isError ? '#bb2d29' : '#1e7a42';
  alertBox.style.margin = '0 0 12px';
  alertBox.style.fontWeight = '700';
}

if (form) {
  form.dataset.mode = 'login';
  setModalMode('login');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = form.querySelector('[name="name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const password = form.querySelector('[name="password"]').value.trim();
    const role = form.querySelector('[name="role"]').value;
    const isLogin = form.dataset.mode === 'login';

    if (!email || (!isLogin && !name) || (isLogin && !password)) {
      showFormMessage(isLogin ? 'Please add your email and password.' : 'Please complete your name and email.', true);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = isLogin ? 'Checking...' : 'Sending...';
    }

    try {
      const endpoint = isLogin ? 'api/login.php' : 'api/signup.php';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const rawText = await response.text();
      let result;

      try {
        result = rawText ? JSON.parse(rawText) : { success: false, message: 'Request failed.' };
      } catch (error) {
        result = {
          success: false,
          message: rawText || 'Server error. Check PHP setup or upload the backend files.'
        };
      }

      if (!response.ok || !result.success) {
        // In production, avoid exposing server debug strings to users
        const errMsg = result.message || 'Request failed.';
        throw new Error(errMsg);
      }

      if (isLogin) {
        if (result.must_reset_password) {
          showFormMessage('Temporary password accepted. Please set a new password.', false);
          setTimeout(() => {
            closeModal();
            window.location.href = 'set-password.html';
          }, 600);
          return;
        }

        showFormMessage('Login successful. Redirecting...', false);
        setTimeout(() => {
          closeModal();
          redirectToRoleDashboard(role);
        }, 500);
        return;
      }

      showFormMessage('A temporary password has been sent to your email. Please check your inbox.', false);
      form.dataset.mode = 'login';
      setModalMode('login');
      form.reset();
      setTimeout(() => closeModal(), 1800);
    } catch (error) {
      showFormMessage(error.message || 'Request failed. Please try again.', true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = form.dataset.mode === 'login' ? 'Login →' : 'Send temporary password →';
      }
    }
  });

  // forgot password flow
  const forgotLink = document.getElementById('forgot-password-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
      if (!email) {
        showFormMessage('Please enter your email to reset password.', true);
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
      }

      try {
        const resp = await fetch('api/forgot-password.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const json = await resp.json();
        if (!resp.ok || !json.success) throw new Error(json.message || 'Request failed');
        showFormMessage('If an account exists, a reset link has been sent.', false);
      } catch (err) {
        showFormMessage(err.message || 'Unable to send reset email.', true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = form.dataset.mode === 'login' ? 'Login →' : 'Send temporary password →';
        }
      }
    });
  }
}

if (menu && nav) {
  menu.addEventListener('click', () => nav.classList.toggle('open'));
}

const navLinks = document.querySelectorAll('.main-nav a');
navLinks.forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));

const actionButtons = document.querySelectorAll('[data-action]');
actionButtons.forEach((button) => button.addEventListener('click', () => openModal(button.dataset.action)));

const courseButtons = document.querySelectorAll('[data-course]');
courseButtons.forEach((button) => button.addEventListener('click', () => openModal('signup', button.dataset.course)));

if (modal) {
  const closeButton = document.querySelector('.modal-close');
  if (closeButton) closeButton.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('login') === 'required') {
  openModal('login');
}
