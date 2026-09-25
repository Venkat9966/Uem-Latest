const toast = document.querySelector('#toast');
const userName = document.querySelector('[data-role-name]');
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');

// Extract token from URL if provided during cross-tab/iframe redirection
try {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || urlParams.get('auth');
  if (tokenFromUrl) {
    sessionStorage.setItem('uem_auth_token', tokenFromUrl);
    localStorage.setItem('uem_auth_token', tokenFromUrl);
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
} catch (e) {}

function getAuthHeaders() {
  const token = sessionStorage.getItem('uem_auth_token') || localStorage.getItem('uem_auth_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }
  return headers;
}

async function loadSession() {
  // 1. Immediately hydrate with cached session to avoid UI flash or false logouts
  const cachedUserRaw = sessionStorage.getItem('uem_user') || localStorage.getItem('uem_user');
  let cachedUser = null;
  if (cachedUserRaw) {
    try { cachedUser = JSON.parse(cachedUserRaw); } catch (e) {}
  }

  if (cachedUser) {
    if (cachedUser.role === 'candidate') {
      window.location.href = 'dashboard.html';
      return;
    }
    if (userName) {
      userName.textContent = cachedUser.name ? cachedUser.name.split(' ')[0] : 'Tutor';
    }
    if (accountButton) {
      accountButton.textContent = cachedUser.name ? cachedUser.name.charAt(0).toUpperCase() : 'T';
    }
  }

  // 2. Verify with server (sending both cookie and bearer token)
  try {
    const response = await fetch('/api/session.php', {
      credentials: 'same-origin',
      headers: getAuthHeaders()
    });
    const rawText = await response.text();
    let result = null;
    try { result = rawText ? JSON.parse(rawText) : {}; } catch (_) {}

    if (response.ok && result && result.success && result.user) {
      const currentUser = result.user;
      if (currentUser.role === 'candidate') {
        window.location.href = 'dashboard.html';
        return;
      }

      sessionStorage.setItem('uem_user', JSON.stringify(currentUser));
      localStorage.setItem('uem_user', JSON.stringify(currentUser));

      if (userName) {
        userName.textContent = currentUser.name ? currentUser.name.split(' ')[0] : 'Tutor';
      }
      if (accountButton) {
        accountButton.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'T';
      }
      return;
    }

    // Server rejected and no cached user: redirect to login
    if (!cachedUser || cachedUser.role !== 'tutor') {
      sessionStorage.removeItem('uem_auth_token');
      sessionStorage.removeItem('uem_user');
      localStorage.removeItem('uem_auth_token');
      localStorage.removeItem('uem_user');
      window.location.href = 'index.html?login=required';
    }
  } catch (error) {
    // Network hiccup: keep cached user active if available
    if (!cachedUser || cachedUser.role !== 'tutor') {
      window.location.href = 'index.html?login=required';
    }
  }
}

// Course & Lesson Catalog
let COURSE_CATALOG = {
  'android-enterprise': {
    name: 'Android Enterprise Foundations',
    badgeClass: 'course-android',
    lessons: [
      { id: 'module-1', name: 'Module 1: Architecture & Device Enrollment' },
      { id: 'module-2', name: 'Module 2: Work Profile vs Fully Managed (COBO/COPE)' },
      { id: 'module-3', name: 'Module 3: Managed Google Play & App Distribution' },
      { id: 'module-4', name: 'Module 4: Zero-Touch Enrollment & OEMConfig' },
      { id: 'module-5', name: 'Module 5: Compliance Policies & Security Rules' },
      { id: 'module-6', name: 'Module 6: Troubleshooting & Diagnostic Logs' }
    ]
  },
  'workspace-one': {
    name: 'Workspace ONE Essentials',
    badgeClass: 'course-workspace',
    lessons: [
      { id: 'module-1', name: 'Module 1: Architecture & Console Setup' },
      { id: 'module-2', name: 'Module 2: Device Profiling & Smart Groups' },
      { id: 'module-3', name: 'Module 3: Enterprise App Catalog & Tunnel' },
      { id: 'module-4', name: 'Module 4: Access Integration & SSO' },
      { id: 'module-5', name: 'Module 5: Intelligence & Automated Remediation' },
      { id: 'module-6', name: 'Module 6: Windows & macOS Endpoint Management' }
    ]
  },
  'soti-mobicontrol': {
    name: 'SOTI MobiControl Mastery',
    badgeClass: 'course-soti',
    lessons: [
      { id: 'module-1', name: 'Module 1: Architecture, Deployment Servers & Agents' },
      { id: 'module-2', name: 'Module 2: Rule Configuration & Device Add Rules' },
      { id: 'module-3', name: 'Module 3: Package Studio & Scripting Engine' },
      { id: 'module-4', name: 'Module 4: Remote Control & Diagnostic Tools' },
      { id: 'module-5', name: 'Module 5: Lockdown / Kiosk Mode & Profiles' },
      { id: 'module-6', name: 'Module 6: Zebra StageNow Integration & OTA' }
    ]
  },
  'ivanti-neurons': {
    name: 'Ivanti Neurons for UEM',
    badgeClass: 'course-ivanti',
    lessons: [
      { id: 'module-1', name: 'Module 1: Neurons Discovery & Asset Inventory' },
      { id: 'module-2', name: 'Module 2: Automated Remediation Bots' },
      { id: 'module-3', name: 'Module 3: Patch Intelligence & Zero-Day Updates' },
      { id: 'module-4', name: 'Module 4: MobileIron Cloud / Core Migration' },
      { id: 'module-5', name: 'Module 5: Edge Intelligence & Machine Learning' }
    ]
  },
  'rugged-devices': {
    name: 'Rugged & Frontline Devices',
    badgeClass: 'course-rugged',
    lessons: [
      { id: 'module-1', name: 'Module 1: Zebra, Honeywell & Datalogic Hardware' },
      { id: 'module-2', name: 'Module 2: Barcode Scanning & DataWedge APIs' },
      { id: 'module-3', name: 'Module 3: StageNow XML & Barcode Deployment' },
      { id: 'module-4', name: 'Module 4: Shift-Worker Shared Device Check-In' },
      { id: 'module-5', name: 'Module 5: Battery Health & Fleet Lifecycle' }
    ]
  },
  'intune-essentials': {
    name: 'Intune & Endpoint Security',
    badgeClass: 'course-intune',
    lessons: [
      { id: 'module-1', name: 'Module 1: Endpoint Architecture & Cloud Enrollment' },
      { id: 'module-2', name: 'Module 2: Conditional Access & Compliance Policies' },
      { id: 'module-3', name: 'Module 3: Windows Autopilot & Hardware Hashes' },
      { id: 'module-4', name: 'Module 4: Microsoft Defender for Endpoint' },
      { id: 'module-5', name: 'Module 5: Attack Surface Reduction & LAPS' }
    ]
  }
};

// Preview Modal elements and controller
const previewModal = document.getElementById('preview-modal');
const previewModalTitle = document.getElementById('preview-modal-title');
const previewModalMeta = document.getElementById('preview-modal-meta');
const previewModalBody = document.getElementById('preview-modal-body');
const previewModalDownload = document.getElementById('preview-modal-download');
const previewModalClose = document.getElementById('preview-modal-close');

function closePreviewModal() {
  if (!previewModal) return;
  previewModal.classList.remove('open');
  previewModal.setAttribute('aria-hidden', 'true');
  if (previewModalBody) {
    previewModalBody.innerHTML = '';
  }
}

if (previewModalClose) {
  previewModalClose.addEventListener('click', closePreviewModal);
}
if (previewModal) {
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreviewModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && previewModal && previewModal.classList.contains('open')) {
    closePreviewModal();
  }
});

