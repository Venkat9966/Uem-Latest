// Course & Lesson Module Controller with Tutor Uploads Integration

function getAuthHeaders() {
  const token = sessionStorage.getItem('uem_auth_token') || localStorage.getItem('uem_auth_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }
  return headers;
}

const toast = document.getElementById('toast');
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// Session Verification & User Profile
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');
const tutorDashNavLink = document.getElementById('tutor-dash-nav-link');
const tutorModeStatusTag = document.getElementById('tutor-mode-status-tag');
const btnToggleTutorMode = document.getElementById('btn-toggle-tutor-mode');
const tutorToggleLabel = document.getElementById('tutor-toggle-label');
const btnCourseAddModuleHeader = document.getElementById('btn-course-add-module-header');
const btnCourseAddTrackDirect = document.getElementById('btn-course-add-track-direct');
const curriculumModePill = document.getElementById('curriculum-mode-pill');
const curriculumModeDot = document.getElementById('curriculum-mode-dot');
const curriculumModeText = document.getElementById('curriculum-mode-text');

let currentUser = null;
let isTutor = false;
let isTutorMode = true; // Enabled by default to provide the requested tutor '+' and 'Add' controls

function updateTutorModeUI() {
  if (tutorDashNavLink) {
    tutorDashNavLink.style.display = (isTutor || isTutorMode) ? 'inline-flex' : 'none';
  }
  if (tutorModeStatusTag) {
    tutorModeStatusTag.style.display = isTutorMode ? 'inline-block' : 'none';
  }
  if (btnToggleTutorMode) {
    btnToggleTutorMode.classList.toggle('is-off', !isTutorMode);
  }
  if (tutorToggleLabel) {
    tutorToggleLabel.textContent = isTutorMode ? '👨‍🏫 Tutor View: ON' : 'Candidate View (Sequential)';
  }
  if (btnCourseAddModuleHeader) {
    btnCourseAddModuleHeader.style.display = isTutorMode ? 'inline-flex' : 'none';
  }
  if (curriculumModeText) {
    curriculumModeText.textContent = isTutorMode ? 'Tutor Full Access (All Lessons Unlocked)' : 'Sequential Gating Active';
  }
  if (curriculumModeDot) {
    curriculumModeDot.style.color = isTutorMode ? '#274d15' : '#10b981';
  }
}

async function loadSession() {
  const cachedUserRaw = sessionStorage.getItem('uem_user') || localStorage.getItem('uem_user');
  let cachedUser = null;
  if (cachedUserRaw) {
    try { cachedUser = JSON.parse(cachedUserRaw); } catch (e) {}
  }

  if (cachedUser) {
    currentUser = cachedUser;
    if (accountButton) {
      accountButton.textContent = cachedUser.name ? cachedUser.name.charAt(0).toUpperCase() : (cachedUser.role === 'tutor' ? 'T' : 'C');
    }
    if (cachedUser.role === 'tutor') {
      isTutor = true;
    }
  }

  try {
    const response = await fetch('/api/session.php', {
      credentials: 'same-origin',
      headers: getAuthHeaders()
    });
    const raw = await response.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : {}; } catch (_) {}

    if (response.ok && result && result.success && result.user) {
      sessionStorage.setItem('uem_user', JSON.stringify(result.user));
      localStorage.setItem('uem_user', JSON.stringify(result.user));
      currentUser = result.user;
      if (accountButton) {
        accountButton.textContent = result.user.name ? result.user.name.charAt(0).toUpperCase() : (result.user.role === 'tutor' ? 'T' : 'C');
      }
      if (result.user.role === 'tutor') {
        isTutor = true;
      }
    }
  } catch (err) {}

  // Check saved mode or default
  const savedTutorMode = sessionStorage.getItem('uem_tutor_mode');
  if (savedTutorMode !== null) {
    isTutorMode = savedTutorMode === 'true';
  } else if (isTutor || urlParams.get('tutor') === '1') {
    isTutorMode = true;
  } else {
    isTutorMode = true; // Default to true so tutor tools and '+' buttons are immediately accessible
  }

  updateTutorModeUI();
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    try {
      await fetch('/api/logout.php', {
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
}

// Course Track Colors & Artwork
const TRACK_BADGES = {
  'android-enterprise': { bg: '#1e3a24', color: '#a3e635', label: 'Android Enterprise Track' },
  'workspace-one': { bg: '#0c4a6e', color: '#7dd3fc', label: 'Workspace ONE Track' },
  'soti-mobicontrol': { bg: '#115e59', color: '#5eead4', label: 'SOTI MobiControl Track' },
  'ivanti-neurons': { bg: '#831843', color: '#fbcfe8', label: 'Ivanti Neurons Track' },
  'rugged-devices': { bg: '#1e293b', color: '#facc15', label: 'Rugged & Frontline Track' },
  'intune-essentials': { bg: '#431407', color: '#fed7aa', label: 'Microsoft Intune Track' }
};

// URL Parameters
const urlParams = new URLSearchParams(window.location.search);
let currentCourseId = urlParams.get('course') || 'android-enterprise';
const targetModuleId = urlParams.get('module') || null;

// State
let courseCatalog = {};
let currentCourse = null;
let candidateProgress = {};
let candidateQuizProgress = {};
let courseResources = [];

const progressChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('uem_progress_channel') : null;
try {
  const cachedQ = localStorage.getItem('uem_quiz_progress');
  if (cachedQ) candidateQuizProgress = JSON.parse(cachedQ);
} catch (e) {}

// DOM Elements
const breadcrumbCourseName = document.getElementById('breadcrumb-course-name');
const courseTrackPill = document.getElementById('course-track-pill');
const courseTitle = document.getElementById('course-title');
const courseDesc = document.getElementById('course-desc');
const courseInstructor = document.getElementById('course-instructor');
const courseDuration = document.getElementById('course-duration');
const courseMaterialsTotal = document.getElementById('course-materials-total');

const progressPercentagePill = document.getElementById('progress-percentage-pill');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressModulesStat = document.getElementById('progress-modules-stat');
const progressStatusStat = document.getElementById('progress-status-stat');
const nextLessonBtn = document.getElementById('next-lesson-btn');
const lessonsContainer = document.getElementById('lessons-container');

// Document Preview Modal Elements
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

function openDocumentPreview({ url, name, mime, size, course_name, lesson_name }) {
  if (!previewModal || !previewModalBody) return;

  const isPdf = (mime === 'application/pdf') || (name && name.toLowerCase().endsWith('.pdf'));
  const isImage = (mime && mime.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name || '');
  const isJson = (mime === 'application/json') || (name && name.toLowerCase().endsWith('.json'));

  if (previewModalTitle) previewModalTitle.textContent = name || 'Curriculum Document';
  const sizeText = size ? ` · ${Math.round(size / 1024)} KB` : '';
  const typeText = isPdf ? 'PDF Manual' : isImage ? 'Image Diagram' : isJson ? 'JSON Blueprint' : (mime || 'Document');
  const pathText = (course_name || lesson_name) ? ` · 📍 ${course_name || ''} → ${lesson_name || ''}` : '';

  if (previewModalMeta) {
    previewModalMeta.textContent = `${typeText}${sizeText}${pathText}`;
  }

  if (previewModalDownload) {
    previewModalDownload.href = url;
    previewModalDownload.setAttribute('download', name || 'resource');
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
    imgWrap.style.cssText = 'height:100%;display:grid;place-items:center;background:#0d1512;overflow:auto;padding:20px;';
    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    imgWrap.appendChild(img);
    previewModalBody.appendChild(imgWrap);
  } else if (isJson) {
    const pre = document.createElement('pre');
    pre.className = 'preview-modal-text';
    pre.textContent = 'Loading JSON script...';
    previewModalBody.appendChild(pre);

    fetch(url)
      .then((r) => r.text())
      .then((txt) => {
        try {
          pre.textContent = JSON.stringify(JSON.parse(txt), null, 2);
        } catch (_) {
          pre.textContent = txt;
        }
      })
      .catch(() => {
        pre.textContent = 'Could not preview JSON file. Please open directly.';
      });
  } else {
    previewModalBody.innerHTML = `
      <div class="preview-fallback">
        <div class="preview-fallback-icon">📄</div>
        <h4>${name || 'Curriculum File'}</h4>
        <p>This file format can be opened directly in your browser or downloaded to your device.</p>
        <a href="${url}" target="_blank" rel="noopener" class="button button-accent">Open / Download Resource ↗</a>
      </div>
    `;
  }

  previewModal.classList.add('open');
  previewModal.setAttribute('aria-hidden', 'false');
}

// Fetch Course Data, Progress & Tutor Uploads
async function initializeCoursePage() {
  loadSession();

  try {
    // 1. Fetch courses catalog
    const catResp = await fetch('/api/courses-catalog.php');
    const catJson = await catResp.json();
    courseCatalog = catJson.catalog || {};
    currentCourse = courseCatalog[currentCourseId] || courseCatalog['android-enterprise'];

    // 2. Fetch candidate's progress and quiz progress
    const progResp = await fetch('/api/progress.php', { headers: getAuthHeaders() });
    const progJson = await progResp.json();
    candidateProgress = progJson.progress || {};
    if (progJson.quizProgress) {
      candidateQuizProgress = { ...candidateQuizProgress, ...progJson.quizProgress };
      try {
        localStorage.setItem('uem_quiz_progress', JSON.stringify(candidateQuizProgress));
      } catch (e) {}
    }

    // 3. Fetch tutor-uploaded curriculum resources for this specific course
    const resResp = await fetch(`/api/course-resources.php?course_id=${encodeURIComponent(currentCourseId)}`, {
      headers: getAuthHeaders()
    });
    const resJson = await resResp.json();
    courseResources = resJson.resources || [];

    // Render course hero and lessons
    renderCourseHero();
    renderLessonModules();
    attachTrackFilterListeners();
  } catch (err) {
    if (lessonsContainer) {
      lessonsContainer.innerHTML = `
        <div style="padding:28px;text-align:center;color:#c53030;background:#fff;border-radius:12px;">
          Failed to load course modules: ${err.message}. <br>
          <a href="dashboard.html" class="button button-outline" style="margin-top:12px;display:inline-block;">Return to Dashboard</a>
        </div>
      `;
    }
  }
}

function renderCourseHero() {
  if (!currentCourse) return;

  const badgeInfo = TRACK_BADGES[currentCourseId] || { bg: '#14231f', color: '#d8f56b', label: 'Enterprise Track' };

  if (breadcrumbCourseName) breadcrumbCourseName.textContent = currentCourse.name;
  if (courseTrackPill) {
    courseTrackPill.textContent = currentCourse.category || badgeInfo.label;
    courseTrackPill.style.background = badgeInfo.bg;
    courseTrackPill.style.color = badgeInfo.color;
  }
  if (courseTitle) courseTitle.textContent = currentCourse.name;
  if (courseDesc) {
    courseDesc.textContent = currentCourse.description ||
      'Master industry-standard enterprise mobile endpoint management, policy design, compliance automation, and hands-on lab deployments.';
  }
  if (courseInstructor) {
    courseInstructor.textContent = currentCourse.instructor || 'Senior UEM Solutions Architect';
  }

  const lessons = currentCourse.lessons || [];
  if (courseDuration) {
    courseDuration.textContent = `${lessons.length} Modules · Hands-on Interactive Labs`;
  }
  if (courseMaterialsTotal) {
    courseMaterialsTotal.textContent = `${courseResources.length} Instructor Upload${courseResources.length === 1 ? '' : 's'}`;
  }

  // Sync active track filter button
  document.querySelectorAll('.course-filter-btn[data-tutor-track]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tutorTrack === currentCourseId);
  });

  updateProgressCard();
}

function updateProgressCard() {
  const lessons = currentCourse?.lessons || [];
  const total = lessons.length || 6;
  const courseProg = candidateProgress[currentCourseId] || {};
  const completed = Math.min(total, courseProg.completed || 0);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (progressPercentagePill) progressPercentagePill.textContent = `${percentage}% Complete`;
  if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
  if (progressModulesStat) progressModulesStat.textContent = `${completed} of ${total} lessons completed`;
  if (progressStatusStat) {
    progressStatusStat.textContent = completed >= total ? 'Completed 🏆' : (completed > 0 ? 'In Progress' : 'Not Started');
  }

  if (nextLessonBtn) {
    if (completed >= total) {
      nextLessonBtn.innerHTML = 'All Lessons Completed 🏆 Review Curriculum';
      nextLessonBtn.onclick = () => {
        const first = document.querySelector('.lesson-card');
        if (first) first.scrollIntoView({ behavior: 'smooth' });
      };
    } else {
      const courseQuizzes = (candidateQuizProgress && candidateQuizProgress[currentCourseId]) || {};
      const activeLesson = lessons[completed] || null;
      const isPassed = activeLesson ? Boolean(courseQuizzes[activeLesson.id]?.passed) : false;

      if (isPassed) {
        nextLessonBtn.innerHTML = `Proceed to Lesson ${completed + 2 <= total ? completed + 2 : total} <span>→</span>`;
        nextLessonBtn.onclick = () => {
          advanceToNextLesson(completed, completed + 1);
        };
      } else {
        nextLessonBtn.innerHTML = `Complete Lesson ${completed + 1} Quiz 🔒`;
        nextLessonBtn.onclick = () => {
          const currentCard = document.querySelector(`[data-lesson-idx="${completed}"]`);
          if (currentCard) {
            const quizEl = currentCard.querySelector('.lesson-mandatory-quiz-box');
            if (quizEl) {
              quizEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              currentCard.scrollIntoView({ behavior: 'smooth' });
            }
          }
        };
      }
    }
  }
}

function getFileIconInfo(mime, name) {
  const ext = (name || '').toLowerCase();
  if (mime === 'application/pdf' || ext.endsWith('.pdf')) {
    return { icon: '📕', className: 'icon-pdf', type: 'PDF' };
  }
  if (mime === 'application/json' || ext.endsWith('.json')) {
    return { icon: '⚙️', className: 'icon-json', type: 'JSON' };
  }
  if (mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(ext)) {
    return { icon: '🖼️', className: 'icon-img', type: 'IMG' };
  }
  if (mime?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(ext)) {
    return { icon: '🎬', className: 'icon-video', type: 'VIDEO' };
  }
  return { icon: '📄', className: 'icon-doc', type: 'DOC' };
}

function updateLessonQuizIndicator(lessonId, score, total, percentage, passed) {
  const indicatorCard = document.getElementById(`quiz-indicator-${lessonId}`);
  if (indicatorCard) {
    const scoreNum = indicatorCard.querySelector('.quiz-indicator-score-num');
    const scoreTotal = indicatorCard.querySelector('.quiz-indicator-score-total');
    const pctLabel = indicatorCard.querySelector('.quiz-indicator-pct-label');
    const barFill = indicatorCard.querySelector('.quiz-indicator-bar-fill');
    const leftGroup = indicatorCard.querySelector('.quiz-indicator-left');

    if (scoreNum) scoreNum.textContent = score;
    if (scoreTotal) scoreTotal.textContent = total;
    if (pctLabel) pctLabel.textContent = `${percentage}%`;
    if (barFill) {
      barFill.style.width = `${percentage}%`;
      if (passed) {
        barFill.classList.add('is-passed');
      } else {
        barFill.classList.remove('is-passed');
      }
    }

    if (leftGroup) {
      const existingPill = leftGroup.querySelector('.quiz-indicator-pill-passed, .quiz-indicator-pill-score, .quiz-indicator-pill-unattempted');
      if (existingPill) existingPill.remove();

      const newPill = document.createElement('span');
      if (passed) {
        newPill.className = 'quiz-indicator-pill-passed';
        newPill.textContent = '✓ Passed';
      } else {
        newPill.className = 'quiz-indicator-pill-score';
        newPill.textContent = `${percentage}% score`;
      }
      leftGroup.appendChild(newPill);
    }
  }

  const btnScore = document.getElementById(`btn-quiz-score-${lessonId}`);
  if (btnScore) {
    btnScore.textContent = `${score}/${total} Correct`;
  }
}

async function advanceToNextLesson(currentIdx, nextIdx) {
  try {
    const resp = await fetch('/api/progress.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        courseId: currentCourseId,
        action: 'set',
        completed: nextIdx
      })
    });
    const resData = await resp.json();
    if (resData && resData.success) {
      candidateProgress = resData.progress || candidateProgress;
    }
  } catch (err) {
    console.error('Failed to update progress on server:', err);
  }

  if (progressChannel) {
    progressChannel.postMessage({
      type: 'PROGRESS_UPDATED',
      courseId: currentCourseId,
      progress: candidateProgress
    });
  }

  updateProgressCard();
  renderLessonModules();

  setTimeout(() => {
    const nextCard = document.querySelector(`[data-lesson-idx="${nextIdx}"]`);
    if (nextCard) {
      nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 120);

  showToast(`🎉 Lesson ${currentIdx + 1} completed! Welcome to Lesson ${nextIdx + 1}.`);
}

function renderLessonModules() {
  if (!lessonsContainer || !currentCourse) return;

  const lessons = currentCourse.lessons || [];
  const courseProg = candidateProgress[currentCourseId] || {};
  const completedCount = courseProg.completed || 0;

  lessonsContainer.innerHTML = '';

  lessons.forEach((lesson, idx) => {
    const isCompleted = idx < completedCount;
    const isCurrent = idx === completedCount;
    const isLocked = !isTutorMode && (idx > completedCount);

    // Filter tutor resources mapped to this specific lesson module
    const lessonUploads = courseResources.filter((r) => {
      if (r.lesson_id && r.lesson_id === lesson.id) return true;
      if (r.lesson_name && r.lesson_name.toLowerCase().includes(`module ${idx + 1}`)) return true;
      return false;
    });

    const details = lesson.details || {};
    const quizList = Array.isArray(lesson.quiz) ? lesson.quiz : [];

    // Calculate Quiz Progress for this specific lesson module
    const courseQuizzes = (candidateQuizProgress && candidateQuizProgress[currentCourseId]) || {};
    const lessonQuizData = courseQuizzes[lesson.id] || null;
    const totalQuestions = quizList.length || 3;
    const answeredCorrect = lessonQuizData ? Math.min(totalQuestions, lessonQuizData.score ?? 0) : 0;
    const quizPct = totalQuestions > 0 ? Math.round((answeredCorrect / totalQuestions) * 100) : 0;
    const isPassed = lessonQuizData ? Boolean(lessonQuizData.passed) : false;
    const hasAttempted = lessonQuizData !== null;

    const card = document.createElement('article');
    card.setAttribute('data-lesson-id', lesson.id);
    card.setAttribute('data-lesson-idx', idx);

    // ========================================================
    // CASE 1: LOCKED & HIDDEN LESSON (Sequential Gating - only when not in Tutor Mode)
    // ========================================================
    if (isLocked) {
      card.className = 'lesson-card is-locked';
      card.innerHTML = `
        <div class="lesson-locked-wrap">
          <div class="lesson-locked-icon-col">
            <span class="lesson-locked-padlock">🔒</span>
          </div>
          <div class="lesson-locked-content">
            <div class="lesson-locked-badges">
              <span class="lesson-num-badge">Lesson ${idx + 1} of ${lessons.length}</span>
              <span class="locked-pill">🔒 Locked & Hidden</span>
            </div>
            <h3 class="lesson-locked-title">${lesson.name}</h3>
            <p class="lesson-locked-desc">
              This module's context and interactive quiz are hidden. You must complete <strong>Lesson ${idx}</strong> and pass its mandatory quiz with at least 70% to unlock this lesson.
            </p>
          </div>
        </div>
      `;
      lessonsContainer.appendChild(card);
      return;
    }

    // ========================================================
    // CASE 2 & 3: ACTIVE LESSON OR COMPLETED LESSON
    // ========================================================
    card.className = `lesson-card ${isCompleted ? 'completed-lesson' : 'active-lesson'}`;

    // Study confirmation state check
    const studiedKey = `uem_studied_${currentCourseId}_${lesson.id}`;
    const isStudied = localStorage.getItem(studiedKey) === 'true' || isCompleted;

    // 1. LESSON CONTEXT BOX HTML
    const lessonContextBoxHtml = `
      <div class="lesson-context-box" id="context-box-${lesson.id}">
        <div class="context-box-header">
          <div class="context-box-header-title">
            <span class="context-box-icon">📖</span>
            <div>
              <h4>Lesson Context & Curriculum Guide</h4>
              <span class="context-box-sub">Read the core architecture principles, key knowledge topics, and production lab instructions below.</span>
            </div>
          </div>
          <span class="context-step-tag">Step 1 of 2: Study Context</span>
        </div>

        <!-- 1. Architectural Concept & Overview -->
        <div class="context-section">
          <div class="context-section-label">
            <span>🏛️ Architecture & Concept:</span>
          </div>
          <div class="context-overview-content">
            <p>${details.overview || lesson.summary || 'Detailed architectural guidelines and enterprise policy mechanics.'}</p>
          </div>
        </div>

        <!-- 2. Core Knowledge Topics -->
        ${details.topics && details.topics.length > 0 ? `
          <div class="context-section">
            <div class="context-section-label">
              <span>🎯 Core Knowledge Topics:</span>
            </div>
            <div class="context-topics-grid">
              ${details.topics.map(t => `<div class="context-topic-badge"><span class="topic-check">✓</span> <span>${t}</span></div>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 3. Step-by-Step Hands-On Production Lab Walkthrough -->
        ${details.lab_guide && details.lab_guide.length > 0 ? `
          <div class="context-section">
            <div class="context-section-label">
              <span>🧪 Step-by-Step Production Lab Walkthrough:</span>
            </div>
            <div class="context-lab-steps">
              ${details.lab_guide.map((step, sIdx) => `
                <div class="context-lab-step-item">
                  <span class="context-step-badge">Step ${sIdx + 1}</span>
                  <span class="context-step-text">${step}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 4. Production Configurations, ADB Commands & Schemas -->
        ${details.commands_configs ? `
          <div class="context-section">
            <div class="context-section-label">
              <span>💻 Production Configurations, ADB Commands & Schemas:</span>
            </div>
            <div class="context-code-block">
              <button type="button" class="btn-copy-snippet" data-code="${encodeURIComponent(details.commands_configs)}">Copy Config</button>
              <pre>${details.commands_configs}</pre>
            </div>
          </div>
        ` : ''}

        <!-- 5. Enterprise Best Practices & Key Takeaways -->
        ${details.key_takeaways && details.key_takeaways.length > 0 ? `
          <div class="context-section">
            <div class="context-takeaways-card">
              <strong>💡 Enterprise Best Practices & Key Takeaways:</strong>
              <ul>
                ${details.key_takeaways.map(k => `<li>${k}</li>`).join('')}
              </ul>
            </div>
          </div>
        ` : ''}

        <!-- 6. Instructor Uploaded Supplemental Resources (Inline Context) -->
        ${lessonUploads.length > 0 ? `
          <div class="context-section">
            <div class="context-section-label">
              <span>📁 Attached Instructor Resources & Notes:</span>
            </div>
            <div class="context-inline-uploads">
              ${lessonUploads.map(res => {
                const fileInfo = getFileIconInfo(res.mime, res.original_name);
                const fileUrl = res.url || `uploads/tutor/${res.stored_name}`;
                return `
                  <div class="inline-upload-card">
                    <div class="inline-upload-meta">
                      <span class="inline-upload-icon">${fileInfo.icon}</span>
                      <div>
                        <strong class="inline-upload-name">${res.original_name}</strong>
                        <span class="inline-upload-desc">${fileInfo.type} · ${Math.round((res.size || 0) / 1024)} KB · Provided by Tutor</span>
                      </div>
                    </div>
                    <div class="inline-upload-actions">
                      <a href="${fileUrl}" target="_blank" rel="noopener" class="btn-inline-view" download="${res.original_name}">
                        <span>⬇ Download / Open Reference</span>
                      </a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Bottom of Context Box: Study Confirmation -->
        <div class="context-study-confirm-bar">
          <div class="context-confirm-left">
            <span class="confirm-check-icon">✓</span>
            <span>Reviewing this curriculum context prepares you for the mandatory assessment.</span>
          </div>
          <button type="button" class="btn-mark-context-studied ${isStudied ? 'studied' : ''}" data-lesson-id="${lesson.id}">
            <span>${isStudied ? '✓ Context Studied' : 'Mark Context Studied ✓'}</span>
          </button>
        </div>
      </div>
    `;

    // 2. RESOURCES SECTION HTML (Strictly rendered only for unlocked modules!)
    const moduleManualPdfUrl = `/api/module-pdf.php?course_id=${encodeURIComponent(currentCourseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=manual&download=1`;
    const moduleManualViewUrl = `/api/module-pdf.php?course_id=${encodeURIComponent(currentCourseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=manual`;
    const moduleBlueprintPdfUrl = `/api/module-pdf.php?course_id=${encodeURIComponent(currentCourseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=blueprint&download=1`;
    const moduleBlueprintViewUrl = `/api/module-pdf.php?course_id=${encodeURIComponent(currentCourseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=blueprint`;

    // Filter and map tutor uploaded materials for this module
    const tutorPdfUploads = lessonUploads.map((res) => {
      const fileUrl = res.url || `uploads/tutor/${res.stored_name}`;
      const downloadUrl = `/api/download-file.php?stored_name=${encodeURIComponent(res.stored_name)}&name=${encodeURIComponent(res.original_name)}`;
      return {
        id: `tutor-${res.id}`,
        name: res.original_name,
        badge: 'Instructor Reference',
        tagClass: 'tag-instructor',
        desc: `Instructor-assigned curriculum reference and hands-on attachment for ${lesson.name}.`,
        sizeText: `${Math.round((res.size || 64000) / 1024)} KB PDF`,
        downloadUrl,
        viewUrl: fileUrl,
        filename: res.original_name
      };
    });

    const modulePdfResources = [
      {
        id: `${lesson.id}-manual`,
        name: `${lesson.name} — Official Lab Manual & Curriculum Guide.pdf`,
        badge: 'Official Lab Manual',
        tagClass: 'tag-official',
        desc: 'Comprehensive hands-on lab exercises, architectural principles, step-by-step procedures, and knowledge checks.',
        sizeText: '148 KB PDF',
        downloadUrl: moduleManualPdfUrl,
        viewUrl: moduleManualViewUrl,
        filename: `${lesson.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_Lab_Manual.pdf`
      },
      {
        id: `${lesson.id}-blueprint`,
        name: `${lesson.name} — Architecture Schemas & Deployment Payloads.pdf`,
        badge: 'Technical Blueprint',
        tagClass: 'tag-blueprint',
        desc: 'Production configuration payloads, DPC provisioning extras, AppConfig XML/JSON schemas, and verification commands.',
        sizeText: '96 KB PDF',
        downloadUrl: moduleBlueprintPdfUrl,
        viewUrl: moduleBlueprintViewUrl,
        filename: `${lesson.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Architecture_Blueprint.pdf`
      },
      ...tutorPdfUploads
    ];

    const lessonResourcesSectionHtml = `
      <section class="lesson-resources-section" id="resources-${lesson.id}">
        <div class="lesson-resources-header">
          <div class="lesson-resources-title-group">
            <span class="lesson-resources-icon">📚</span>
            <div>
              <h4>Resources & PDF Downloads</h4>
              <span class="lesson-resources-sub">Specific materials, lab guides, and blueprints associated with this unlocked module.</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${isTutorMode ? `
              <button type="button" class="btn-tutor-add-resource-inline" data-action="upload-material" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Upload instructor material to this lesson">
                <span>📁 + Add Extra Material / PDF</span>
              </button>
            ` : ''}
            <span class="lesson-resources-unlocked-badge">✓ Module Unlocked · ${modulePdfResources.length} Material${modulePdfResources.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="lesson-resources-grid">
          ${modulePdfResources.map((res) => `
            <div class="resource-pdf-card">
              <div class="resource-pdf-left">
                <div class="resource-pdf-icon-badge">
                  <span class="pdf-glyph">📕</span>
                  <span class="pdf-ext">PDF</span>
                </div>
                <div class="resource-pdf-meta">
                  <div class="resource-pdf-title-row">
                    <span class="resource-pdf-title">${res.name}</span>
                    <span class="resource-pdf-tag ${res.tagClass}">${res.badge}</span>
                  </div>
                  <p class="resource-pdf-desc">${res.desc}</p>
                  <span class="resource-pdf-specs">📎 Format: Adobe PDF Document · Size: ${res.sizeText}</span>
                </div>
              </div>
              <div class="resource-pdf-actions">
                <a href="${res.downloadUrl}" download="${res.filename}" class="btn-resource-download" title="Download ${res.name}">
                  <span>⬇ Download PDF</span>
                </a>
                <button type="button" class="btn-resource-preview" data-url="${res.viewUrl}" data-name="${res.name}" data-filename="${res.filename}" data-lesson-name="${lesson.name}">
                  <span>👁 Preview</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    // 3. QUIZ PROGRESS INDICATOR HTML
    const quizProgressIndicatorHtml = `
      <div class="lesson-quiz-indicator-card" id="quiz-indicator-${lesson.id}">
        <div class="quiz-indicator-row">
          <div class="quiz-indicator-left">
            <span class="quiz-indicator-symbol">🎯</span>
            <span class="quiz-indicator-label">Quiz Status:</span>
            <span class="quiz-indicator-score-wrap">
              <strong class="quiz-indicator-score-num">${answeredCorrect}</strong> of <span class="quiz-indicator-score-total">${totalQuestions}</span> questions correct
            </span>
            ${isPassed ? '<span class="quiz-indicator-pill-passed">✓ Passed</span>' : (hasAttempted ? `<span class="quiz-indicator-pill-score">${quizPct}% score</span>` : '<span class="quiz-indicator-pill-unattempted">Attempt Required</span>')}
          </div>
          <span class="quiz-indicator-pct-label">${quizPct}%</span>
        </div>
        <div class="quiz-indicator-bar-track" title="${answeredCorrect} of ${totalQuestions} questions answered correctly (${quizPct}%)">
          <i class="quiz-indicator-bar-fill ${isPassed ? 'is-passed' : ''}" style="width: ${quizPct}%;"></i>
        </div>
      </div>
    `;

    // 3. MANDATORY QUIZ BOX HTML
    const mandatoryQuizBoxHtml = `
      <div class="lesson-mandatory-quiz-box" id="quiz-${lesson.id}">
        <div class="mandatory-quiz-header">
          <div class="mandatory-quiz-title-wrap">
            <span class="mandatory-quiz-icon">🎯</span>
            <div>
              <h4>Mandatory Lesson Assessment: <em>${lesson.name}</em></h4>
              <span class="mandatory-quiz-rule">Step 2 of 2 · ⚠️ Passing Grade: 70%+ required to unlock next lesson</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${isTutorMode ? `
              <button type="button" class="btn-tutor-lesson-header" data-action="add-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Add quiz question">
                <span>🎯 + Add Question</span>
              </button>
            ` : ''}
            <div class="mandatory-quiz-status-pill ${isPassed ? 'is-passed' : 'is-pending'}">
              ${isPassed ? '✓ Passed (Requirement Met)' : '⚠️ Quiz Mandatory'}
            </div>
          </div>
        </div>

        <div class="quiz-questions-wrap" id="quiz-wrap-${lesson.id}">
          ${quizList.length === 0 ? `
            <div style="display:flex;align-items:center;justify-content:space-between;background:#fbfdfa;border:1px dashed #c9d8c3;border-radius:8px;padding:12px 14px;margin:10px 0;">
              <span style="font-size:13px;color:#72857a;">No questions available for this module yet.</span>
              ${isTutorMode ? `
                <button type="button" class="btn-tutor-lesson-header" data-action="add-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}">
                  <span>+ Add First Question</span>
                </button>
              ` : ''}
            </div>
          ` : quizList.map((q, qIdx) => `
            <div class="quiz-question-card" data-qidx="${qIdx}" data-qid="${q.id}">
              <p class="quiz-question-prompt"><strong>Question ${qIdx + 1}:</strong> ${q.question}</p>
              <div class="quiz-options-list">
                ${q.options.map((opt, oIdx) => `
                  <label class="quiz-option-label" data-optidx="${oIdx}">
                    <input type="radio" name="quiz_${lesson.id}_${qIdx}" value="${oIdx}" class="quiz-option-input">
                    <span>${opt}</span>
                  </label>
                `).join('')}
              </div>
              <div class="quiz-explanation-box" style="display:none;" id="expl-${lesson.id}-${qIdx}"></div>

              ${isTutorMode ? `
                <div class="tutor-add-q-after-row" style="margin-top:8px;">
                  <button type="button" class="btn-add-q-after" data-action="add-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Add Question After Q${qIdx + 1}">
                    <span class="add-plus-symbol">+</span>
                    <span>Add Question After Q${qIdx + 1}</span>
                  </button>
                  <button type="button" class="btn-delete-q-course" data-action="delete-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" data-qid="${q.id}" style="background:none;border:none;color:#c53030;font-size:11px;cursor:pointer;font-weight:700;margin-left:8px;" title="Delete this question">
                    🗑 Delete Q${qIdx + 1}
                  </button>
                </div>
              ` : ''}
            </div>
          `).join('')}

          <div class="quiz-results-banner ${isPassed ? 'passed' : 'failed'}" id="quiz-results-${lesson.id}" style="${hasAttempted ? 'display:flex;' : 'display:none;'}">
            ${hasAttempted ? `
              <strong>${isPassed ? '🎉 Mandatory Quiz Passed!' : '📖 Review Needed to Pass'} Score: ${quizPct}% (${answeredCorrect}/${totalQuestions})</strong>
              <p style="margin:0;font-size:13px;">${isPassed ? 'Requirement satisfied! You can now proceed to the next lesson below.' : 'Passing score is 70%. Review the lesson context box above and retake the quiz to unlock the next module.'}</p>
            ` : ''}
          </div>

          ${quizList.length > 0 ? `
            <div class="quiz-action-buttons">
              <button type="button" class="button button-accent btn-submit-quiz" data-course="${currentCourseId}" data-lesson="${lesson.id}">
                Submit Answers & Verify Grade <span>✓</span>
              </button>
              <button type="button" class="button button-outline btn-reset-quiz" data-lesson="${lesson.id}" style="${hasAttempted ? 'display:inline-flex;' : 'display:none;'}">
                Retake Quiz <span>↺</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 4. NEXT LESSON NAVIGATION BAR HTML
    const nextNavBarHtml = `
      <div class="lesson-next-nav-bar" id="next-bar-${lesson.id}">
        ${isPassed ? `
          <div class="next-nav-unlocked">
            <div class="next-nav-info">
              <span class="next-nav-badge">✓ Lesson ${idx + 1} Requirements Complete</span>
              <strong>Mandatory quiz passed (${answeredCorrect}/${totalQuestions}). Next module is unlocked!</strong>
            </div>
            ${idx + 1 < lessons.length ? `
              <button type="button" class="button button-accent btn-proceed-next-lesson" data-current-idx="${idx}" data-next-idx="${idx + 1}">
                Proceed to Lesson ${idx + 2} <span>→</span>
              </button>
            ` : `
              <div class="course-completed-badge">🏆 All Track Lessons Completed!</div>
            `}
          </div>
        ` : `
          <div class="next-nav-locked">
            <div class="next-nav-info">
              <span class="next-nav-lock-icon">🔒</span>
              <div>
                <strong>Lesson ${idx + 2} is locked and hidden</strong>
                <p>Completing Lesson ${idx + 1} and scoring at least 70% on the mandatory quiz above is required to unlock Lesson ${idx + 2}.</p>
              </div>
            </div>
            <button type="button" class="button button-disabled btn-proceed-next-lesson" disabled title="Pass the mandatory quiz above to unlock">
              Next Lesson Locked 🔒
            </button>
          </div>
        `}
      </div>
    `;

    // 5. ASSEMBLE CARD (COMPLETED VS ACTIVE)
    if (isCompleted) {
      card.innerHTML = `
        <div class="lesson-card-header">
          <div class="lesson-card-info">
            <span class="lesson-num-badge">Lesson ${idx + 1} of ${lessons.length}</span>
            <h3 class="lesson-card-title">${lesson.name}</h3>
          </div>
          <div class="lesson-card-actions">
            ${isTutorMode ? `
              <div class="lesson-card-tutor-actions">
                <button type="button" class="btn-tutor-lesson-header" data-action="edit-lesson" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Edit lesson curriculum">
                  <span>✏️ Edit Lesson</span>
                </button>
                <button type="button" class="btn-tutor-lesson-header" data-action="add-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Add quiz question">
                  <span>🎯 + Add Question</span>
                </button>
                <button type="button" class="btn-tutor-lesson-header" data-action="upload-material" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Upload material">
                  <span>📁 + Add Extra Material</span>
                </button>
              </div>
            ` : ''}
            <span class="lesson-status-pill status-done">✓ Completed</span>
            <button type="button" class="btn-toggle-completed-review" data-target="review-body-${lesson.id}">
              <span>📖 Review Lesson Context & Quiz</span> <span class="review-caret">▾</span>
            </button>
          </div>
        </div>
        <p class="lesson-summary-text">
          ${lesson.summary || 'Examine enterprise architecture principles, configure compliance rules, and verify device behavior.'}
          <span style="display:inline-block;margin-left:8px;color:#75897c;font-size:12px;">⏱️ ${lesson.duration || '45 mins'}</span>
        </p>

        <!-- Collapsible Review Body for Completed Lessons -->
        <div class="completed-review-body" id="review-body-${lesson.id}" style="display:none;margin-top:14px;">
          ${quizProgressIndicatorHtml}
          ${lessonResourcesSectionHtml}
          ${lessonContextBoxHtml}
          ${mandatoryQuizBoxHtml}
        </div>
      `;
    } else {
      // Current active lesson
      card.innerHTML = `
        <div class="lesson-card-header">
          <div class="lesson-card-info">
            <span class="lesson-num-badge">Lesson ${idx + 1} of ${lessons.length}</span>
            <span class="lesson-active-tag">▶ Current Active Module</span>
            <h3 class="lesson-card-title">${lesson.name}</h3>
          </div>
          <div class="lesson-card-actions">
            ${isTutorMode ? `
              <div class="lesson-card-tutor-actions">
                <button type="button" class="btn-tutor-lesson-header" data-action="edit-lesson" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Edit lesson curriculum">
                  <span>✏️ Edit Lesson</span>
                </button>
                <button type="button" class="btn-tutor-lesson-header" data-action="add-question" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Add quiz question">
                  <span>🎯 + Add Question</span>
                </button>
                <button type="button" class="btn-tutor-lesson-header" data-action="upload-material" data-course-id="${currentCourseId}" data-lesson-id="${lesson.id}" title="Upload material">
                  <span>📁 + Add Extra Material</span>
                </button>
              </div>
            ` : ''}
            <span class="lesson-status-pill status-active">▶ In Progress</span>
          </div>
        </div>
        <p class="lesson-summary-text">
          ${lesson.summary || 'Examine enterprise architecture principles, configure compliance rules, and verify device behavior.'}
          <span style="display:inline-block;margin-left:8px;color:#75897c;font-size:12px;">⏱️ ${lesson.duration || '45 mins'}</span>
        </p>

        <!-- 1. Lesson Context Box -->
        ${lessonContextBoxHtml}

        <!-- 2. Resources Section (PDF Download Links) -->
        ${lessonResourcesSectionHtml}

        <!-- 3. Small Quiz Progress Indicator -->
        ${quizProgressIndicatorHtml}

        <!-- 4. Mandatory Quiz Box -->
        ${mandatoryQuizBoxHtml}

        <!-- 5. Next Lesson Navigation Bar -->
        ${nextNavBarHtml}
      `;
    }

    lessonsContainer.appendChild(card);

    // Provide an inline "+ Add Module / Lesson" row after EACH module for tutors
    if (isTutorMode) {
      const addAfterRow = document.createElement('div');
      addAfterRow.className = 'tutor-add-after-row';
      addAfterRow.innerHTML = `
        <button type="button" class="btn-tutor-add-after" data-action="add-after-lesson" data-course-id="${currentCourseId}" data-after-id="${lesson.id}" title="Add Supplemental Module after Lesson ${idx + 1}">
          <span class="add-plus-symbol" aria-hidden="true">+</span>
          <span>Add Module / Lesson After Lesson ${idx + 1}</span>
        </button>
      `;
      lessonsContainer.appendChild(addAfterRow);
    }
  });

  // Bottom action: add module at the end of this course track
  if (isTutorMode) {
    const bottomAddWrap = document.createElement('div');
    bottomAddWrap.style.cssText = 'text-align:center;padding:18px 0 8px;';
    bottomAddWrap.innerHTML = `
      <button type="button" class="button button-accent" data-action="add-track-module" data-course-id="${currentCourseId}" style="display:inline-flex;align-items:center;gap:8px;">
        <span style="font-size:16px;font-weight:800;">+</span>
        <span>Add Supplemental Module to ${currentCourse.name}</span>
      </button>
    `;
    lessonsContainer.appendChild(bottomAddWrap);
  }

  // Attach event handlers
  attachLessonEventListeners();
}

function attachLessonEventListeners() {
  // 1. Toggle Review Body for Completed Lessons
  lessonsContainer.querySelectorAll('.btn-toggle-completed-review').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const reviewEl = document.getElementById(targetId);
      if (!reviewEl) return;
      const isOpen = reviewEl.style.display !== 'none';
      reviewEl.style.display = isOpen ? 'none' : 'block';
      const caret = btn.querySelector('.review-caret');
      if (caret) caret.textContent = isOpen ? '▾' : '▴';
    });
  });

  // 2. Mark Context Studied Button
  lessonsContainer.querySelectorAll('.btn-mark-context-studied').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lessonId = btn.dataset.lessonId;
      const key = `uem_studied_${currentCourseId}_${lessonId}`;
      const isNowStudied = btn.classList.contains('studied');
      if (isNowStudied) {
        btn.classList.remove('studied');
        btn.innerHTML = '<span>Mark Context Studied ✓</span>';
        localStorage.removeItem(key);
        showToast('Lesson context marked for review.');
      } else {
        btn.classList.add('studied');
        btn.innerHTML = '<span>✓ Context Studied</span>';
        localStorage.setItem(key, 'true');
        showToast('✓ Lesson context verified & studied! Proceed to the mandatory quiz below.');
      }
    });
  });

  // 3. Copy Code Snippet Buttons
  lessonsContainer.querySelectorAll('.btn-copy-snippet').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = decodeURIComponent(btn.dataset.code || '');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          const original = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.textContent = original; }, 2200);
        });
      }
    });
  });

  // 3b. Module Resource PDF Preview Modal Trigger
  lessonsContainer.querySelectorAll('.btn-resource-preview').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = btn.dataset.url;
      const name = btn.dataset.name || 'Curriculum Resource';
      const lessonName = btn.dataset.lessonName || '';
      openDocumentPreview(url, name, 'application/pdf', 148000, currentCourse?.name, lessonName);
    });
  });

  // 4. Interactive Quiz Option Selection Highlighting
  lessonsContainer.querySelectorAll('.quiz-option-label').forEach((label) => {
    label.addEventListener('click', () => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio && radio.disabled) return;
      const card = label.closest('.quiz-question-card');
      if (card) {
        card.querySelectorAll('.quiz-option-label').forEach((lbl) => lbl.classList.remove('selected'));
        label.classList.add('selected');
      }
    });
  });

  // 5. Submit Quiz Answers & Instant Grading
  lessonsContainer.querySelectorAll('.btn-submit-quiz').forEach((submitBtn) => {
    submitBtn.addEventListener('click', async () => {
      const courseId = submitBtn.dataset.course;
      const lessonId = submitBtn.dataset.lesson;
      const drawer = document.getElementById(`quiz-${lessonId}`);
      if (!drawer) return;

      const questionCards = drawer.querySelectorAll('.quiz-question-card');
      const answers = {};
      let unanswered = 0;

      questionCards.forEach((qCard, idx) => {
        const checked = qCard.querySelector(`input[name="quiz_${lessonId}_${idx}"]:checked`);
        if (!checked) {
          unanswered++;
        } else {
          answers[idx] = Number(checked.value);
        }
      });

      if (unanswered > 0) {
        showToast(`⚠️ Please answer all ${questionCards.length} questions before submitting.`);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Grading Answers...';

      try {
        const resp = await fetch('/api/quiz/submit.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            course_id: courseId,
            lesson_id: lessonId,
            answers
          })
        });

        const raw = await resp.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

        if (!resp.ok || !data || !data.success) {
          throw new Error(data?.message || 'Failed to submit quiz.');
        }

        // Render results banner
        const banner = document.getElementById(`quiz-results-${lessonId}`);
        if (banner) {
          banner.style.display = 'flex';
          banner.className = `quiz-results-banner ${data.passed ? 'passed' : 'failed'}`;
          banner.innerHTML = `
            <strong>${data.passed ? '🎉 Mandatory Quiz Passed!' : '📖 Review Needed to Pass'} Score: ${data.percentage}% (${data.score}/${data.total})</strong>
            <p style="margin:0;font-size:13px;">${data.passed ? 'Mandatory requirement satisfied! Next lesson is unlocked.' : 'Passing score is 70%. Review the lesson context box above and retake the quiz to advance.'}</p>
          `;
        }

        // Highlight questions and show explanations
        (data.results || []).forEach((qRes, qIdx) => {
          const qCard = drawer.querySelector(`[data-qidx="${qIdx}"]`);
          if (!qCard) return;

          // Disable inputs
          qCard.querySelectorAll('input[type="radio"]').forEach((inp) => { inp.disabled = true; });

          // Style options
          qCard.querySelectorAll('.quiz-option-label').forEach((lbl) => {
            const optIdx = Number(lbl.dataset.optidx);
            lbl.classList.remove('selected', 'is-correct', 'is-wrong');
            if (optIdx === qRes.correctAnswer) {
              lbl.classList.add('is-correct');
            } else if (optIdx === qRes.selected && !qRes.isCorrect) {
              lbl.classList.add('is-wrong');
            }
          });

          // Show explanation
          const explBox = document.getElementById(`expl-${lessonId}-${qIdx}`);
          if (explBox) {
            explBox.style.display = 'block';
            explBox.innerHTML = `<strong>💡 Explanation:</strong> ${qRes.explanation}`;
          }
        });

        // Update local state and storage
        if (!candidateQuizProgress[courseId]) candidateQuizProgress[courseId] = {};
        candidateQuizProgress[courseId][lessonId] = {
          score: data.score,
          total: data.total,
          percentage: data.percentage,
          passed: data.passed,
          updatedAt: new Date().toISOString()
        };
        try {
          localStorage.setItem('uem_quiz_progress', JSON.stringify(candidateQuizProgress));
        } catch (e) {}

        // Dynamically update the lesson card's quiz progress indicator in real-time
        updateLessonQuizIndicator(lessonId, data.score, data.total, data.percentage, data.passed);

        // Notify dashboard of quiz score change
        if (progressChannel) {
          progressChannel.postMessage({
            type: 'QUIZ_UPDATED',
            courseId,
            lessonId,
            quizProgress: candidateQuizProgress[courseId]
          });
        }

        // Update UI state for Next Lesson
        submitBtn.style.display = 'none';

        const retakeBtn = drawer.querySelector('.btn-reset-quiz');
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';

        // Update the lesson card's status pill and next nav bar
        const statusPill = drawer.querySelector('.mandatory-quiz-status-pill');
        if (statusPill) {
          statusPill.className = `mandatory-quiz-status-pill ${data.passed ? 'is-passed' : 'is-pending'}`;
          statusPill.textContent = data.passed ? '✓ Passed (Requirement Met)' : '⚠️ Quiz Mandatory';
        }

        const nextBar = document.getElementById(`next-bar-${lessonId}`);
        const lessons = currentCourse?.lessons || [];
        const currentIdx = lessons.findIndex(l => l.id === lessonId);

        if (nextBar && data.passed) {
          nextBar.innerHTML = `
            <div class="next-nav-unlocked">
              <div class="next-nav-info">
                <span class="next-nav-badge">✓ Lesson ${currentIdx + 1} Requirements Complete</span>
                <strong>Mandatory quiz passed (${data.score}/${data.total}). Next module is unlocked!</strong>
              </div>
              ${currentIdx + 1 < lessons.length ? `
                <button type="button" class="button button-accent btn-proceed-next-lesson" data-current-idx="${currentIdx}" data-next-idx="${currentIdx + 1}">
                  Proceed to Lesson ${currentIdx + 2} <span>→</span>
                </button>
              ` : `
                <div class="course-completed-badge">🏆 All Track Lessons Completed!</div>
              `}
            </div>
          `;

          // Re-attach next button listener
          const newProceedBtn = nextBar.querySelector('.btn-proceed-next-lesson');
          if (newProceedBtn) {
            newProceedBtn.addEventListener('click', () => {
              advanceToNextLesson(currentIdx, currentIdx + 1);
            });
          }
        }

        updateProgressCard();

        showToast(data.passed
          ? '🎉 Awesome job! Mandatory quiz passed. Next lesson unlocked.'
          : 'Quiz completed. Check explanations above and retake to achieve 70%+ passing grade.');
      } catch (err) {
        showToast(err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Answers & Verify Grade <span>✓</span>';
      }
    });
  });

  // 6. Retake Quiz Handler
  lessonsContainer.querySelectorAll('.btn-reset-quiz').forEach((retakeBtn) => {
    retakeBtn.addEventListener('click', () => {
      const lessonId = retakeBtn.dataset.lesson;
      const drawer = document.getElementById(`quiz-${lessonId}`);
      if (!drawer) return;

      // Re-enable and uncheck all inputs
      drawer.querySelectorAll('input[type="radio"]').forEach((inp) => {
        inp.disabled = false;
        inp.checked = false;
      });

      // Clear styles and explanations
      drawer.querySelectorAll('.quiz-option-label').forEach((lbl) => {
        lbl.classList.remove('selected', 'is-correct', 'is-wrong');
      });
      drawer.querySelectorAll('.quiz-explanation-box').forEach((box) => {
        box.style.display = 'none';
        box.innerHTML = '';
      });

      // Hide results banner
      const banner = document.getElementById(`quiz-results-${lessonId}`);
      if (banner) {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }

      // Restore submit button, hide retake button
      const submitBtn = drawer.querySelector('.btn-submit-quiz');
      if (submitBtn) {
        submitBtn.style.display = 'inline-flex';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Answers & Verify Grade <span>✓</span>';
      }

      retakeBtn.style.display = 'none';
      showToast('Quiz reset. You can now choose your answers again.');
    });
  });

  // 7. Proceed to Next Lesson Button
  lessonsContainer.querySelectorAll('.btn-proceed-next-lesson:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentIdx = Number(btn.dataset.currentIdx);
      const nextIdx = Number(btn.dataset.nextIdx);
      advanceToNextLesson(currentIdx, nextIdx);
    });
  });

  // 7b. Tutor: Edit Lesson Modal Trigger
  lessonsContainer.querySelectorAll('[data-action="edit-lesson"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditLessonModal(btn.dataset.courseId || currentCourseId, btn.dataset.lessonId);
    });
  });

  // 7c. Tutor: Add Question Modal Trigger (top or inline)
  lessonsContainer.querySelectorAll('[data-action="add-question"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAddQuestionModal(btn.dataset.courseId || currentCourseId, btn.dataset.lessonId);
    });
  });

  // 7d. Tutor: Upload Material Modal Trigger
  lessonsContainer.querySelectorAll('[data-action="upload-material"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openUploadMaterialModal(btn.dataset.courseId || currentCourseId, btn.dataset.lessonId);
    });
  });

  // 7e. Tutor: Inline "+ Add Module / Lesson After" Trigger
  lessonsContainer.querySelectorAll('[data-action="add-after-lesson"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAddLessonModal(btn.dataset.courseId || currentCourseId, btn.dataset.afterId);
    });
  });

  // 7f. Tutor: Add Module to Track (bottom button)
  lessonsContainer.querySelectorAll('[data-action="add-track-module"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAddLessonModal(btn.dataset.courseId || currentCourseId);
    });
  });

  // 7g. Tutor: Delete Question Trigger
  lessonsContainer.querySelectorAll('.btn-delete-q-course').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Are you sure you want to delete this quiz question from the module?')) return;
      const courseId = btn.dataset.courseId || currentCourseId;
      const lessonId = btn.dataset.lessonId;
      const qid = btn.dataset.qid;
      try {
        const resp = await fetch('/api/tutor/lesson/delete-question.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ course_id: courseId, lesson_id: lessonId, question_id: qid })
        });
        const res = await resp.json();
        if (!resp.ok || !res.success) throw new Error(res.message || 'Failed to delete question');
        showToast('✓ Quiz question deleted.');
        await refreshCatalogAndRender();
      } catch (err) {
        showToast('Error deleting question: ' + err.message);
      }
    });
  });

  // 8. If a specific module was requested in the URL, scroll directly to it
  if (targetModuleId) {
    const targetEl = lessonsContainer.querySelector(`[data-lesson-id="${targetModuleId}"]`);
    if (targetEl) {
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }
}

