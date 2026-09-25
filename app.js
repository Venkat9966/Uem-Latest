const modal = document.querySelector('#modal');
const title = document.querySelector('#modal-title');
const copy = document.querySelector('#modal-copy');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const form = document.querySelector('#auth-form');

function redirectToRoleDashboard(role, token) {
  const targetPage = role === 'candidate' ? 'dashboard.html' : 'tutor-dashboard.html';
  if (token) {
    window.location.href = `${targetPage}?token=${encodeURIComponent(token)}`;
  } else {
    window.location.href = targetPage;
  }
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
        credentials: 'same-origin',
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
        if (result.token) {
          sessionStorage.setItem('uem_auth_token', result.token);
          localStorage.setItem('uem_auth_token', result.token);
        }
        if (result.user) {
          sessionStorage.setItem('uem_user', JSON.stringify(result.user));
          localStorage.setItem('uem_user', JSON.stringify(result.user));
        }

        if (result.must_reset_password) {
          showFormMessage('Temporary password accepted. Please set a new password.', false);
          setTimeout(() => {
            closeModal();
            window.location.href = 'set-password.html';
          }, 600);
          return;
        }

        showFormMessage('Login successful. Redirecting...', false);
        const targetRole = (result.user && result.user.role) || role;
        setTimeout(() => {
          closeModal();
          redirectToRoleDashboard(targetRole, result.token);
        }, 400);
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

// Check if user is already authenticated
function checkLoggedInState() {
  const cachedUserRaw = sessionStorage.getItem('uem_user') || localStorage.getItem('uem_user');
  if (cachedUserRaw) {
    try {
      const u = JSON.parse(cachedUserRaw);
      if (u && u.name) {
        const loginBtn = document.querySelector('[data-action="login"]');
        if (loginBtn) {
          loginBtn.textContent = 'My Dashboard ↗';
          loginBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = u.role === 'candidate' ? 'dashboard.html' : 'tutor-dashboard.html';
          };
        }
      }
    } catch (e) {}
  }
}
checkLoggedInState();

// Handle login=required URL parameter gracefully
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'required') {
    setTimeout(() => {
      openModal('login');
      showFormMessage('Please log in with your credentials to access your dashboard.', true);
    }, 300);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
} catch (e) {}

// Course category filter buttons, search input and sorting controls
const courseFilterBtns = document.querySelectorAll('.course-filter-btn');
const courseGrid = document.querySelector('.course-grid');
const courseSortSelect = document.getElementById('course-sort-select');
const courseSearchInput = document.getElementById('course-search-input');
const courseSearchClear = document.getElementById('course-search-clear');
const courseSearchMeta = document.getElementById('course-search-meta');
const courseEmptyState = document.getElementById('course-empty-state');
const courseEmptyQuery = document.getElementById('course-empty-query');
const courseSearchResetBtn = document.getElementById('course-search-reset-btn');

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCourseRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Record initial order of course cards and cache original titles & descriptions for clean text restoration
const originalCourseCardContent = new Map();
if (courseGrid) {
  Array.from(courseGrid.querySelectorAll('.course-card')).forEach((card, index) => {
    card.dataset.initialOrder = index;
    const h3 = card.querySelector('h3');
    const p = card.querySelector('.course-body p');
    originalCourseCardContent.set(card, {
      title: h3 ? h3.textContent.trim() : (card.dataset.title || ''),
      desc: p ? p.textContent.trim() : (card.dataset.description || '')
    });
  });
}

let currentCategoryFilter = 'all';
let currentSearchQuery = '';

function getCategoryDisplayName(cat) {
  const names = {
    all: 'All Courses',
    soti: 'SOTI',
    ivanti: 'Ivanti',
    rugged: 'Rugged Devices',
    android: 'Android Enterprise',
    workspaceone: 'Workspace ONE',
    intune: 'Intune'
  };
  return names[cat] || cat;
}

