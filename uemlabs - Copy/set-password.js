const form = document.querySelector('#set-password-form');

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const temporaryPassword = form.querySelector('[name="temporaryPassword"]').value.trim();
    const newPassword = form.querySelector('[name="newPassword"]').value.trim();

    if (!email || !temporaryPassword || !newPassword) {
      alert('Please complete all fields.');
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
        body: JSON.stringify({ email, temporaryPassword, newPassword })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Password update failed.');
      }

      alert('Password updated successfully. Please log in with your new password.');
      window.location.href = 'index.html?login=required';
    } catch (error) {
      alert(error.message || 'Password update failed.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save password →';
      }
    }
  });
}
