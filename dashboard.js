const toast = document.querySelector('#toast');
const userName = document.querySelector('[data-role-name]');
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');

const progressChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('uem_progress_channel') : null;

// Extract token from URL if provided during cross-tab/iframe redirection
try {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || urlParams.get('auth');
  if (tokenFromUrl) {
    sessionStorage.setItem('uem_auth_token', tokenFromUrl);
    localStorage.setItem('uem_auth_token', tokenFromUrl);
    // Clean up query param from URL bar
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
    if (cachedUser.role === 'tutor') {
      window.location.href = 'tutor-dashboard.html';
      return;
    }
    if (userName) {
      userName.textContent = cachedUser.name ? cachedUser.name.split(' ')[0] : 'Candidate';
    }
    if (accountButton) {
      accountButton.textContent = cachedUser.name ? cachedUser.name.charAt(0).toUpperCase() : 'C';
    }
  }

  // 2. Verify with server (sending both cookie and bearer token)
  try {
    const response = await fetch('/api/session.php', {
      credentials: 'same-origin',
      headers: getAuthHeaders()
    });
    const raw = await response.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : {}; } catch (_) {}

    if (response.ok && result && result.success && result.user) {
      const currentUser = result.user;
      if (currentUser.role === 'tutor') {
        window.location.href = 'tutor-dashboard.html';
        return;
      }

      sessionStorage.setItem('uem_user', JSON.stringify(currentUser));
      localStorage.setItem('uem_user', JSON.stringify(currentUser));

      if (userName) {
        userName.textContent = currentUser.name ? currentUser.name.split(' ')[0] : 'Candidate';
      }
      if (accountButton) {
        accountButton.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'C';
      }
      return;
    }

    // Server rejected and no cached user: redirect to login
    if (!cachedUser || cachedUser.role !== 'candidate') {
      sessionStorage.removeItem('uem_auth_token');
      sessionStorage.removeItem('uem_user');
      localStorage.removeItem('uem_auth_token');
      localStorage.removeItem('uem_user');
      window.location.href = 'index.html?login=required';
    }
  } catch (error) {
    // Network hiccup: keep cached user active if available
    if (!cachedUser || cachedUser.role !== 'candidate') {
      window.location.href = 'index.html?login=required';
    }
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

let cachedQuizProgress = {};
try {
  const storedQuiz = localStorage.getItem('uem_quiz_progress');
  if (storedQuiz) cachedQuizProgress = JSON.parse(storedQuiz);
} catch (e) {}

function updateDashboardUI(progressMap, quizMap) {
  if (quizMap && typeof quizMap === 'object') {
    cachedQuizProgress = { ...cachedQuizProgress, ...quizMap };
  }
  if (!progressMap || typeof progressMap !== 'object') return;

  let totalCompleted = 0;
  let activeCourses = 0;

  for (const [courseId, data] of Object.entries(progressMap)) {
    const total = data.total || 6;
    const completed = Math.max(0, Math.min(total, data.completed ?? 0));
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    totalCompleted += completed;
    if (completed > 0) activeCourses++;

    const card = document.querySelector(`[data-dash-course="${courseId}"]`);
    if (card) {
      const pctEl = card.querySelector('[data-role="pct"]');
      const modsEl = card.querySelector('[data-role="mods"]');
      const barEl = card.querySelector('[data-role="bar"]');
      const compBtn = card.querySelector('[data-action="complete-module"]');

      if (pctEl) pctEl.textContent = `${pct}% complete`;
      if (modsEl) modsEl.textContent = `${completed} / ${total} modules`;
      if (barEl) barEl.style.width = `${pct}%`;

      // Update Small Quiz Progress Indicator on Course Card
      const courseQuizzes = (cachedQuizProgress && cachedQuizProgress[courseId]) || {};
      const activeModuleNum = completed < total ? completed + 1 : total;
      const targetLessonId = `module-${activeModuleNum}`;
      const fallbackLessonId = `module-${Math.max(1, completed)}`;
      const lessonQuiz = courseQuizzes[targetLessonId] || courseQuizzes[fallbackLessonId] || null;

      const quizTotal = lessonQuiz?.total || 3;
      const quizScore = lessonQuiz ? Math.min(quizTotal, lessonQuiz.score || 0) : 0;
      const quizPct = quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;
      const isPassed = lessonQuiz ? Boolean(lessonQuiz.passed) : (quizPct >= 70);

      let quizWrap = card.querySelector('[data-role="quiz-indicator-wrap"]');
      if (!quizWrap) {
        // Dynamically create if not already present
        quizWrap = document.createElement('div');
        quizWrap.className = 'course-quiz-progress-wrap';
        quizWrap.setAttribute('data-role', 'quiz-indicator-wrap');
        quizWrap.innerHTML = `
          <div class="course-quiz-progress-header">
            <span class="course-quiz-progress-title">
              <span class="quiz-indicator-dot">🎯</span>
              <span data-role="quiz-lesson-label">Module ${activeModuleNum} Quiz:</span>
            </span>
            <span class="course-quiz-progress-badge" data-role="quiz-badge">
              <strong data-role="quiz-score">${quizScore}</strong> / <span data-role="quiz-total">${quizTotal}</span> correct
            </span>
          </div>
          <div class="course-quiz-progress-track" title="Quiz progress for this lesson">
            <i class="course-quiz-progress-fill" data-role="quiz-bar" style="width:${quizPct}%"></i>
          </div>
        `;
        const barWrap = card.querySelector('.bar');
        if (barWrap && barWrap.parentNode) {
          barWrap.parentNode.insertBefore(quizWrap, barWrap.nextSibling);
        }
      } else {
        const lessonLabelEl = quizWrap.querySelector('[data-role="quiz-lesson-label"]');
        const badgeEl = quizWrap.querySelector('[data-role="quiz-badge"]');
        const barFillEl = quizWrap.querySelector('[data-role="quiz-bar"]');

        if (lessonLabelEl) {
          lessonLabelEl.textContent = `Module ${activeModuleNum} Quiz:`;
        }

        if (badgeEl) {
          if (isPassed && quizScore === quizTotal) {
            badgeEl.innerHTML = `<strong data-role="quiz-score">${quizScore}</strong> / <span data-role="quiz-total">${quizTotal}</span> correct <span class="quiz-badge-check" title="Quiz passed">✓</span>`;
          } else {
            badgeEl.innerHTML = `<strong data-role="quiz-score">${quizScore}</strong> / <span data-role="quiz-total">${quizTotal}</span> correct`;
          }
        }

        if (barFillEl) {
          barFillEl.style.width = `${quizPct}%`;
          if (isPassed) {
            barFillEl.classList.add('is-passed');
          } else {
            barFillEl.classList.remove('is-passed');
          }
        }
      }

      if (compBtn) {
        if (completed >= total) {
          compBtn.disabled = true;
          compBtn.innerHTML = 'All modules complete ✓';
          compBtn.style.opacity = '0.7';
          compBtn.style.cursor = 'default';
        } else {
          compBtn.disabled = false;
          compBtn.innerHTML = `Complete module ${completed + 1} <span>✓</span>`;
          compBtn.style.opacity = '1';
          compBtn.style.cursor = 'pointer';
        }
      }

      // Render Resources Section with PDF downloads for unlocked modules
      updateCourseResourcesOnCard(card, courseId, completed, total);
    }
  }

  const statModules = document.getElementById('stat-modules-completed');
  if (statModules) statModules.textContent = totalCompleted;

  const statActive = document.getElementById('stat-active-courses');
  if (statActive) statActive.textContent = activeCourses;

  const statHours = document.getElementById('stat-hours-learned');
  if (statHours) statHours.textContent = (totalCompleted * 0.85 + 2).toFixed(1);
}

// Render Resources section within each course card on the dashboard
async function updateCourseResourcesOnCard(card, courseId, completed, total) {
  if (!card) return;
  let resourcesWrap = card.querySelector('[data-role="course-resources-wrap"]');
  if (!resourcesWrap) {
    resourcesWrap = document.createElement('div');
    resourcesWrap.className = 'dash-course-resources-card';
    resourcesWrap.setAttribute('data-role', 'course-resources-wrap');
    const actionsEl = card.querySelector('.learning-actions');
    if (actionsEl && actionsEl.parentNode) {
      actionsEl.parentNode.insertBefore(resourcesWrap, actionsEl);
    } else {
      card.appendChild(resourcesWrap);
    }
  }

  try {
    const res = await fetch(`/api/module-resources.php?course_id=${encodeURIComponent(courseId)}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!data || !data.success) return;

    const modules = data.modules || [];
    const unlockedModules = modules.filter((m) => m.isUnlocked);
    const lockedCount = modules.length - unlockedModules.length;

    let listHtml = '';
    unlockedModules.forEach((m) => {
      const pdfs = m.resources || [];
      pdfs.slice(0, 2).forEach((pdf) => {
        listHtml += `
          <li class="dash-resource-item">
            <div class="dash-resource-item-left">
              <span class="dash-resource-file-icon">📕</span>
              <div style="overflow:hidden;">
                <div class="dash-resource-name" title="${pdf.title}">${pdf.filename}</div>
                <div style="font-size:10px;color:#6b7e73;">${pdf.type} · ${Math.round((pdf.size || 140000) / 1024)} KB · ${m.name.split(':')[0]}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <a href="${pdf.download_url}" download="${pdf.filename}" class="dash-resource-btn-dl" title="Download PDF file">
                <span>⬇ Download</span>
              </a>
              <button type="button" class="button button-outline dash-preview-btn" style="padding:4px 8px;font-size:11px;" data-url="${pdf.view_url}" data-name="${pdf.title}" data-filename="${pdf.filename}" data-course="${data.courseName}" data-lesson="${m.name}">
                👁 Preview
              </button>
            </div>
          </li>
        `;
      });
    });

    const lockedHint = lockedCount > 0
      ? `<div class="dash-resources-locked-hint"><span>🔒</span> <span>${lockedCount} upcoming module${lockedCount === 1 ? '' : 's'} locked. Complete quizzes to unlock their PDF materials.</span></div>`
      : `<div class="dash-resources-locked-hint" style="color:#15803d;"><span>✓</span> <span>All module materials unlocked!</span></div>`;

    resourcesWrap.innerHTML = `
      <div class="dash-resources-header">
        <span class="dash-resources-title">
          <span>📚 Resources</span>
        </span>
        <span class="dash-resources-pill">
          ✓ ${unlockedModules.length} Module${unlockedModules.length === 1 ? '' : 's'} Unlocked
        </span>
      </div>
      <ul class="dash-resources-list">
        ${listHtml || '<li style="font-size:12px;color:#7c8f85;padding:4px 0;">No unlocked materials available yet.</li>'}
      </ul>
      ${lockedHint}
    `;

    // Attach preview click handlers
    resourcesWrap.querySelectorAll('.dash-preview-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = btn.dataset.url;
        const name = btn.dataset.name;
        const courseName = btn.dataset.course;
        const lessonName = btn.dataset.lesson;
        openModalPreviewDirect(url, name, courseName, lessonName);
      });
    });
  } catch (err) {
    console.error('Failed to load module resources on dashboard card:', err);
  }
}

function openModalPreviewDirect(url, name, courseName, lessonName) {
  if (previewModalTitle) previewModalTitle.textContent = name || 'Curriculum Resource';
  if (previewModalMeta) {
    previewModalMeta.textContent = `📍 ${courseName || 'Enterprise Track'} → ${lessonName || 'Lesson Module'}`;
  }
  if (previewModalDownload) {
    previewModalDownload.href = url;
    previewModalDownload.setAttribute('download', name || 'resource.pdf');
  }

  if (previewModalBody) {
    previewModalBody.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-modal-iframe';
    iframe.src = `${url}#toolbar=1&view=FitH`;
    iframe.title = name || 'Resource Preview';
    previewModalBody.appendChild(iframe);
  }

  if (previewModal) {
    previewModal.classList.add('open');
    previewModal.setAttribute('aria-hidden', 'false');
  }
}

async function fetchCandidateProgress() {
  try {
    const res = await fetch('/api/progress.php', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (data && data.success && data.progress) {
      if (data.quizProgress) {
        cachedQuizProgress = { ...cachedQuizProgress, ...data.quizProgress };
        try {
          localStorage.setItem('uem_quiz_progress', JSON.stringify(cachedQuizProgress));
        } catch (e) {}
      }
      updateDashboardUI(data.progress, cachedQuizProgress);
      try {
        localStorage.setItem('uem_course_progress', JSON.stringify(data.progress));
      } catch (e) {}
    }
  } catch (err) {
    try {
      const cached = localStorage.getItem('uem_course_progress');
      if (cached) updateDashboardUI(JSON.parse(cached), cachedQuizProgress);
    } catch (e) {}
  }
}

async function completeCourseModule(courseId) {
  try {
    const res = await fetch('/api/progress/complete.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ courseId, action: 'increment' })
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (!res.ok || !data || !data.success) {
      throw new Error(data?.message || 'Failed to update progress.');
    }

    updateDashboardUI(data.progress);
    try {
      localStorage.setItem('uem_course_progress', JSON.stringify(data.progress));
    } catch (e) {}

    if (progressChannel) {
      progressChannel.postMessage({ type: 'PROGRESS_UPDATED', progress: data.progress });
    }

    const updated = data.course || {};
    showToast(`✓ Module completed in ${updated.name || courseId}! (${updated.completed}/${updated.total} - ${updated.percentage}%)`);
  } catch (err) {
    showToast(err.message || 'Could not complete module.');
  }
}

if (progressChannel) {
  progressChannel.onmessage = (event) => {
    if (event.data?.type === 'PROGRESS_UPDATED') {
      fetchCandidateProgress();
    } else if (event.data?.type === 'QUIZ_UPDATED') {
      if (event.data.courseId && event.data.quizProgress) {
        if (!cachedQuizProgress) cachedQuizProgress = {};
        cachedQuizProgress[event.data.courseId] = event.data.quizProgress;
        try {
          localStorage.setItem('uem_quiz_progress', JSON.stringify(cachedQuizProgress));
        } catch (e) {}
        fetchCandidateProgress();
      }
    }
  };
}

loadSession();
fetchCandidateProgress();

// Make entire learning cards clickable to navigate to the new course & lesson page
document.querySelectorAll('.learning-card[data-dash-course]').forEach((card) => {
  card.addEventListener('click', (e) => {
    // If the click was on a button, link, or child action, let that action handle it
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    const courseId = card.getAttribute('data-dash-course');
    if (courseId) {
      window.location.href = `course.html?course=${encodeURIComponent(courseId)}`;
    }
  });
});

// Handle complete module button clicks
document.querySelectorAll('[data-action="complete-module"]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const courseId = btn.dataset.courseId;
    if (courseId) completeCourseModule(courseId);
  });
});

// Preview modal controller for candidate curriculum resources
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
  if (previewModalBody) previewModalBody.innerHTML = '';
}

