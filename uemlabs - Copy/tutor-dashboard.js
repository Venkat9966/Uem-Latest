const toast = document.querySelector('#toast');
const userName = document.querySelector('[data-role-name]');
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');

async function loadSession() {
  try {
    const response = await fetch('api/session.php', { credentials: 'same-origin' });
    const result = await response.json();

    if (!response.ok || !result.success || !result.user || result.user.role !== 'tutor') {
      window.location.href = 'index.html?login=required';
      return;
    }

    const currentUser = result.user;
    if (userName) {
      userName.textContent = currentUser.name ? currentUser.name.split(' ')[0] : 'Tutor';
    }

    if (accountButton) {
      accountButton.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'T';
    }
  } catch (error) {
    window.location.href = 'index.html?login=required';
  }
}

// Fetch and render tutor uploads
async function loadUploads() {
  const container = document.getElementById('uploads-list');
  if (!container) return;
  container.innerHTML = '<em>Loading…</em>';
  try {
    const resp = await fetch('api/tutor-uploads-list.php', { credentials: 'same-origin' });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.message || 'Failed to load');
    if (!json.uploads || json.uploads.length === 0) {
      container.innerHTML = '<div>No uploads yet.</div>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'uploads-list';
    json.uploads.forEach((u) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${u.original_name}</strong> <small>${(u.mime || '')} · ${Math.round(u.size/1024)} KB</small> <a href="${u.stored_name? 'uploads/tutor/'+u.stored_name : '#'}" target="_blank">Open</a> <button data-id="${u.id}" class="delete-upload">Delete</button>`;
      list.appendChild(li);
    });
    container.innerHTML = '';
    container.appendChild(list);

    // attach delete handlers
    container.querySelectorAll('.delete-upload').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Delete this upload?')) return;
        try {
          const r = await fetch('api/tutor-upload-delete.php', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin', body: JSON.stringify({id}) });
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.message || 'Delete failed');
          loadUploads();
        } catch (err) {
          showToast('Delete failed: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<div>Error loading uploads.</div>';
  }
}

// Load uploads on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadUploads();
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

loadSession();

document.querySelectorAll('[data-action="lesson"]').forEach((button) => {
  button.addEventListener('click', () => showToast('Review queue updated.'));
});

document.getElementById('session-button').addEventListener('click', () => {
  showToast('New tutor session created.');
});

document.getElementById('account-button').addEventListener('click', () => showToast('Logged in as tutor.'));

logoutButton.addEventListener('click', async () => {
  await fetch('api/logout.php', { method: 'POST', credentials: 'same-origin' });
  window.location.href = 'index.html?login=required';
});

// Tutor upload form handler
const uploadForm = document.getElementById('tutor-upload-form');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('upload-button');
    const resultBox = document.getElementById('upload-result');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    const fd = new FormData(uploadForm);
    try {
      const resp = await fetch('api/tutor-upload.php', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.message || 'Upload failed');
      resultBox.textContent = 'Upload successful: ' + (json.file?.name || 'file');
    } catch (err) {
      resultBox.textContent = 'Error: ' + err.message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
      setTimeout(() => { if (resultBox) resultBox.textContent = ''; }, 4000);
    }
  });
}