// ========================================================
// TUTOR MODALS & CURRICULUM MANAGEMENT CONTROLLER
// ========================================================

async function refreshCatalogAndRender() {
  try {
    const catResp = await fetch('/api/courses-catalog.php');
    const catJson = await catResp.json();
    courseCatalog = catJson.catalog || courseCatalog;
    currentCourse = courseCatalog[currentCourseId] || currentCourse;

    // Refresh resources
    const resResp = await fetch(`/api/course-resources.php?course_id=${encodeURIComponent(currentCourseId)}`, {
      headers: getAuthHeaders()
    });
    const resJson = await resResp.json();
    courseResources = resJson.resources || [];

    renderCourseHero();
    renderLessonModules();
  } catch (err) {
    console.warn('Failed to refresh curriculum data:', err);
  }
}

// 1. Add Lesson Modal
const modalAddLesson = document.getElementById('modal-add-lesson');
const formAddLesson = document.getElementById('form-add-lesson');
const newLessonCourseId = document.getElementById('new-lesson-course-id');
const newLessonTargetCourse = document.getElementById('new-lesson-target-course');
const btnCloseAddLessonModal = document.getElementById('btn-close-add-lesson-modal');
const btnCancelAddLesson = document.getElementById('btn-cancel-add-lesson');

function openAddLessonModal(targetCourseId, afterLessonId) {
  const cId = (targetCourseId && targetCourseId !== 'all') ? targetCourseId : currentCourseId;
  const course = courseCatalog[cId] || currentCourse;
  if (!modalAddLesson) return;

  if (newLessonCourseId) newLessonCourseId.value = cId;
  if (newLessonTargetCourse) {
    const afterText = afterLessonId ? ` (inserting after ${afterLessonId})` : '';
    newLessonTargetCourse.textContent = `Target Track: ${course ? course.name : cId}${afterText}`;
  }

  // Pre-fill defaults
  const nextNum = (course?.lessons?.length || 0) + 1;
  const nameInp = document.getElementById('new-lesson-name');
  if (nameInp) nameInp.value = `Module ${nextNum}: Supplemental Advanced Lab`;

  modalAddLesson.style.display = 'grid';
  modalAddLesson.setAttribute('aria-hidden', 'false');
}

