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
