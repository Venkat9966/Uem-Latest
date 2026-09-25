const form = document.querySelector('#set-password-form');

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

// Prepopulate email and token from URL parameters if available
const urlParams = new URLSearchParams(window.location.search);
const emailParam = urlParams.get('email');
const tokenParam = urlParams.get('token');

if (form && emailParam) {
  const emailInput = form.querySelector('[name="email"]');
  if (emailInput) emailInput.value = emailParam;
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const temporaryPassword = form.querySelector('[name="temporaryPassword"]').value.trim();
    const newPassword = form.querySelector('[name="newPassword"]').value.trim();

    if (!email || (!temporaryPassword && !tokenParam) || !newPassword) {
      showFormMessage('Please complete all fields.', true);
      return;
    }

    if (newPassword.length < 8) {
      showFormMessage('New password must be at least 8 characters long.', true);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }

    try {
      const response = await fetch('api/set-password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          temporaryPassword,
          newPassword,
          token: tokenParam || ''
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Password update failed.');
      }

      showFormMessage('Password updated successfully. Redirecting to login...', false);
      setTimeout(() => {
        window.location.href = 'index.html?login=required';
      }, 1500);
    } catch (error) {
      showFormMessage(error.message || 'Password update failed.', true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save password →';
      }
    }
  });
}