function closeAddLessonModal() {
  if (!modalAddLesson) return;
  modalAddLesson.style.display = 'none';
  modalAddLesson.setAttribute('aria-hidden', 'true');
  if (formAddLesson) formAddLesson.reset();
}

if (btnCloseAddLessonModal) btnCloseAddLessonModal.addEventListener('click', closeAddLessonModal);
if (btnCancelAddLesson) btnCancelAddLesson.addEventListener('click', closeAddLessonModal);
if (modalAddLesson) {
  modalAddLesson.addEventListener('click', (e) => {
    if (e.target === modalAddLesson) closeAddLessonModal();
  });
}

if (formAddLesson) {
  formAddLesson.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formAddLesson.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving Module...'; }

    try {
      const cId = newLessonCourseId?.value || currentCourseId;
      const name = document.getElementById('new-lesson-name')?.value;
      const duration = document.getElementById('new-lesson-duration')?.value;
      const summary = document.getElementById('new-lesson-summary')?.value;
      const overview = document.getElementById('new-lesson-overview')?.value;

      const resp = await fetch('/api/tutor/lesson/add-lesson.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          course_id: cId,
          name,
          duration,
          summary,
          overview
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Failed to add lesson');

      closeAddLessonModal();
      showToast(`✓ Module "${name}" added to curriculum!`);
      await refreshCatalogAndRender();

      // Scroll to new lesson
      setTimeout(() => {
        const lastCard = lessonsContainer?.lastElementChild;
        if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  });
}

// 2. Add Question Modal
const modalAddQuestion = document.getElementById('modal-add-question');
const formAddQuestion = document.getElementById('form-add-question');
const questionCourseId = document.getElementById('question-course-id');
const questionLessonId = document.getElementById('question-lesson-id');
const questionModalHeading = document.getElementById('question-modal-heading');
const questionModalSubheading = document.getElementById('question-modal-subheading');
const btnCloseQuestionModal = document.getElementById('btn-close-question-modal');
const btnCancelAddQuestion = document.getElementById('btn-cancel-add-question');

function openAddQuestionModal(courseId, lessonId) {
  if (!modalAddQuestion) return;
  const cId = courseId || currentCourseId;
  const course = courseCatalog[cId] || currentCourse;
  const lesson = course?.lessons?.find(l => l.id === lessonId);

  if (questionCourseId) questionCourseId.value = cId;
  if (questionLessonId) questionLessonId.value = lessonId;

  if (questionModalSubheading) {
    questionModalSubheading.textContent = `${course?.name || cId} → ${lesson?.name || lessonId}`;
  }

  modalAddQuestion.style.display = 'grid';
  modalAddQuestion.setAttribute('aria-hidden', 'false');
}

function closeAddQuestionModal() {
  if (!modalAddQuestion) return;
  modalAddQuestion.style.display = 'none';
  modalAddQuestion.setAttribute('aria-hidden', 'true');
  if (formAddQuestion) formAddQuestion.reset();
}

if (btnCloseQuestionModal) btnCloseQuestionModal.addEventListener('click', closeAddQuestionModal);
if (btnCancelAddQuestion) btnCancelAddQuestion.addEventListener('click', closeAddQuestionModal);
if (modalAddQuestion) {
  modalAddQuestion.addEventListener('click', (e) => {
    if (e.target === modalAddQuestion) closeAddQuestionModal();
  });
}

if (formAddQuestion) {
  formAddQuestion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formAddQuestion.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving Question...'; }

    try {
      const cId = questionCourseId?.value || currentCourseId;
      const lId = questionLessonId?.value;
      const question = document.getElementById('question-text')?.value;
      const opts = [
        document.getElementById('q-opt-0')?.value,
        document.getElementById('q-opt-1')?.value,
        document.getElementById('q-opt-2')?.value,
        document.getElementById('q-opt-3')?.value
      ].filter(Boolean);

      const answer = document.getElementById('question-correct-answer')?.value || '0';
      const explanation = document.getElementById('question-explanation')?.value;

      const resp = await fetch('/api/tutor/lesson/add-question.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          course_id: cId,
          lesson_id: lId,
          question,
          options: opts,
          answer: Number(answer),
          explanation
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Failed to add question');

      closeAddQuestionModal();
      showToast('✓ Question successfully added to module quiz!');
      await refreshCatalogAndRender();
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  });
}

// 3. Edit Lesson Modal
const modalEditLesson = document.getElementById('modal-edit-lesson');
const formEditLesson = document.getElementById('form-edit-lesson');
const editCourseId = document.getElementById('edit-course-id');
const editLessonId = document.getElementById('edit-lesson-id');
const editLessonName = document.getElementById('edit-lesson-name');
const editLessonDuration = document.getElementById('edit-lesson-duration');
const editLessonSummary = document.getElementById('edit-lesson-summary');
const editLessonOverview = document.getElementById('edit-lesson-overview');
const editLessonTopics = document.getElementById('edit-lesson-topics');
const editLessonLabSteps = document.getElementById('edit-lesson-lab-steps');
const editLessonConfigs = document.getElementById('edit-lesson-configs');
const editLessonTakeaways = document.getElementById('edit-lesson-takeaways');
const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
const btnCancelEditLesson = document.getElementById('btn-cancel-edit-lesson');

function openEditLessonModal(courseId, lessonId) {
  if (!modalEditLesson) return;
  const cId = courseId || currentCourseId;
  const course = courseCatalog[cId] || currentCourse;
  const lesson = course?.lessons?.find(l => l.id === lessonId);
  if (!lesson) {
    showToast('Lesson module not found');
    return;
  }

  const details = lesson.details || {};

  if (editCourseId) editCourseId.value = cId;
  if (editLessonId) editLessonId.value = lesson.id;
  if (editLessonName) editLessonName.value = lesson.name || '';
  if (editLessonDuration) editLessonDuration.value = lesson.duration || '45 mins';
  if (editLessonSummary) editLessonSummary.value = lesson.summary || '';
  if (editLessonOverview) editLessonOverview.value = details.overview || lesson.summary || '';
  if (editLessonTopics) editLessonTopics.value = Array.isArray(details.topics) ? details.topics.join('\n') : '';
  if (editLessonLabSteps) editLessonLabSteps.value = Array.isArray(details.lab_guide) ? details.lab_guide.join('\n') : '';
  if (editLessonConfigs) editLessonConfigs.value = details.commands_configs || '';
  if (editLessonTakeaways) editLessonTakeaways.value = Array.isArray(details.key_takeaways) ? details.key_takeaways.join('\n') : '';

  modalEditLesson.style.display = 'grid';
  modalEditLesson.setAttribute('aria-hidden', 'false');
}

function closeEditLessonModal() {
  if (!modalEditLesson) return;
  modalEditLesson.style.display = 'none';
  modalEditLesson.setAttribute('aria-hidden', 'true');
}

if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditLessonModal);
if (btnCancelEditLesson) btnCancelEditLesson.addEventListener('click', closeEditLessonModal);
if (modalEditLesson) {
  modalEditLesson.addEventListener('click', (e) => {
    if (e.target === modalEditLesson) closeEditLessonModal();
  });
}

if (formEditLesson) {
  formEditLesson.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formEditLesson.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving Changes...'; }

    try {
      const cId = editCourseId?.value || currentCourseId;
      const lId = editLessonId?.value;

      const payload = {
        course_id: cId,
        lesson_id: lId,
        name: editLessonName?.value,
        duration: editLessonDuration?.value,
        summary: editLessonSummary?.value,
        overview: editLessonOverview?.value,
        topics: editLessonTopics?.value.split('\n').map(s => s.trim()).filter(Boolean),
        lab_steps: editLessonLabSteps?.value.split('\n').map(s => s.trim()).filter(Boolean),
        commands_configs: editLessonConfigs?.value,
        key_takeaways: editLessonTakeaways?.value.split('\n').map(s => s.trim()).filter(Boolean)
      };

      const resp = await fetch('/api/tutor/lesson/update.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Failed to update lesson');

      closeEditLessonModal();
      showToast(`✓ Lesson "${payload.name}" updated successfully!`);
      await refreshCatalogAndRender();
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  });
}