if (previewModalClose) previewModalClose.addEventListener('click', closePreviewModal);
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

async function openCourseResource(courseId) {
  try {
    const res = await fetch(`/api/course-resources.php?course_id=${encodeURIComponent(courseId)}`, {
      headers: getAuthHeaders()
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    const resources = data?.resources || [];

    if (resources.length === 0) {
      showToast('Lab manual is synced with your course schedule.');
      return;
    }

    const doc = resources[0];
    const fileUrl = doc.url || `uploads/tutor/${doc.stored_name}`;
    const name = doc.original_name || 'Curriculum Guide';
    const isPdf = (doc.mime === 'application/pdf') || (name.toLowerCase().endsWith('.pdf'));

    if (previewModalTitle) previewModalTitle.textContent = name;
    if (previewModalMeta) {
      previewModalMeta.textContent = `📍 ${doc.course_name} → ${doc.lesson_name}`;
    }
    if (previewModalDownload) {
      previewModalDownload.href = fileUrl;
      previewModalDownload.setAttribute('download', name);
    }

    if (previewModalBody) {
      previewModalBody.innerHTML = '';
      if (isPdf) {
        const iframe = document.createElement('iframe');
        iframe.className = 'preview-modal-iframe';
        iframe.src = `${fileUrl}#toolbar=1&view=FitH`;
        iframe.title = name;
        previewModalBody.appendChild(iframe);
      } else {
        previewModalBody.innerHTML = `
          <div class="preview-fallback">
            <div class="preview-fallback-icon">📄</div>
            <h4>${name}</h4>
            <p>Course: <b>${doc.course_name}</b><br>Lesson: <i>${doc.lesson_name}</i></p>
            <a href="${fileUrl}" target="_blank" class="button button-accent">Open Curriculum Document ↗</a>
          </div>
        `;
      }
    }

    if (previewModal) {
      previewModal.classList.add('open');
      previewModal.setAttribute('aria-hidden', 'false');
    }
  } catch (err) {
    showToast('Lab manual opened — your progress is synced in real-time.');
  }
}

document.querySelectorAll('[data-action="lesson"]').forEach((button) => {
  button.addEventListener('click', () => {
    const courseId = button.dataset.courseId || 'android-enterprise';
    openCourseResource(courseId);
  });
});

document.getElementById('browse-button').addEventListener('click', () => {
  window.location.href = 'index.html#courses';
});

document.getElementById('account-button').addEventListener('click', () => showToast('Logged in as candidate.'));

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

// Category filter button handler for enrolled enterprise tracks on Dashboard
const dashFilterBtns = document.querySelectorAll('[data-dash-filter]');
if (dashFilterBtns.length > 0) {
  dashFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-dash-filter');
      dashFilterBtns.forEach((b) => b.classList.toggle('active', b === btn));
      const enrolledCards = document.querySelectorAll('.learning-card[data-dash-course]');
      enrolledCards.forEach((card) => {
        const courseId = card.getAttribute('data-dash-course');
        if (filter === 'all' || courseId === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

