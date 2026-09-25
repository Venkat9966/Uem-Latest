const toast = document.querySelector('#toast');
const userName = document.querySelector('[data-role-name]');
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');

async function loadSession() {
  try {
    const response = await fetch('api/session.php', { credentials: 'same-origin' });
    const result = await response.json();

    if (!response.ok || !result.success || !result.user || result.user.role !== 'candidate') {
      window.location.href = 'index.html?login=required';
      return;
    }

    const currentUser = result.user;
    if (userName) {
      userName.textContent = currentUser.name ? currentUser.name.split(' ')[0] : 'Candidate';
    }

    if (accountButton) {
      accountButton.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'C';
    }
  } catch (error) {
    window.location.href = 'index.html?login=required';
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

loadSession();

document.querySelectorAll('[data-action="lesson"]').forEach((button) => {
  button.addEventListener('click', () => showToast('Lesson opened — your progress is saved.'));
});

document.getElementById('browse-button').addEventListener('click', () => {
  window.location.href = 'index.html#courses';
});

document.getElementById('account-button').addEventListener('click', () => showToast('Logged in as candidate.'));

logoutButton.addEventListener('click', async () => {
  await fetch('api/logout.php', { method: 'POST', credentials: 'same-origin' });
  window.location.href = 'index.html?login=required';
});