// 4. Upload Material Modal
const modalUploadMaterial = document.getElementById('modal-upload-material');
const formUploadMaterial = document.getElementById('form-upload-material');
const modalUploadCourseId = document.getElementById('modal-upload-course-id');
const modalUploadCourseName = document.getElementById('modal-upload-course-name');
const modalUploadLessonId = document.getElementById('modal-upload-lesson-id');
const modalUploadLessonName = document.getElementById('modal-upload-lesson-name');
const uploadModalSubheading = document.getElementById('upload-modal-subheading');
const modalUploadResult = document.getElementById('modal-upload-result');
const btnCloseUploadModal = document.getElementById('btn-close-upload-modal');
const btnCancelUploadMaterial = document.getElementById('btn-cancel-upload-material');

function openUploadMaterialModal(courseId, lessonId) {
  if (!modalUploadMaterial) return;
  const cId = courseId || currentCourseId;
  const course = courseCatalog[cId] || currentCourse;
  const lesson = course?.lessons?.find(l => l.id === lessonId);

  if (modalUploadCourseId) modalUploadCourseId.value = cId;
  if (modalUploadCourseName) modalUploadCourseName.value = course?.name || cId;
  if (modalUploadLessonId) modalUploadLessonId.value = lessonId;
  if (modalUploadLessonName) modalUploadLessonName.value = lesson?.name || lessonId;

  if (uploadModalSubheading) {
    uploadModalSubheading.textContent = `Target: ${course?.name || cId} → ${lesson?.name || lessonId}`;
  }
  if (modalUploadResult) modalUploadResult.innerHTML = '';

  modalUploadMaterial.style.display = 'grid';
  modalUploadMaterial.setAttribute('aria-hidden', 'false');
}

