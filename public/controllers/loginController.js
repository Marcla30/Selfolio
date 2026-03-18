const loginController = {
  async render() {
    const app = document.getElementById('app');

    let registrationEnabled = false;
    try {
      const res = await fetch('/api/auth/config');
      const config = await res.json();
      registrationEnabled = config.registrationEnabled;
    } catch (e) {}

    app.innerHTML = `
      <div class="login-wrapper">
        <div class="card login-card">
          <h2 style="text-align: center; margin-bottom: 2rem;">Selfolio</h2>

          <div id="loginView">
            <form id="loginForm">
              <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required autofocus>
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" required>
              </div>
              <button type="submit" style="width: 100%;">Login</button>
            </form>
            <div id="loginError" style="color: var(--danger); margin-top: 1rem; text-align: center; display: none;"></div>
            ${registrationEnabled ? `
            <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
              No account?
              <a href="#" id="showRegister" style="color: var(--accent);">Create one</a>
            </p>` : ''}
          </div>

          <div id="registerView" style="display: none;">
            <form id="registerForm">
              <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required autofocus>
              </div>
              <div class="form-group">
                <label>Display name <span style="color: var(--text-secondary); font-size: 0.85em;">(optional)</span></label>
                <input type="text" name="name">
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" required>
              </div>
              <div class="form-group">
                <label>Confirm password</label>
                <input type="password" name="confirmPassword" required>
              </div>
              <button type="submit" style="width: 100%;">Create account</button>
            </form>
            <div id="registerError" style="color: var(--danger); margin-top: 1rem; text-align: center; display: none;"></div>
            <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
              Already have an account?
              <a href="#" id="showLogin" style="color: var(--accent);">Sign in</a>
            </p>
          </div>
        </div>
      </div>
    `;

    // Login submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const errorEl = document.getElementById('loginError');
      errorEl.style.display = 'none';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        if (!response.ok) {
          const err = await response.json();
          errorEl.textContent = err.error;
          errorEl.style.display = 'block';
          return;
        }

        const user = await response.json();
        localStorage.setItem('user', JSON.stringify({ id: user.id, username: user.username, name: user.name }));
        api.clearCsrfToken(); // Refresh CSRF token for new session
        await appState.init();
        navigate('/');
      } catch (error) {
        errorEl.textContent = 'Connection error';
        errorEl.style.display = 'block';
      }
    });

    // Register submit
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const errorEl = document.getElementById('registerError');
      errorEl.style.display = 'none';

      if (data.password !== data.confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: data.username, password: data.password, name: data.name || undefined }),
          credentials: 'include'
        });

        if (!response.ok) {
          const err = await response.json();
          errorEl.textContent = err.error;
          errorEl.style.display = 'block';
          return;
        }

        const user = await response.json();
        localStorage.setItem('user', JSON.stringify({ id: user.id, username: user.username, name: user.name }));
        api.clearCsrfToken(); // Refresh CSRF token for new session
        await appState.init();
        navigate('/');
      } catch (error) {
        errorEl.textContent = 'Connection error';
        errorEl.style.display = 'block';
      }
    });

    // Toggle views
    const showRegister = document.getElementById('showRegister');
    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('registerView').style.display = 'block';
        document.querySelector('#registerView input').focus();
      });
    }

    document.getElementById('showLogin').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('registerView').style.display = 'none';
      document.getElementById('loginView').style.display = 'block';
      document.querySelector('#loginView input').focus();
    });
  }
};