function filterCourses(category) {
  if (typeof category === 'string') {
    currentCategoryFilter = category;
    courseFilterBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === category);
    });
  }

  if (courseSearchInput) {
    currentSearchQuery = courseSearchInput.value.trim();
  }

  const query = currentSearchQuery.toLowerCase();
  const cards = courseGrid ? Array.from(courseGrid.querySelectorAll('.course-card')) : [];
  let visibleCount = 0;

  // Toggle clear button inside search input
  if (courseSearchClear) {
    courseSearchClear.style.display = query.length > 0 ? 'grid' : 'none';
  }

  cards.forEach((card) => {
    const original = originalCourseCardContent.get(card) || {
      title: card.dataset.title || '',
      desc: card.dataset.description || ''
    };
    const titleLower = original.title.toLowerCase();
    const descLower = original.desc.toLowerCase();
    const cardCategory = card.dataset.category || '';

    const matchesCategory = (currentCategoryFilter === 'all' || cardCategory === currentCategoryFilter);
    const matchesTitle = query ? titleLower.includes(query) : true;
    const matchesDesc = query ? descLower.includes(query) : true;
    const matchesSearch = !query || matchesTitle || matchesDesc;

    const isVisible = matchesCategory && matchesSearch;

    const h3 = card.querySelector('h3');
    const p = card.querySelector('.course-body p');

    if (isVisible) {
      card.style.display = '';
      visibleCount++;

      // Highlight matched search terms in title and description
      if (query) {
        const regex = new RegExp(`(${escapeCourseRegExp(currentSearchQuery)})`, 'gi');
        if (h3) {
          h3.innerHTML = matchesTitle
            ? original.title.replace(regex, '<mark class="course-highlight">$1</mark>')
            : escapeHTML(original.title);
        }
        if (p) {
          p.innerHTML = matchesDesc
            ? original.desc.replace(regex, '<mark class="course-highlight">$1</mark>')
            : escapeHTML(original.desc);
        }
      } else {
        if (h3) h3.textContent = original.title;
        if (p) p.textContent = original.desc;
      }
    } else {
      card.style.display = 'none';
      if (h3) h3.textContent = original.title;
      if (p) p.textContent = original.desc;
    }
  });

  // Empty state handling
  if (courseEmptyState) {
    if (visibleCount === 0) {
      courseEmptyState.style.display = 'flex';
      if (courseEmptyQuery) {
        courseEmptyQuery.textContent = currentSearchQuery || (currentCategoryFilter !== 'all' ? getCategoryDisplayName(currentCategoryFilter) : 'your criteria');
      }
    } else {
      courseEmptyState.style.display = 'none';
    }
  }

  // Search results meta bar
  if (courseSearchMeta) {
    if (query) {
      courseSearchMeta.style.display = 'flex';
      const catLabel = currentCategoryFilter !== 'all'
        ? ` in <strong>${getCategoryDisplayName(currentCategoryFilter)}</strong>`
        : '';
      courseSearchMeta.innerHTML = `
        <div>Showing <strong>${visibleCount}</strong> course${visibleCount === 1 ? '' : 's'} matching <mark>"${escapeHTML(currentSearchQuery)}"</mark>${catLabel}</div>
        <button type="button" class="course-clear-inline-btn" id="course-clear-inline-btn">Clear search</button>
      `;
      const inlineClear = document.getElementById('course-clear-inline-btn');
      if (inlineClear) {
        inlineClear.addEventListener('click', clearCourseSearch);
      }
    } else {
      courseSearchMeta.style.display = 'none';
      courseSearchMeta.innerHTML = '';
    }
  }
}

function clearCourseSearch() {
  if (courseSearchInput) {
    courseSearchInput.value = '';
    courseSearchInput.focus();
  }
  currentSearchQuery = '';
  filterCourses();
}

function resetCoursesFilterAndSearch() {
  if (courseSearchInput) {
    courseSearchInput.value = '';
  }
  currentSearchQuery = '';
  filterCourses('all');
}

function sortCourses(sortMode) {
  if (!courseGrid) return;
  const cards = Array.from(courseGrid.querySelectorAll('.course-card'));

  cards.sort((a, b) => {
    if (sortMode === 'alpha-asc') {
      const titleA = (a.dataset.title || '').trim().toLowerCase();
      const titleB = (b.dataset.title || '').trim().toLowerCase();
      return titleA.localeCompare(titleB);
    }
    if (sortMode === 'alpha-desc') {
      const titleA = (a.dataset.title || '').trim().toLowerCase();
      const titleB = (b.dataset.title || '').trim().toLowerCase();
      return titleB.localeCompare(titleA);
    }
    if (sortMode === 'rating-desc') {
      const ratingA = parseFloat(a.dataset.rating) || 0;
      const ratingB = parseFloat(b.dataset.rating) || 0;
      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }
      const titleA = (a.dataset.title || '').trim().toLowerCase();
      const titleB = (b.dataset.title || '').trim().toLowerCase();
      return titleA.localeCompare(titleB);
    }
    // Default curated order
    const orderA = parseInt(a.dataset.initialOrder, 10) || 0;
    const orderB = parseInt(b.dataset.initialOrder, 10) || 0;
    return orderA - orderB;
  });

  // Re-append sorted cards in order
  cards.forEach((card) => courseGrid.appendChild(card));
  if (courseEmptyState) {
    courseGrid.appendChild(courseEmptyState);
  }
}

// Category filter button listeners
courseFilterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterCourses(btn.dataset.filter);
  });
});

// Search input event listeners
if (courseSearchInput) {
  courseSearchInput.addEventListener('input', () => {
    filterCourses();
  });
  courseSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && courseSearchInput.value) {
      clearCourseSearch();
    }
  });
  courseSearchInput.addEventListener('search', () => {
    filterCourses();
  });
}

if (courseSearchClear) {
  courseSearchClear.addEventListener('click', clearCourseSearch);
}

if (courseSearchResetBtn) {
  courseSearchResetBtn.addEventListener('click', resetCoursesFilterAndSearch);
}

if (courseSortSelect) {
  courseSortSelect.addEventListener('change', (e) => {
    sortCourses(e.target.value);
  });
}

const allCoursesLinks = document.querySelectorAll('a[href="#courses"]');
allCoursesLinks.forEach((link) => {
  link.addEventListener('click', () => {
    resetCoursesFilterAndSearch();
  });
});