function closeUploadMaterialModal() {
  if (!modalUploadMaterial) return;
  modalUploadMaterial.style.display = 'none';
  modalUploadMaterial.setAttribute('aria-hidden', 'true');
  if (formUploadMaterial) formUploadMaterial.reset();
}

if (btnCloseUploadModal) btnCloseUploadModal.addEventListener('click', closeUploadMaterialModal);
if (btnCancelUploadMaterial) btnCancelUploadMaterial.addEventListener('click', closeUploadMaterialModal);
if (modalUploadMaterial) {
  modalUploadMaterial.addEventListener('click', (e) => {
    if (e.target === modalUploadMaterial) closeUploadMaterialModal();
  });
}

if (formUploadMaterial) {
  formUploadMaterial.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formUploadMaterial.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    try {
      const fileInput = document.getElementById('modal-upload-file-input');
      if (!fileInput?.files?.length) {
        throw new Error('Please select a file to upload.');
      }

      const formData = new FormData(formUploadMaterial);
      const resp = await fetch('/api/tutor-upload.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Upload failed');

      closeUploadMaterialModal();
      showToast(`✓ Uploaded "${data.file?.name || 'File'}" to lesson!`);
      await refreshCatalogAndRender();
    } catch (err) {
      if (modalUploadResult) {
        modalUploadResult.innerHTML = `<span style="color:#c53030;">Error: ${err.message}</span>`;
      }
      showToast('Upload error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  });
}

// 5. Track Filter Buttons & Switch Track
function attachTrackFilterListeners() {
  const filterBtns = document.querySelectorAll('.course-filter-btn[data-tutor-track]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const addBadge = e.target.closest('.filter-btn-add');
      const trackId = btn.dataset.tutorTrack;
      if (addBadge || e.target.dataset.addTrack) {
        e.stopPropagation();
        e.preventDefault();
        openAddLessonModal(trackId === 'all' ? currentCourseId : trackId);
        return;
      }

      if (trackId === 'all') {
        window.location.href = 'tutor-dashboard.html';
        return;
      }

      switchTrack(trackId);
    });
  });

  if (btnCourseAddTrackDirect) {
    btnCourseAddTrackDirect.addEventListener('click', () => {
      openAddLessonModal(currentCourseId);
    });
  }

  if (btnCourseAddModuleHeader) {
    btnCourseAddModuleHeader.addEventListener('click', () => {
      openAddLessonModal(currentCourseId);
    });
  }

  if (btnToggleTutorMode) {
    btnToggleTutorMode.addEventListener('click', () => {
      isTutorMode = !isTutorMode;
      sessionStorage.setItem('uem_tutor_mode', isTutorMode ? 'true' : 'false');
      updateTutorModeUI();
      renderCourseHero();
      renderLessonModules();
      showToast(isTutorMode ? '👨‍🏫 Tutor Mode Enabled: All lessons unlocked with + Add controls.' : 'Candidate View Enabled: Sequential gating active.');
    });
  }
}

