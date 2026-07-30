/**
 * Flow Lab Authentication & Permission Module (Backend Proxy)
 * Autenticação 100% via servidor Node.js (Zero exposição de chaves no frontend)
 */

(function () {
  let currentUser = null;
  let userProfile = null;
  let activeSlide = 0;
  let carouselTimer = null;

  // Catálogo de módulos do Flow Lab para o carrossel
  const MODULES = [
    { icon: 'ph-squares-four', title: 'Dashboard', description: 'Visão geral com indicadores, gráficos e métricas em tempo real do seu negócio.' },
    { icon: 'ph-package', title: 'Estoque', description: 'Controle completo de produtos, lotes, validades e movimentações de inventário.' },
    { icon: 'ph-file-text', title: 'Solicitações', description: 'Hub centralizado para compras, pagamentos e manutenções com fluxo de aprovação.' },
    { icon: 'ph-buildings', title: 'Fornecedores', description: 'Cadastro e gestão de fornecedores com histórico de negociações e avaliações.' },
    { icon: 'ph-calculator', title: 'Cotações', description: 'Compare propostas de fornecedores lado a lado e aprove com agilidade.' },
    { icon: 'ph-receipt', title: 'Faturamento', description: 'Emissão de notas, contas a receber, glosas e acompanhamento financeiro.' },
    { icon: 'ph-clock-counter-clockwise', title: 'Movimentações', description: 'Rastreio de entradas, saídas e transferências de estoque em tempo real.' },
  ];

  // Iniciar fluxo no carregamento do DOM
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initCarousel();
    bindEvents();
    await checkAuthSession();
  });

  // 1. Alternância e Persistência de Tema Claro/Escuro
  function initTheme() {
    const savedTheme = localStorage.getItem('flowlab-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('flowlab-theme', newTheme);
    updateThemeIcons(newTheme);
  }

  function updateThemeIcons(theme) {
    const isDark = theme === 'dark';
    const iconClass = isDark ? 'ph-bold ph-moon-stars' : 'ph-bold ph-sun';

    const railBtn = document.getElementById('rail-toggle-theme');
    const headerBtn = document.getElementById('toggle-theme-btn');
    const authBtn = document.getElementById('auth-theme-btn');

    if (railBtn) railBtn.innerHTML = `<i class="${iconClass}"></i>`;
    if (headerBtn) headerBtn.innerHTML = `<i class="${iconClass}"></i>`;
    if (authBtn) authBtn.innerHTML = `<i class="${iconClass}"></i>`;
  }

  // 2. Carrossel de Módulos Flow Lab
  function initCarousel() {
    renderSlide(0);
    renderDots();
    startAutoPlay();

    const carouselArea = document.getElementById('auth-carousel-container');
    if (carouselArea) {
      carouselArea.addEventListener('mouseenter', () => stopAutoPlay());
      carouselArea.addEventListener('mouseleave', () => startAutoPlay());
    }
  }

  function renderSlide(index) {
    activeSlide = (index + MODULES.length) % MODULES.length;
    const mod = MODULES[activeSlide];

    const iconEl = document.getElementById('carousel-icon');
    const titleEl = document.getElementById('carousel-title');
    const descEl = document.getElementById('carousel-desc');

    if (iconEl && titleEl && descEl) {
      iconEl.className = `ph-bold ${mod.icon} carousel-icon-i`;
      titleEl.textContent = mod.title;
      descEl.textContent = mod.description;
    }

    updateDots();
  }

  function renderDots() {
    const dotsContainer = document.getElementById('carousel-dots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    MODULES.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = `carousel-dot ${i === activeSlide ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Ir para módulo ${i + 1}`);
      dot.addEventListener('click', () => {
        renderSlide(i);
      });
      dotsContainer.appendChild(dot);
    });
  }

  function updateDots() {
    const dots = document.querySelectorAll('.carousel-dot');
    dots.forEach((dot, i) => {
      if (i === activeSlide) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function nextSlide() {
    renderSlide(activeSlide + 1);
  }

  function prevSlide() {
    renderSlide(activeSlide - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    carouselTimer = setInterval(nextSlide, 4500);
  }

  function stopAutoPlay() {
    if (carouselTimer) clearInterval(carouselTimer);
  }

  // 3. Vincular Eventos de Formulário e UI
  function bindEvents() {
    // Botões do Carrossel
    document.getElementById('carousel-next')?.addEventListener('click', () => nextSlide());
    document.getElementById('carousel-prev')?.addEventListener('click', () => prevSlide());

    // Toggle de Senha (Ver/Ocultar)
    document.getElementById('toggle-password-btn')?.addEventListener('click', () => {
      const passInput = document.getElementById('login-password');
      const passIcon = document.getElementById('toggle-password-icon');
      if (passInput) {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        if (passIcon) {
          passIcon.className = isPass ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye';
        }
      }
    });

    // Alternar entre Login e Esqueci Minha Senha
    document.getElementById('show-forgot-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-form-view')?.classList.add('hidden');
      document.getElementById('forgot-form-view')?.classList.remove('hidden');
      clearError();
    });

    document.getElementById('back-to-login-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('forgot-form-view')?.classList.add('hidden');
      document.getElementById('login-form-view')?.classList.remove('hidden');
      clearError();
    });

    // Submit de Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleLogin();
    });

    // Submit de Esqueci Minha Senha
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleForgotPassword();
    });

    // Botões de Logout (Sidebar e Tela Restrita)
    document.getElementById('auth-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('restricted-logout-btn')?.addEventListener('click', handleLogout);

    // Botões de Alternância de Tema Claro/Escuro
    document.getElementById('auth-theme-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('toggle-theme-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('rail-toggle-theme')?.addEventListener('click', toggleTheme);
  }

  function clearError() {
    const errorBox = document.getElementById('auth-error-msg');
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.classList.add('hidden');
    }
  }

  function showError(msg) {
    const errorBox = document.getElementById('auth-error-msg');
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
    }
  }

  // 4. Fluxos de Autenticação Backend Proxy
  async function handleLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const submitBtn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      showError('Por favor, informe e-mail e senha.');
      return;
    }

    try {
      setLoading(submitBtn, true, 'Entrando...');
      clearError();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showError(data.error || 'Falha ao autenticar.');
        setLoading(submitBtn, false, 'Entrar');
        return;
      }

      // Salvar perfil do usuário autenticado no localStorage
      localStorage.setItem('flowlab_user', JSON.stringify(data.user));
      if (data.session?.accessToken) {
        localStorage.setItem('flowlab_token', data.session.accessToken);
      }

      userProfile = data.user;

      if (data.hasWhatsappAccess) {
        grantAccess(userProfile);
      } else {
        denyAccess(userProfile);
      }
    } catch (err) {
      console.error('Erro no login backend:', err);
      showError('Ocorreu um erro ao comunicar com o servidor.');
    } finally {
      setLoading(submitBtn, false, 'Entrar');
    }
  }

  async function handleForgotPassword() {
    const email = document.getElementById('forgot-email')?.value.trim();
    const submitBtn = document.getElementById('forgot-submit-btn');

    if (!email) {
      showError('Insira seu e-mail para recuperar a senha.');
      return;
    }

    try {
      setLoading(submitBtn, true, 'Enviando...');
      clearError();

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showError(data.error || 'Erro ao enviar e-mail de recuperação.');
      } else {
        alert('Instruções de redefinição de senha enviadas para seu e-mail.');
        document.getElementById('forgot-form-view')?.classList.add('hidden');
        document.getElementById('login-form-view')?.classList.remove('hidden');
      }
    } catch (err) {
      showError('Erro ao solicitar redefinição de senha.');
    } finally {
      setLoading(submitBtn, false, 'Enviar Instruções');
    }
  }

  function handleLogout() {
    if (typeof window.stopWahaApp === 'function') window.stopWahaApp();
    localStorage.removeItem('flowlab_user');
    localStorage.removeItem('flowlab_token');
    currentUser = null;
    userProfile = null;
    showAuthOverlay();
  }

  function setLoading(btn, loading, defaultText) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="auth-spinner"></span> Aguarde...`
      : defaultText;
  }

  // 5. Checagem de Sessão no Backend ao Carregar
  async function checkAuthSession() {
    const storedUser = localStorage.getItem('flowlab_user');
    if (!storedUser) {
      showAuthOverlay();
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      // Verificar permissão atualizada com o backend
      const res = await fetch('/api/auth/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await res.json();

      if (res.ok && data.authenticated && data.user) {
        userProfile = data.user;
        localStorage.setItem('flowlab_user', JSON.stringify(data.user));

        if (data.hasWhatsappAccess) {
          grantAccess(userProfile);
        } else {
          denyAccess(userProfile);
        }
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Erro ao verificar sessão no backend:', err);
      showAuthOverlay();
    }
  }

  // 6. Atualização de Telas (Acesso Concedido vs. Acesso Negado vs. Tela de Login)
  function grantAccess(profile) {
    // Esconder Overlay de Auth e Tela Restrita
    document.getElementById('flowlab-auth-overlay')?.classList.add('hidden');
    document.getElementById('restricted-access-screen')?.classList.add('hidden');

    // Exibir Workspace
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.setProperty('display', 'flex', 'important');
    }

    // Iniciar buscas do WAHA (chats, status, real-time) apenas após autorização
    if (typeof window.startWahaApp === 'function') {
      window.startWahaApp();
    }

    // Atualizar dados do usuário na sidebar
    const userNameEl = document.getElementById('auth-user-name');
    const userEmailEl = document.getElementById('auth-user-email');
    const userDeptEl = document.getElementById('auth-user-dept');
    const userAvatarEl = document.getElementById('auth-user-avatar');

    if (userNameEl) userNameEl.textContent = profile.name;
    if (userEmailEl) userEmailEl.textContent = profile.email;
    if (userDeptEl) userDeptEl.textContent = profile.department;
    if (userAvatarEl) userAvatarEl.textContent = profile.name.charAt(0).toUpperCase();
  }

  function denyAccess(profile) {
    if (typeof window.stopWahaApp === 'function') window.stopWahaApp();

    // Esconder Overlay de Auth e Esconder Workspace
    document.getElementById('flowlab-auth-overlay')?.classList.add('hidden');
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.setProperty('display', 'none', 'important');
    }

    // Exibir Tela de Acesso Restrito
    const restrictedScreen = document.getElementById('restricted-access-screen');
    if (restrictedScreen) {
      restrictedScreen.classList.remove('hidden');
    }

    const restName = document.getElementById('restricted-user-name');
    const restEmail = document.getElementById('restricted-user-email');
    const restDept = document.getElementById('restricted-user-dept');

    if (restName) restName.textContent = profile.name;
    if (restEmail) restEmail.textContent = profile.email;
    if (restDept) restDept.textContent = profile.department;
  }

  function showAuthOverlay() {
    if (typeof window.stopWahaApp === 'function') window.stopWahaApp();

    // Esconder Workspace e Tela Restrita
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.setProperty('display', 'none', 'important');
    }
    document.getElementById('restricted-access-screen')?.classList.add('hidden');

    // Exibir Tela de Autenticação Flow Lab
    document.getElementById('flowlab-auth-overlay')?.classList.remove('hidden');
  }
})();
