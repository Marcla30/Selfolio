const eyeSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeOffSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePrivacyMode() {
  appState.privacyMode = !appState.privacyMode;
  document.body.classList.toggle('privacy-mode', appState.privacyMode);
  localStorage.setItem('privacyMode', appState.privacyMode);
  const btn = document.getElementById('privacyBtn');
  if (btn) {
    btn.innerHTML = appState.privacyMode ? eyeOffSVG : eyeSVG;
    btn.classList.toggle('active', appState.privacyMode);
    btn.title = appState.privacyMode ? 'Afficher les montants' : 'Masquer les montants';
  }
  // Redraw chart Y-axis labels without fetching new data
  if (typeof dashboardController !== 'undefined' && dashboardController.chartInstance) {
    dashboardController.chartInstance.update();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await appState.init();
  updateNavbar();
  setupMobileMenu();
  render();
  registerServiceWorker();
});

function setupMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navbar = document.getElementById('navbar');
  const overlay = document.getElementById('mobileOverlay');
  const navLinks = document.querySelectorAll('#navLinks a');
  
  menuBtn.addEventListener('click', () => {
    navbar.classList.toggle('open');
    overlay.classList.toggle('active');
    menuBtn.classList.toggle('hidden');
  });
  
  overlay.addEventListener('click', () => {
    navbar.classList.remove('open');
    overlay.classList.remove('active');
    menuBtn.classList.remove('hidden');
  });
  
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navbar.classList.remove('open');
      overlay.classList.remove('active');
      menuBtn.classList.remove('hidden');
    });
  });
  
  // Swipe gesture
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    if (touchEndX - touchStartX > 100 && touchStartX < 50) {
      navbar.classList.add('open');
      overlay.classList.add('active');
      menuBtn.classList.add('hidden');
    } else if (touchStartX - touchEndX > 100) {
      navbar.classList.remove('open');
      overlay.classList.remove('active');
      menuBtn.classList.remove('hidden');
    }
  }
}

function updateNavbar() {
  const navbar = document.getElementById('navbar');
  const menuBtn = document.getElementById('mobileMenuBtn');
  
  if (!navbar || location.pathname === '/login') {
    if (navbar) navbar.style.display = 'none';
    if (menuBtn) menuBtn.style.display = 'none';
    return;
  }
  
  navbar.style.display = 'flex';
  if (menuBtn && window.innerWidth <= 768) menuBtn.style.display = 'flex';
  
  const links = document.querySelectorAll('#navLinks a');
  links[0].textContent = appState.t('nav.dashboard');
  links[1].textContent = appState.t('nav.positions');
  links[2].textContent = appState.t('nav.stats');
  links[3].textContent = appState.t('nav.add');
  links[4].textContent = appState.t('nav.settings');
  
  // Add privacy button if not exists
  if (!document.getElementById('privacyBtn')) {
    const privacyBtn = document.createElement('button');
    privacyBtn.id = 'privacyBtn';
    privacyBtn.className = 'nav-privacy' + (appState.privacyMode ? ' active' : '');
    privacyBtn.title = appState.privacyMode ? 'Afficher les montants' : 'Masquer les montants';
    privacyBtn.innerHTML = appState.privacyMode ? eyeOffSVG : eyeSVG;
    privacyBtn.addEventListener('click', togglePrivacyMode);
    document.querySelector('.nav-links').appendChild(privacyBtn);
  }

  // Add logout button if not exists
  if (!document.getElementById('logoutBtn')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'nav-logout';
    logoutBtn.onclick = async () => {
      document.getElementById('navbar')?.classList.remove('open');
      document.getElementById('mobileOverlay')?.classList.remove('active');
      document.getElementById('mobileMenuBtn')?.classList.remove('hidden');
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('user');
      api.clearCsrfToken(); // Clear CSRF token after logout
      navigate('/login');
    };
    document.querySelector('.nav-links').appendChild(logoutBtn);
  }
  
  const currentPath = window.location.pathname;
  links.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === currentPath || 
        (currentPath === '/' && link.getAttribute('href') === '/')) {
      link.classList.add('active');
    }
  });
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const vapidKey = await api.notifications.getVapidKey();
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.publicKey
      });
      
      await api.notifications.subscribe(subscription);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}