async function switchTrack(trackId) {
  if (!courseCatalog[trackId]) return;
  currentCourseId = trackId;
  currentCourse = courseCatalog[trackId];

  // Update URL without full page reload
  const newUrl = `${window.location.pathname}?course=${encodeURIComponent(trackId)}${isTutorMode ? '&tutor=1' : ''}`;
  window.history.pushState({ course: trackId }, '', newUrl);

  // Sync active track button
  document.querySelectorAll('.course-filter-btn[data-tutor-track]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tutorTrack === trackId);
  });

  // Fetch uploads for new track
  try {
    const resResp = await fetch(`/api/course-resources.php?course_id=${encodeURIComponent(currentCourseId)}`, {
      headers: getAuthHeaders()
    });
    const resJson = await resResp.json();
    courseResources = resJson.resources || [];
  } catch (e) {}

  renderCourseHero();
  renderLessonModules();
}


// 9. Reset Course Track to Lesson 1 Handler
const resetCourseBtn = document.getElementById('reset-course-btn');
if (resetCourseBtn) {
  resetCourseBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset this track to Lesson 1? This will restart the sequential curriculum from Lesson 1.')) {
      return;
    }

    try {
      const resp = await fetch('/api/progress/reset.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ courseId: currentCourseId })
      });
      const data = await resp.json();
      if (data && data.success) {
        candidateProgress = data.progress || {};
        if (data.quizProgress) {
          candidateQuizProgress = data.quizProgress;
        } else if (candidateQuizProgress[currentCourseId]) {
          candidateQuizProgress[currentCourseId] = {};
        }
        try {
          localStorage.setItem('uem_quiz_progress', JSON.stringify(candidateQuizProgress));
        } catch (_) {}

        // Clear studied tags
        for (let i = 1; i <= 10; i++) {
          localStorage.removeItem(`uem_studied_${currentCourseId}_module-${i}`);
        }

        if (progressChannel) {
          progressChannel.postMessage({
            type: 'PROGRESS_UPDATED',
            courseId: currentCourseId,
            progress: candidateProgress
          });
        }

        updateProgressCard();
        renderLessonModules();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✓ Track reset to Lesson 1. Sequential unlock is ready!');
      }
    } catch (err) {
      showToast('Could not reset track: ' + err.message);
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initializeCoursePage();
});