// Quick demo autofill buttons
const demoFillButtons = document.querySelectorAll('.demo-fill-btn');
demoFillButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!form) return;

    // Ensure we are in login mode
    form.dataset.mode = 'login';
    setModalMode('login');

    const emailField = form.querySelector('[name="email"]');
    const pwdField = form.querySelector('[name="password"]');
    const roleField = form.querySelector('[name="role"]');

    if (emailField) emailField.value = btn.dataset.email || '';
    if (pwdField) pwdField.value = btn.dataset.pwd || '';
    if (roleField) roleField.value = btn.dataset.role || 'candidate';

    const err = form.querySelector('.auth-error');
    if (err) err.remove();
  });
});

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

// Interactive FAQ Accordion: allow clean single-expanded behavior
const faqAccordion = document.querySelector('.faq-accordion');
const faqItems = document.querySelectorAll('.faq-accordion details');
const searchInput = document.getElementById('faq-search-input');
const searchClearBtn = document.getElementById('faq-search-clear');
const searchMeta = document.getElementById('faq-search-meta');
const emptyState = document.getElementById('faq-empty-state');
const resetFilterBtn = document.getElementById('faq-reset-filter');

// Cache original question HTML so highlights can be restored cleanly
const originalQuestionTexts = new Map();
faqItems.forEach((item, index) => {
  const qEl = item.querySelector('.faq-question');
  if (qEl) {
    originalQuestionTexts.set(item, qEl.textContent.trim());
  }
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterFAQ() {
  if (!searchInput) return;

  const query = searchInput.value.trim();
  const lowerQuery = query.toLowerCase();
  let matchCount = 0;

  // Toggle clear button visibility
  if (searchClearBtn) {
    searchClearBtn.style.display = query.length > 0 ? 'grid' : 'none';
  }

  faqItems.forEach((item) => {
    const originalText = originalQuestionTexts.get(item) || '';
    const qEl = item.querySelector('.faq-question');
    const badgeEl = item.querySelector('.faq-badge');
    const badgeText = badgeEl ? badgeEl.textContent.trim().toLowerCase() : '';
    const contentEl = item.querySelector('.faq-content');
    const contentText = contentEl ? contentEl.textContent.trim().toLowerCase() : '';

    if (!lowerQuery) {
      // No filter: restore original text and show item
      item.style.display = '';
      if (qEl) qEl.textContent = originalText;
      matchCount++;
      return;
    }

    const matchesQuestion = originalText.toLowerCase().includes(lowerQuery);
    const matchesBadge = badgeText.includes(lowerQuery);
    const matchesContent = contentText.includes(lowerQuery);
    const isMatch = matchesQuestion || matchesBadge || matchesContent;

    if (isMatch) {
      item.style.display = '';
      matchCount++;
      // Auto-open matching item when searching for easy reading
      item.setAttribute('open', '');

      // Highlight matched text in question title if match occurs there
      if (qEl) {
        if (matchesQuestion) {
          const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
          qEl.innerHTML = originalText.replace(regex, '<mark class="faq-highlight">$1</mark>');
        } else {
          qEl.textContent = originalText;
        }
      }
    } else {
      item.style.display = 'none';
      item.removeAttribute('open');
      if (qEl) qEl.textContent = originalText;
    }
  });

  // Update empty state and metadata message
  if (emptyState) {
    emptyState.style.display = matchCount === 0 ? 'block' : 'none';
  }

  if (searchMeta) {
    if (!query) {
      searchMeta.innerHTML = 'Showing all <strong>' + faqItems.length + '</strong> questions';
    } else if (matchCount === 0) {
      searchMeta.innerHTML = `No results found for "<em>${query}</em>"`;
    } else {
      searchMeta.innerHTML = `Found <strong>${matchCount}</strong> ${matchCount === 1 ? 'question' : 'questions'} matching "<em>${query}</em>"`;
    }
  }
}

if (searchInput) {
  searchInput.addEventListener('input', filterFAQ);
}

if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
      filterFAQ();
    }
  });
}

if (resetFilterBtn) {
  resetFilterBtn.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
      filterFAQ();
    }
  });
}

// Single-expanded accordion behavior with smooth closing transitions
faqItems.forEach((detail) => {
  const summary = detail.querySelector('.faq-trigger');
  if (!summary) return;

  summary.addEventListener('click', (e) => {
    // If user is clicking to close an already open item, animate it closed gracefully
    if (detail.open) {
      e.preventDefault();
      detail.classList.add('is-closing');
      setTimeout(() => {
        detail.removeAttribute('open');
        detail.classList.remove('is-closing');
      }, 290);
      return;
    }

    // If opening, close other items smoothly if not actively searching
    const isSearching = searchInput && searchInput.value.trim().length > 0;
    if (!isSearching) {
      faqItems.forEach((other) => {
        if (other !== detail && other.open) {
          other.classList.add('is-closing');
          setTimeout(() => {
            other.removeAttribute('open');
            other.classList.remove('is-closing');
          }, 290);
        }
      });
    }
  });
});