function openDocumentPreview({ url, name, mime, size, course_name = '', lesson_name = '', isLocalBlob = false }) {
  if (!previewModal || !previewModalBody) return;

  const isPdf = (mime === 'application/pdf') || (name && name.toLowerCase().endsWith('.pdf'));
  const isImage = (mime && mime.startsWith('image/')) || (name && /\.(png|jpe?g|gif|webp|svg)$/i.test(name));
  const isJson = (mime === 'application/json') || (name && name.toLowerCase().endsWith('.json'));

  previewModalTitle.textContent = name || 'Document Preview';
  const sizeText = size ? ` · ${Math.round(size / 1024)} KB` : '';
  const typeText = isPdf ? 'PDF Document' : isImage ? 'Image File' : isJson ? 'JSON File' : (mime || 'Document');
  const destinationText = (course_name || lesson_name) ? ` · 📍 ${course_name || ''} → ${lesson_name || ''}` : '';
  
  previewModalMeta.textContent = `${typeText}${sizeText}${destinationText}`;

  if (previewModalDownload) {
    previewModalDownload.href = url;
    previewModalDownload.setAttribute('download', name || 'document');
    previewModalDownload.style.display = 'inline-flex';
  }

  previewModalBody.innerHTML = '';

  if (isPdf) {
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-modal-iframe';
    iframe.src = `${url}#toolbar=1&view=FitH`;
    iframe.title = name || 'PDF Preview';
    previewModalBody.appendChild(iframe);
  } else if (isImage) {
    const imgWrap = document.createElement('div');
    imgWrap.style.display = 'grid';
    imgWrap.style.placeItems = 'center';
    imgWrap.style.height = '100%';
    imgWrap.style.padding = '20px';
    imgWrap.style.overflow = 'auto';

    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 6px 20px #0000001f';
    imgWrap.appendChild(img);
    previewModalBody.appendChild(imgWrap);
  } else if (isJson) {
    const pre = document.createElement('pre');
    pre.className = 'preview-modal-text';
    pre.textContent = 'Loading JSON contents...';
    previewModalBody.appendChild(pre);

    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        try {
          pre.textContent = JSON.stringify(JSON.parse(t), null, 2);
        } catch (_) {
          pre.textContent = t;
        }
      })
      .catch((err) => {
        pre.textContent = 'Unable to display JSON content: ' + err.message;
      });
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'preview-fallback';
    fallback.innerHTML = `
      <div class="preview-fallback-icon">📄</div>
      <h4>Preview Not Directly Embedded</h4>
      <p>This file format (${mime || 'document'}) can be viewed or downloaded in a new tab.</p>
      <a href="${url}" target="_blank" class="button button-accent">Open File Directly ↗</a>
    `;
    previewModalBody.appendChild(fallback);
  }

  previewModal.classList.add('open');
  previewModal.setAttribute('aria-hidden', 'false');
}

// Stores all cached uploads for instant in-browser filtering
let cachedUploads = [];

function getCourseBadgeClass(courseId) {
  return COURSE_CATALOG[courseId]?.badgeClass || 'course-android';
}

