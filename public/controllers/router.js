const routes = {
  '/': dashboardController,
  '/login': loginController,
  '/stats': statsController,
  '/positions': positionsController,
  '/add': addController,
  '/settings': settingsController
};

async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) {
      if (location.pathname !== '/login') {
        navigate('/login');
      }
      return false;
    }
    return true;
  } catch (error) {
    if (location.pathname !== '/login') {
      navigate('/login');
    }
    return false;
  }
}

function navigate(path) {
  history.pushState(null, null, path);
  window.scrollTo(0, 0);
  render();
  if (path !== '/login') {
    updateNavbar();
  }
}

async function render() {
  // Clean up tooltip from previous page
  const oldTooltip = document.getElementById('customTooltip');
  if (oldTooltip) oldTooltip.remove();

  const path = location.pathname;
  document.body.classList.toggle('login-page', path === '/login');
  
  // Check auth for protected routes
  if (path !== '/login') {
    const isAuth = await checkAuth();
    if (!isAuth) return;
  }
  
  const controller = routes[path] || routes['/'];
  controller.render();
}

window.addEventListener('popstate', render);
document.addEventListener('click', e => {
  if (e.target.matches('[data-route]')) {
    e.preventDefault();
    navigate(e.target.getAttribute('href'));
  }
});