function renderUploadsList(uploads) {
  const container = document.getElementById('uploads-list');
  if (!container) return;

  if (!uploads || uploads.length === 0) {
    container.innerHTML = `
      <div style="padding:28px 16px;text-align:center;color:#6b7d72;background:#f9faf7;border:1px dashed #cbd8c9;border-radius:10px;">
        <span style="font-size:24px;display:block;margin-bottom:6px;">📂</span>
        <strong>No documents uploaded for this filter.</strong>
        <p style="margin:4px 0 0;font-size:12px;">Select a course above and upload training guides, assessments, or manuals.</p>
      </div>
    `;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'uploads-list';

  uploads.forEach((u) => {
    const fileUrl = u.stored_name ? `uploads/tutor/${u.stored_name}` : '#';
    const courseId = u.course_id || 'android-enterprise';
    const courseName = u.course_name || COURSE_CATALOG[courseId]?.name || 'Android Enterprise Foundations';
    const lessonName = u.lesson_name || 'Module 1: Foundations';
    const badgeClass = getCourseBadgeClass(courseId);

    const li = document.createElement('li');
    li.className = 'upload-item-card';
    li.innerHTML = `
      <div class="upload-item-info">
        <div class="upload-item-badges">
          <span class="badge-course ${badgeClass}">🎯 ${courseName}</span>
          <span class="badge-lesson">📖 ${lessonName}</span>
        </div>
        <strong class="upload-item-filename">${u.original_name}</strong>
        <small class="upload-item-meta">${(u.mime || '')} · ${Math.round((u.size || 0)/1024)} KB · Uploaded: ${new Date(u.created_at || Date.now()).toLocaleDateString()}</small>
      </div>
      <div class="uploads-list-actions">
        <button type="button" class="preview-btn" 
          data-url="${fileUrl}" 
          data-name="${encodeURIComponent(u.original_name)}" 
          data-mime="${u.mime || 'application/pdf'}" 
          data-size="${u.size || 0}"
          data-course="${encodeURIComponent(courseName)}"
          data-lesson="${encodeURIComponent(lessonName)}">
          <span>👁 Preview</span>
        </button>
        <a href="${fileUrl}" target="_blank" rel="noopener" class="button button-outline" style="padding:6px 12px;font-size:12px;text-decoration:none;border-radius:6px">Open ↗</a>
        <button data-id="${u.id}" class="delete-upload">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });

  container.innerHTML = '';
  container.appendChild(list);

  // attach preview handlers
  container.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openDocumentPreview({
        url: btn.dataset.url,
        name: decodeURIComponent(btn.dataset.name),
        mime: btn.dataset.mime,
        size: Number(btn.dataset.size),
        course_name: decodeURIComponent(btn.dataset.course || ''),
        lesson_name: decodeURIComponent(btn.dataset.lesson || '')
      });
    });
  });

  // attach delete handlers
  container.querySelectorAll('.delete-upload').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('Are you sure you want to delete this upload?')) return;
      try {
        const r = await fetch('/api/tutor-upload-delete.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          credentials: 'same-origin',
          body: JSON.stringify({ id })
        });
        const raw = await r.text();
        let j = null;
        try { j = JSON.parse(raw); } catch (_) {}
        if (!r.ok || !j || !j.success) throw new Error(j?.message || `Delete failed (HTTP ${r.status})`);
        showToast('File deleted successfully.');
        loadUploads();
      } catch (err) {
        showToast('Delete failed: ' + err.message);
      }
    });
  });
}

// Fetch and render tutor uploads
async function loadUploads() {
  const container = document.getElementById('uploads-list');
  if (!container) return;
  container.innerHTML = '<em>Loading uploads…</em>';
  try {
    const resp = await fetch('/api/tutor-uploads-list.php', {
      credentials: 'same-origin',
      headers: getAuthHeaders()
    });
    const raw = await resp.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch (_) {
      throw new Error(`Server returned HTTP ${resp.status}`);
    }

    if (!resp.ok || !json.success) throw new Error(json.message || 'Failed to load uploads');

    cachedUploads = json.uploads || [];

    // Filter according to currently selected course filter
    const filterSelect = document.getElementById('filter-course-select');
    const selectedFilter = filterSelect ? filterSelect.value : 'all';

    applyUploadsFilter(selectedFilter);
  } catch (err) {
    container.innerHTML = `<div style="color:#c53030">Error loading uploads: ${err.message}</div>`;
  }
}

function applyUploadsFilter(courseId) {
  if (!courseId || courseId === 'all') {
    renderUploadsList(cachedUploads);
  } else {
    const filtered = cachedUploads.filter((u) => u.course_id === courseId);
    renderUploadsList(filtered);
  }
}

// Filter dropdown event listener
const filterCourseSelect = document.getElementById('filter-course-select');
if (filterCourseSelect) {
  filterCourseSelect.addEventListener('change', () => {
    applyUploadsFilter(filterCourseSelect.value);
  });
}

// Load catalog and uploads on page ready
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCourseCatalog();
  loadUploads();
  renderCurriculumStudio();
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
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
  try {
    await fetch('api/logout.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getAuthHeaders()
    });
  } catch (e) {}
  sessionStorage.removeItem('uem_auth_token');
  sessionStorage.removeItem('uem_user');
  localStorage.removeItem('uem_auth_token');
  localStorage.removeItem('uem_user');
  window.location.href = 'index.html?loggedout=1';
});

// Tutor upload form & dynamic course/lesson controller
const uploadForm = document.getElementById('tutor-upload-form');
const courseSelect = document.getElementById('upload-course');
const lessonSelect = document.getElementById('upload-lesson');
const courseNameHidden = document.getElementById('upload-course-name');
const lessonNameHidden = document.getElementById('upload-lesson-name');
const targetBadgePath = document.getElementById('target-badge-path');
const uploadDestinationTag = document.getElementById('upload-destination-tag');
const prePreviewBox = document.getElementById('file-pre-preview');
const fileInput = document.getElementById('tutor-file-input');

function updateTargetDestinationBanner() {
  const selectedCourseId = courseSelect ? courseSelect.value : 'android-enterprise';
  const courseData = COURSE_CATALOG[selectedCourseId] || COURSE_CATALOG['android-enterprise'];
  const courseName = courseData.name;

  let lessonName = 'Module 1';
  if (lessonSelect && lessonSelect.selectedOptions && lessonSelect.selectedOptions[0]) {
    lessonName = lessonSelect.selectedOptions[0].textContent;
  }

  if (courseNameHidden) courseNameHidden.value = courseName;
  if (lessonNameHidden) lessonNameHidden.value = lessonName;

  if (targetBadgePath) {
    targetBadgePath.textContent = `${courseName} → ${lessonName}`;
  }

  if (uploadDestinationTag) {
    uploadDestinationTag.textContent = `Target: ${courseName} · ${lessonName.split(':')[0]}`;
  }
}

function populateLessonsForCourse(courseId) {
  if (!lessonSelect) return;
  const courseData = COURSE_CATALOG[courseId] || COURSE_CATALOG['android-enterprise'];

  lessonSelect.innerHTML = '';
  courseData.lessons.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    lessonSelect.appendChild(opt);
  });

  updateTargetDestinationBanner();
}

if (courseSelect) {
  courseSelect.addEventListener('change', () => {
    populateLessonsForCourse(courseSelect.value);
  });
  // Initial populate
  populateLessonsForCourse(courseSelect.value);
}

if (lessonSelect) {
  lessonSelect.addEventListener('change', () => {
    updateTargetDestinationBanner();
  });
}

// Pre-upload preview handling
let activePrePreviewUrl = null;

if (fileInput && prePreviewBox) {
  fileInput.addEventListener('change', () => {
    if (activePrePreviewUrl) {
      URL.revokeObjectURL(activePrePreviewUrl);
      activePrePreviewUrl = null;
    }

    if (!fileInput.files || fileInput.files.length === 0) {
      prePreviewBox.style.display = 'none';
      prePreviewBox.innerHTML = '';
      return;
    }

    const file = fileInput.files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

    const selectedCourseId = courseSelect ? courseSelect.value : 'android-enterprise';
    const courseName = COURSE_CATALOG[selectedCourseId]?.name || 'Android Enterprise Foundations';
    const lessonName = lessonSelect?.selectedOptions[0]?.textContent || 'Module 1';

    activePrePreviewUrl = URL.createObjectURL(file);

    prePreviewBox.style.display = 'block';
    prePreviewBox.innerHTML = `
      <div class="file-pre-preview-header">
        <div>
          <strong>📄 ${file.name}</strong>
          <span style="display:block;font-size:11px;color:#3b4943;margin-top:2px;">
            Target: <b>${courseName}</b> → <i>${lessonName}</i>
          </span>
        </div>
        <button type="button" class="button button-outline" id="pre-preview-expand-btn" style="padding:4px 10px;font-size:11px">
          Expand Modal ↗
        </button>
      </div>
      <div id="file-pre-preview-render"></div>
    `;

    const renderTarget = document.getElementById('file-pre-preview-render');
    if (isPdf) {
      const iframe = document.createElement('iframe');
      iframe.className = 'file-pre-preview-frame';
      iframe.src = `${activePrePreviewUrl}#toolbar=0&navpanes=0`;
      renderTarget.appendChild(iframe);
    } else if (isImage) {
      const img = document.createElement('img');
      img.src = activePrePreviewUrl;
      img.style.maxHeight = '200px';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '6px';
      img.style.display = 'block';
      img.style.margin = 'auto';
      renderTarget.appendChild(img);
    } else if (isJson) {
      const pre = document.createElement('pre');
      pre.style.maxHeight = '180px';
      pre.style.overflow = 'auto';
      pre.style.background = '#f1f4ed';
      pre.style.padding = '10px';
      pre.style.borderRadius = '6px';
      pre.style.fontSize = '12px';
      pre.textContent = 'Reading JSON...';
      renderTarget.appendChild(pre);

      file.text().then((txt) => {
        try {
          pre.textContent = JSON.stringify(JSON.parse(txt), null, 2);
        } catch (_) {
          pre.textContent = txt;
        }
      });
    } else {
      renderTarget.innerHTML = `<small style="color:#718178">File ready for upload. (${file.type || 'binary document'})</small>`;
    }

    const expandBtn = document.getElementById('pre-preview-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        openDocumentPreview({
          url: activePrePreviewUrl,
          name: file.name,
          mime: file.type,
          size: file.size,
          course_name: courseName,
          lesson_name: lessonName,
          isLocalBlob: true
        });
      });
    }
  });
}

if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('upload-button');
    const resultBox = document.getElementById('upload-result');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      if (resultBox) {
        resultBox.style.color = '#c53030';
        resultBox.textContent = 'Please select a file to upload first.';
        setTimeout(() => { if (resultBox) resultBox.textContent = ''; }, 3500);
      }
      return;
    }

    const file = fileInput.files[0];
    const selectedCourseId = courseSelect ? courseSelect.value : 'android-enterprise';
    const courseName = COURSE_CATALOG[selectedCourseId]?.name || 'Android Enterprise Foundations';
    const lessonId = lessonSelect ? lessonSelect.value : 'module-1';
    const lessonName = lessonSelect?.selectedOptions[0]?.textContent || 'Module 1: Foundations';

    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
    if (resultBox) {
      resultBox.style.color = '#4a5568';
      resultBox.textContent = `Uploading "${file.name}" to ${courseName} (${lessonName})...`;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('course_id', selectedCourseId);
    fd.append('course_name', courseName);
    fd.append('lesson_id', lessonId);
    fd.append('lesson_name', lessonName);

    try {
      const resp = await fetch('/api/tutor-upload.php', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: getAuthHeaders()
      });

      const rawText = await resp.text();
      let json = null;
      try {
        json = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        console.warn('Non-JSON response received from upload endpoint:', rawText);
        if (resp.status === 413) {
          throw new Error('The selected file is too large (maximum allowed size is 50MB).');
        } else if (resp.status === 403 || resp.status === 401) {
          throw new Error('Your session has expired or requires tutor privileges. Please re-login.');
        } else if (resp.status === 404) {
          throw new Error('Upload endpoint was not reachable. Please reload the page.');
        } else {
          throw new Error(`Upload failed (Server returned HTTP ${resp.status}).`);
        }
      }

      if (!resp.ok || !json || !json.success) {
        throw new Error(json?.message || `Upload failed with status code ${resp.status}`);
      }
      
      if (resultBox) {
        resultBox.style.color = '#1e7a42';
        resultBox.innerHTML = `
          <strong>✓ Upload Successful!</strong><br>
          File: <code>${json.file?.name || file.name}</code><br>
          Target: <b>${courseName}</b> → <i>${lessonName}</i>
        `;
      }
      showToast(`✓ Uploaded "${file.name}" to ${courseName}!`);
      
      // Reset file input while keeping selected course and lesson
      fileInput.value = '';
      if (prePreviewBox) {
        prePreviewBox.style.display = 'none';
        prePreviewBox.innerHTML = '';
      }
      if (activePrePreviewUrl) {
        URL.revokeObjectURL(activePrePreviewUrl);
        activePrePreviewUrl = null;
      }

      // Refresh the uploads list immediately so the tutor sees the new file with its badges
      loadUploads();
    } catch (err) {
      if (resultBox) {
        resultBox.style.color = '#c53030';
        resultBox.textContent = 'Error: ' + err.message;
      }
      showToast('Upload error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Upload to Lesson</span> <span>↑</span>'; }
      setTimeout(() => { if (resultBox && resultBox.style.color !== '#c53030') resultBox.textContent = ''; }, 7000);
    }
  });
}

// ========================================================
// TUTOR CURRICULUM & LESSON MANAGEMENT STUDIO CONTROLLER
// ========================================================

const curriculumCourseSelect = document.getElementById('curriculum-course-select');
const tutorLessonsGrid = document.getElementById('tutor-lessons-grid');

const modalEditLesson = document.getElementById('modal-edit-lesson');
const modalAddQuestion = document.getElementById('modal-add-question');
const modalAddLesson = document.getElementById('modal-add-lesson');

// Fetch live course catalog from server
async function fetchCourseCatalog() {
  try {
    const res = await fetch('/api/courses-catalog.php');
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (res.ok && data && data.success && data.catalog) {
      COURSE_CATALOG = data.catalog;
      if (courseSelect) {
        populateLessonsForCourse(courseSelect.value);
      }
    }
  } catch (err) {
    console.warn('Failed to load live courses catalog:', err);
  }
}

function renderLessonCard(lesson, idx, trackCourseId) {
  const quizList = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  const questionsCount = quizList.length;

  // Count tutor uploads attached to this lesson
  const lessonUploads = (cachedUploads || []).filter((u) => {
    if (u.course_id && u.course_id === trackCourseId) {
      if (u.lesson_id && u.lesson_id === lesson.id) return true;
      if (u.lesson_name && u.lesson_name.toLowerCase().includes(`module ${idx + 1}`)) return true;
    }
    return false;
  });
  const materialsCount = lessonUploads.length;

  const card = document.createElement('div');
  card.className = 'tutor-lesson-card';
  card.id = `tutor-card-${lesson.id}`;

  const details = lesson.details || {};
  const topics = details.topics || [];
  const labGuide = details.lab_guide || [];

  card.innerHTML = `
    <div class="tutor-lesson-main">
      <div class="tutor-lesson-badges">
        <span class="tutor-badge-id">MODULE ${idx + 1}</span>
        <span class="tutor-badge-duration">⏱️ ${lesson.duration || '45 mins'}</span>
        <span class="tutor-badge-questions">🎯 ${questionsCount} Quiz Question${questionsCount === 1 ? '' : 's'}</span>
        <span class="tutor-badge-questions" style="background:#eaf4e6;color:#244415;">📁 ${materialsCount} Uploaded File${materialsCount === 1 ? '' : 's'}</span>
      </div>
      <h3 class="tutor-lesson-title">${lesson.name}</h3>
      <p class="tutor-lesson-summary">${lesson.summary || 'Enterprise endpoint management lesson module.'}</p>
    </div>

    <div class="tutor-lesson-actions">
      <button type="button" class="btn-tutor-action btn-accent-tutor" data-action="edit-lesson" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}">
        <span>✏️ Edit Lesson</span>
      </button>
      <button type="button" class="btn-tutor-action" data-action="add-question" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}">
        <span>🎯 + Add Question</span>
      </button>
      <button type="button" class="btn-tutor-action" data-action="add-material" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}">
        <span>📁 + Add Extra Material</span>
      </button>
      <button type="button" class="btn-tutor-action" data-action="toggle-details" data-target="details-${lesson.id}">
        <span>👁 View Details & Quiz <span class="caret-indicator">▾</span></span>
      </button>
    </div>

    <!-- Expandable details & quiz drawer -->
    <div class="tutor-lesson-expanded-drawer" id="details-${lesson.id}" style="display:none;width:100%;margin-top:14px;padding-top:14px;border-top:1px dashed #d5e2cf;">
      <div style="background:#f4f9f0;border:1px solid #d5e6cf;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:13px;line-height:1.55;color:#253c1d;">
        <strong style="display:block;margin-bottom:4px;color:#183612;">Architectural Concept & In-Depth Overview:</strong>
        ${details.overview || lesson.summary || 'Standard enterprise curriculum guide.'}
      </div>

      ${topics.length > 0 ? `
        <div style="margin-bottom:12px;">
          <strong style="font-size:11px;text-transform:uppercase;color:#475a4d;letter-spacing:0.5px;">Core Topics:</strong>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
            ${topics.map((t) => `<span style="background:#fff;border:1px solid #c9d8c3;padding:2px 8px;border-radius:4px;font-size:11px;color:#27431e;font-weight:600;">✓ ${t}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${labGuide.length > 0 ? `
        <div style="margin-bottom:12px;">
          <strong style="font-size:11px;text-transform:uppercase;color:#475a4d;letter-spacing:0.5px;">Step-by-Step Production Lab Instructions:</strong>
          <ol style="margin:4px 0 0;padding-left:20px;font-size:12px;color:#2a3e32;line-height:1.5;">
            ${labGuide.map((step) => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      ` : ''}

      ${details.commands_configs ? `
        <div style="margin-bottom:12px;">
          <strong style="font-size:11px;text-transform:uppercase;color:#475a4d;letter-spacing:0.5px;">Production Configurations, ADB Commands & Schemas:</strong>
          <pre style="background:#131d18;color:#a8ef60;padding:10px 12px;border-radius:6px;font-size:11px;margin:4px 0 0;overflow-x:auto;">${details.commands_configs}</pre>
        </div>
      ` : ''}

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2ebd9;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <strong style="font-size:13px;color:#14231f;">🎯 Quiz Questions for Candidates (${quizList.length}):</strong>
          <button type="button" class="btn-tutor-action" data-action="add-question" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}" style="padding:3px 10px;font-size:11px;font-weight:700;">
            + Add Question
          </button>
        </div>

        ${quizList.length === 0 ? `
          <div style="font-size:12px;color:#75897c;font-style:italic;padding:8px 0;">No questions created for this lesson yet. Click "+ Add Question" to build one!</div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${quizList.map((q, qIdx) => `
              <div style="background:#fff;border:1px solid #d9e6d4;border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                  <div style="font-size:13px;font-weight:700;color:#14231f;">
                    Q${qIdx + 1}: ${q.question}
                  </div>
                  <button type="button" class="btn-delete-question" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}" data-qid="${q.id}" style="background:none;border:none;color:#c53030;font-size:11px;cursor:pointer;font-weight:700;padding:2px 4px;" title="Delete this question">
                    🗑 Delete
                  </button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
                  ${q.options.map((opt, oIdx) => `
                    <span style="padding:4px 8px;border-radius:4px;background:${oIdx === q.answer ? '#e5f6d7' : '#f9fbf8'};color:${oIdx === q.answer ? '#1b4a11' : '#495a50'};border:1px solid ${oIdx === q.answer ? '#a0dc82' : '#e4ece0'};font-weight:${oIdx === q.answer ? '700' : '400'};">
                      ${oIdx === q.answer ? '✓ ' : ''}${opt}
                    </span>
                  `).join('')}
                </div>
                ${q.explanation ? `
                  <div style="font-size:11px;color:#556d5e;margin-top:2px;font-style:italic;">
                    💡 Rationale: ${q.explanation}
                  </div>
                ` : ''}

                <!-- Inline "+ Add Question" directly after each question -->
                <div class="tutor-add-q-after-row">
                  <button type="button" class="btn-add-q-after" data-action="add-question" data-course-id="${trackCourseId}" data-lesson-id="${lesson.id}" title="Add Question After Q${qIdx + 1}">
                    <span class="add-plus-symbol">+</span>
                    <span>Add Question After Q${qIdx + 1}</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  return card;
}

function renderCurriculumStudio() {
  if (!tutorLessonsGrid) return;
  const courseId = curriculumCourseSelect ? curriculumCourseSelect.value : 'android-enterprise';

  // Sync active track filter button
  const tutorTrackBtns = document.querySelectorAll('.course-filter-btn[data-tutor-track]');
  tutorTrackBtns.forEach((b) => {
    if (b.dataset.tutorTrack === courseId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  tutorLessonsGrid.innerHTML = '';

  // Case 1: "All Tracks" Overview
  if (courseId === 'all') {
    const trackKeys = Object.keys(COURSE_CATALOG);
    if (trackKeys.length === 0) {
      tutorLessonsGrid.innerHTML = `
        <div style="padding:28px;text-align:center;color:#6b7d72;background:#fff;border-radius:10px;border:1px dashed #ccd8c9;">
          No courses loaded in catalog.
        </div>
      `;
      return;
    }

    trackKeys.forEach((tKey) => {
      const trackCourse = COURSE_CATALOG[tKey];
      const sectionWrap = document.createElement('div');
      sectionWrap.style.marginBottom = '32px';

      const trackHeader = document.createElement('div');
      trackHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#f4f7f2;border:1px solid #dbe6d7;border-radius:10px;padding:12px 18px;margin-bottom:14px;flex-wrap:wrap;gap:8px;';
      trackHeader.innerHTML = `
        <div>
          <span style="font-size:11px;font-weight:800;color:#274d15;background:#e5f3d4;padding:2px 8px;border-radius:4px;text-transform:uppercase;">${trackCourse.badgeClass || 'Track'}</span>
          <h3 style="margin:4px 0 0;font:700 17px 'Space Grotesk', sans-serif;color:#14231f;">${trackCourse.name}</h3>
        </div>
        <button type="button" class="btn-tutor-action btn-accent-tutor" data-action="add-track-module" data-track-id="${tKey}" style="font-weight:700;">
          <span>+ Add Module to Track</span>
        </button>
      `;
      sectionWrap.appendChild(trackHeader);

      if (Array.isArray(trackCourse.lessons)) {
        trackCourse.lessons.forEach((lesson, idx) => {
          const card = renderLessonCard(lesson, idx, tKey);
          sectionWrap.appendChild(card);

          // Add inline "+ Add Module / Lesson" row after EACH module
          const addAfterRow = document.createElement('div');
          addAfterRow.className = 'tutor-add-after-row';
          addAfterRow.innerHTML = `
            <button type="button" class="btn-tutor-add-after" data-action="add-after-lesson" data-course-id="${tKey}" data-after-id="${lesson.id}" title="Add Supplemental Module after Module ${idx + 1}">
              <span class="add-plus-symbol" aria-hidden="true">+</span>
              <span>Add Module After Module ${idx + 1}</span>
            </button>
          `;
          sectionWrap.appendChild(addAfterRow);
        });
      }

      tutorLessonsGrid.appendChild(sectionWrap);
    });

    attachCurriculumStudioListeners();
    return;
  }

  // Case 2: Specific Single Course Track
  const course = COURSE_CATALOG[courseId] || COURSE_CATALOG['android-enterprise'];

  if (!course || !Array.isArray(course.lessons) || course.lessons.length === 0) {
    tutorLessonsGrid.innerHTML = `
      <div style="padding:28px;text-align:center;color:#6b7d72;background:#fff;border-radius:10px;border:1px dashed #ccd8c9;">
        No lessons found for this course track. Click <b>"+ Add New Module"</b> above to create the first lesson.
      </div>
    `;
    return;
  }

  course.lessons.forEach((lesson, idx) => {
    const card = renderLessonCard(lesson, idx, courseId);
    tutorLessonsGrid.appendChild(card);

    // Provide an inline "+ Add Module / Lesson" row after EACH module
    const addAfterRow = document.createElement('div');
    addAfterRow.className = 'tutor-add-after-row';
    addAfterRow.innerHTML = `
      <button type="button" class="btn-tutor-add-after" data-action="add-after-lesson" data-course-id="${courseId}" data-after-id="${lesson.id}" title="Add Supplemental Module after Module ${idx + 1}">
        <span class="add-plus-symbol" aria-hidden="true">+</span>
        <span>Add Module After Module ${idx + 1}</span>
      </button>
    `;
    tutorLessonsGrid.appendChild(addAfterRow);
  });

  attachCurriculumStudioListeners();
}

function attachCurriculumStudioListeners() {
  if (!tutorLessonsGrid) return;

  // Toggle details & quiz drawer
  tutorLessonsGrid.querySelectorAll('[data-action="toggle-details"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const drawer = document.getElementById(targetId);
      if (!drawer) return;
      const isOpen = drawer.style.display !== 'none';
      drawer.style.display = isOpen ? 'none' : 'block';
      const caret = btn.querySelector('.caret-indicator');
      if (caret) caret.textContent = isOpen ? '▾' : '▴';
    });
  });

  // Edit Lesson
  tutorLessonsGrid.querySelectorAll('[data-action="edit-lesson"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openEditLessonModal(btn.dataset.courseId, btn.dataset.lessonId);
    });
  });

  // Add Question
  tutorLessonsGrid.querySelectorAll('[data-action="add-question"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAddQuestionModal(btn.dataset.courseId, btn.dataset.lessonId);
    });
  });

  // Add Extra Material / upload
  tutorLessonsGrid.querySelectorAll('[data-action="add-material"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusUploadForLesson(btn.dataset.courseId, btn.dataset.lessonId);
    });
  });

  // Inline "+ Add Module" row between / after lessons
  tutorLessonsGrid.querySelectorAll('[data-action="add-after-lesson"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAddLessonModal(btn.dataset.courseId, btn.dataset.afterId);
    });
  });

  // Track header "+ Add Module to Track"
  tutorLessonsGrid.querySelectorAll('[data-action="add-track-module"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAddLessonModal(btn.dataset.trackId);
    });
  });

  // Delete Question
  tutorLessonsGrid.querySelectorAll('.btn-delete-question').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this quiz question?')) return;
      await deleteQuizQuestion(btn.dataset.courseId, btn.dataset.lessonId, btn.dataset.qid);
    });
  });
}

function openEditLessonModal(courseId, lessonId) {
  const course = COURSE_CATALOG[courseId];
  if (!course) return;
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;

  document.getElementById('edit-course-id').value = courseId;
  document.getElementById('edit-lesson-id').value = lesson.id;
  document.getElementById('edit-lesson-name').value = lesson.name;
  document.getElementById('edit-lesson-duration').value = lesson.duration || '45 mins';
  document.getElementById('edit-lesson-summary').value = lesson.summary || '';

  const details = lesson.details || {};
  document.getElementById('edit-lesson-overview').value = details.overview || '';
  document.getElementById('edit-lesson-topics').value = (details.topics || []).join('\n');
  document.getElementById('edit-lesson-lab-steps').value = (details.lab_guide || []).join('\n');
  document.getElementById('edit-lesson-configs').value = details.commands_configs || '';
  document.getElementById('edit-lesson-takeaways').value = (details.key_takeaways || []).join('\n');

  document.getElementById('edit-modal-heading').textContent = `✏️ Edit: ${lesson.name}`;

  if (modalEditLesson) {
    modalEditLesson.style.display = 'grid';
    modalEditLesson.setAttribute('aria-hidden', 'false');
  }
}

function closeEditLessonModal() {
  if (modalEditLesson) {
    modalEditLesson.style.display = 'none';
    modalEditLesson.setAttribute('aria-hidden', 'true');
  }
}

function openAddQuestionModal(courseId, lessonId) {
  const course = COURSE_CATALOG[courseId];
  if (!course) return;
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;

  const form = document.getElementById('form-add-question');
  if (form) form.reset();

  document.getElementById('question-course-id').value = courseId;
  document.getElementById('question-lesson-id').value = lesson.id;
  document.getElementById('question-modal-subheading').textContent = `Target: ${course.name} → ${lesson.name}`;

  if (modalAddQuestion) {
    modalAddQuestion.style.display = 'grid';
    modalAddQuestion.setAttribute('aria-hidden', 'false');
  }
}

function closeAddQuestionModal() {
  if (modalAddQuestion) {
    modalAddQuestion.style.display = 'none';
    modalAddQuestion.setAttribute('aria-hidden', 'true');
  }
}

function openAddLessonModal(targetCourseId, afterLessonId) {
  let courseId = targetCourseId || (curriculumCourseSelect ? curriculumCourseSelect.value : 'android-enterprise');
  if (!courseId || courseId === 'all') courseId = 'android-enterprise';
  const course = COURSE_CATALOG[courseId] || COURSE_CATALOG['android-enterprise'];

  const form = document.getElementById('form-add-lesson');
  if (form) form.reset();

  document.getElementById('new-lesson-course-id').value = courseId;
  const afterInfo = afterLessonId ? ` (Append after ${afterLessonId})` : '';
  const labelEl = document.getElementById('new-lesson-target-course');
  if (labelEl) {
    labelEl.textContent = `Target Track: ${course.name}${afterInfo}`;
  }

  if (modalAddLesson) {
    modalAddLesson.style.display = 'grid';
    modalAddLesson.setAttribute('aria-hidden', 'false');
  }
}

function closeAddLessonModal() {
  if (modalAddLesson) {
    modalAddLesson.style.display = 'none';
    modalAddLesson.setAttribute('aria-hidden', 'true');
  }
}

function focusUploadForLesson(courseId, lessonId) {
  if (courseSelect) {
    courseSelect.value = courseId;
    populateLessonsForCourse(courseId);
  }
  if (lessonSelect) {
    lessonSelect.value = lessonId;
    updateTargetDestinationBanner();
  }

  const uploadPanel = document.querySelector('.upload-panel');
  if (uploadPanel) {
    uploadPanel.scrollIntoView({ behavior: 'smooth' });
    uploadPanel.style.outline = '3px solid #739618';
    uploadPanel.style.boxShadow = '0 0 20px rgba(115, 150, 24, 0.4)';
    setTimeout(() => {
      uploadPanel.style.outline = '';
      uploadPanel.style.boxShadow = '';
    }, 2400);
  }

  if (fileInput) {
    fileInput.focus();
  }

  const courseName = COURSE_CATALOG[courseId]?.name || 'Course';
  const lessonObj = COURSE_CATALOG[courseId]?.lessons?.find((l) => l.id === lessonId);
  showToast(`📁 Target set: ${courseName} → ${lessonObj?.name || 'Lesson'}. Choose file to upload.`);
}

async function deleteQuizQuestion(courseId, lessonId, questionId) {
  try {
    const res = await fetch('/api/tutor/lesson/delete-question.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        course_id: courseId,
        lesson_id: lessonId,
        question_id: questionId
      })
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (res.ok && data && data.success) {
      const course = COURSE_CATALOG[courseId];
      if (course) {
        const lesson = course.lessons.find((l) => l.id === lessonId);
        if (lesson) lesson.quiz = data.quiz;
      }
      renderCurriculumStudio();
      showToast('✓ Quiz question removed.');
    } else {
      throw new Error(data?.message || 'Could not delete question.');
    }
  } catch (err) {
    showToast(err.message);
  }
}

// Submit Edit Lesson Form
const formEditLesson = document.getElementById('form-edit-lesson');
if (formEditLesson) {
  formEditLesson.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-edit-lesson');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving Changes...'; }

    const courseId = document.getElementById('edit-course-id').value;
    const lessonId = document.getElementById('edit-lesson-id').value;
    const name = document.getElementById('edit-lesson-name').value;
    const duration = document.getElementById('edit-lesson-duration').value;
    const summary = document.getElementById('edit-lesson-summary').value;
    const overview = document.getElementById('edit-lesson-overview').value;
    const topics = document.getElementById('edit-lesson-topics').value;
    const lab_steps = document.getElementById('edit-lesson-lab-steps').value;
    const commands_configs = document.getElementById('edit-lesson-configs').value;
    const key_takeaways = document.getElementById('edit-lesson-takeaways').value;

    try {
      const resp = await fetch('/api/tutor/lesson/edit.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          course_id: courseId,
          lesson_id: lessonId,
          name,
          duration,
          summary,
          overview,
          topics,
          lab_steps,
          commands_configs,
          key_takeaways
        })
      });

      const raw = await resp.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

      if (!resp.ok || !data || !data.success) {
        throw new Error(data?.message || 'Failed to save lesson changes.');
      }

      // Update in-memory catalog
      if (COURSE_CATALOG[courseId]) {
        const idx = COURSE_CATALOG[courseId].lessons.findIndex((l) => l.id === lessonId);
        if (idx !== -1 && data.lesson) {
          COURSE_CATALOG[courseId].lessons[idx] = data.lesson;
        }
      }

      closeEditLessonModal();
      renderCurriculumStudio();
      if (courseSelect) populateLessonsForCourse(courseSelect.value);
      showToast(`✓ Updated lesson: "${name}"`);
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Save Lesson Changes</span> <span>✓</span>'; }
    }
  });
}

// Submit Add Question Form
const formAddQuestion = document.getElementById('form-add-question');
if (formAddQuestion) {
  formAddQuestion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-add-question');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding Question...'; }

    const courseId = document.getElementById('question-course-id').value;
    const lessonId = document.getElementById('question-lesson-id').value;
    const question = document.getElementById('question-text').value;

    const opt0 = document.getElementById('q-opt-0').value.trim();
    const opt1 = document.getElementById('q-opt-1').value.trim();
    const opt2 = document.getElementById('q-opt-2').value.trim();
    const opt3 = document.getElementById('q-opt-3').value.trim();
    const options = [opt0, opt1, opt2, opt3].filter(Boolean);

    if (options.length < 2) {
      showToast('Please provide at least 2 options.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Add Question to Quiz</span> <span>✓</span>'; }
      return;
    }

    const answerIdx = Number(document.getElementById('question-correct-answer').value) || 0;
    const explanation = document.getElementById('question-explanation').value;

    try {
      const resp = await fetch('/api/tutor/lesson/add-question.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          course_id: courseId,
          lesson_id: lessonId,
          question,
          options,
          answer: Math.min(answerIdx, options.length - 1),
          explanation
        })
      });

      const raw = await resp.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

      if (!resp.ok || !data || !data.success) {
        throw new Error(data?.message || 'Failed to add question.');
      }

      if (COURSE_CATALOG[courseId]) {
        const lesson = COURSE_CATALOG[courseId].lessons.find((l) => l.id === lessonId);
        if (lesson && data.quiz) {
          lesson.quiz = data.quiz;
        }
      }

      closeAddQuestionModal();
      renderCurriculumStudio();
      showToast(`✓ New question added to quiz! (Total: ${data.quiz?.length || ''})`);
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Add Question to Quiz</span> <span>✓</span>'; }
    }
  });
}

// Submit Add Lesson Form
const formAddLesson = document.getElementById('form-add-lesson');
if (formAddLesson) {
  formAddLesson.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-add-lesson');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating Module...'; }

    const courseId = document.getElementById('new-lesson-course-id').value;
    const name = document.getElementById('new-lesson-name').value;
    const duration = document.getElementById('new-lesson-duration').value;
    const summary = document.getElementById('new-lesson-summary').value;
    const overview = document.getElementById('new-lesson-overview').value;

    try {
      const resp = await fetch('/api/tutor/lesson/add-lesson.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          course_id: courseId,
          name,
          duration,
          summary,
          overview
        })
      });

      const raw = await resp.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

      if (!resp.ok || !data || !data.success) {
        throw new Error(data?.message || 'Failed to add module.');
      }

      if (COURSE_CATALOG[courseId] && data.lesson) {
        COURSE_CATALOG[courseId].lessons.push(data.lesson);
      }

      closeAddLessonModal();
      renderCurriculumStudio();
      if (courseSelect) populateLessonsForCourse(courseSelect.value);
      showToast(`✓ Added module "${name}" to curriculum!`);
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Create & Append Module</span> <span>✓</span>'; }
    }
  });
}

// Modal event listeners (close, cancel, backdrop, escape)
const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
const btnCancelEditLesson = document.getElementById('btn-cancel-edit-lesson');
if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditLessonModal);
if (btnCancelEditLesson) btnCancelEditLesson.addEventListener('click', closeEditLessonModal);

const btnCloseQuestionModal = document.getElementById('btn-close-question-modal');
const btnCancelAddQuestion = document.getElementById('btn-cancel-add-question');
if (btnCloseQuestionModal) btnCloseQuestionModal.addEventListener('click', closeAddQuestionModal);
if (btnCancelAddQuestion) btnCancelAddQuestion.addEventListener('click', closeAddQuestionModal);

const btnCloseAddLessonModal = document.getElementById('btn-close-add-lesson-modal');
const btnCancelAddLesson = document.getElementById('btn-cancel-add-lesson');
if (btnCloseAddLessonModal) btnCloseAddLessonModal.addEventListener('click', closeAddLessonModal);
if (btnCancelAddLesson) btnCancelAddLesson.addEventListener('click', closeAddLessonModal);

const btnAddModuleModal = document.getElementById('btn-add-module-modal');
if (btnAddModuleModal) {
  btnAddModuleModal.addEventListener('click', () => {
    const curTrack = curriculumCourseSelect ? curriculumCourseSelect.value : 'android-enterprise';
    openAddLessonModal(curTrack);
  });
}

// Track Filter Buttons & "+ Add" Symbol Controller
const tutorTrackFilterBtns = document.querySelectorAll('.course-filter-btn[data-tutor-track]');
const btnTutorAddTrackDirect = document.getElementById('btn-tutor-add-track-direct');

function setActiveTutorTrack(trackId) {
  tutorTrackFilterBtns.forEach((btn) => {
    if (btn.dataset.tutorTrack === trackId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (curriculumCourseSelect && curriculumCourseSelect.value !== trackId) {
    curriculumCourseSelect.value = trackId;
  }

  // Also sync the uploads course dropdown if a specific track was picked
  if (trackId !== 'all' && courseSelect && courseSelect.value !== trackId) {
    courseSelect.value = trackId;
    populateLessonsForCourse(trackId);
  }

  renderCurriculumStudio();
}

tutorTrackFilterBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const trackId = btn.dataset.tutorTrack;
    const addSpan = e.target.closest('.filter-btn-add');

    // If tutor clicked the "+" or "Add" symbol badge after this track name
    if (addSpan) {
      e.stopPropagation();
      setActiveTutorTrack(trackId);
      openAddLessonModal(trackId === 'all' ? 'android-enterprise' : trackId);
      return;
    }

    // Normal filter click
    setActiveTutorTrack(trackId);
  });
});

if (btnTutorAddTrackDirect) {
  btnTutorAddTrackDirect.addEventListener('click', () => {
    const currentTrack = curriculumCourseSelect ? curriculumCourseSelect.value : 'android-enterprise';
    openAddLessonModal(currentTrack === 'all' ? 'android-enterprise' : currentTrack);
  });
}

// Quick Add Module button on Current Learners cards
document.querySelectorAll('.tutor-card-add-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const track = btn.dataset.track || 'android-enterprise';
    setActiveTutorTrack(track);
    openAddLessonModal(track);
  });
});

if (curriculumCourseSelect) {
  curriculumCourseSelect.addEventListener('change', () => {
    setActiveTutorTrack(curriculumCourseSelect.value);
  });
}

[modalEditLesson, modalAddQuestion, modalAddLesson].forEach((modal) => {
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditLessonModal();
        closeAddQuestionModal();
        closeAddLessonModal();
      }
    });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditLessonModal();
    closeAddQuestionModal();
    closeAddLessonModal();
  }
});

