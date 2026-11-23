/* ==========================================================================
   SUGAR — Desktop Renderer Controller (surveyapps/renderer/app.js)
   Plain static ES6+ script, zero external dependencies, no Node APIs.
   Consumes preload bridge: window.surveyapps.{getStatus, onStatus, retryBackend}
   ========================================================================== */

(function () {
  'use strict';

  var VALID_VIEWS = ['home', 'grid', 'microscopy', 'segment', 'help'];
  var staticTools = {
    grid: { statusKey: 'gridUrl', fallbackUrl: '../vendor/grid-studio/index.html' },
    segment: { statusKey: 'segmentUrl', fallbackUrl: '../segment/index.html' }
  };

  var VIEW_META = {
    home: {
      title: 'Dashboard',
      subtitle: 'Microfluidic chip alignment, fluorescence analysis, and spatial ROI segmentation'
    },
    grid: {
      title: 'Grid Studio',
      subtitle: 'Optical calibration and true-to-scale microfluidic chip overlay'
    },
    microscopy: {
      title: 'Fluorescence Lab',
      subtitle: 'Well grid alignment, 8-bit channel intensity, and heatmap analysis'
    },
    segment: {
      title: 'Segment',
      subtitle: 'Interactive spatial ROI painting, flood fill, and million-cell CSV export'
    },
    help: {
      title: 'Help & Reference',
      subtitle: 'Scientific methods, calibration notes, keyboard shortcuts, and offline privacy'
    }
  };

  // Internal UI & Bridge State
  var appState = {
    currentView: 'home',
    sidebarCollapsed: false,
    hasBridge: false,
    retrying: false,
    unsubscribeStatus: null,
    loadedMicroscopyUrl: null,
    microscopyActivated: false,
    status: {
      state: 'starting',
      message: 'Preparing local workspace…',
      microscopyUrl: '',
      gridUrl: '',
      segmentUrl: '',
      version: ''
    }
  };

  // DOM Element References
  var dom = {};

  function cacheDom() {
    dom.shell = document.getElementById('app-shell');
    dom.brandLogo = document.getElementById('brand-logo');
    dom.brandLogoWrap = dom.brandLogo ? dom.brandLogo.parentElement : null;
    dom.appVersion = document.getElementById('app-version');
    dom.sidebarToggle = document.getElementById('sidebar-toggle');
    dom.mobileMenuBtn = document.getElementById('mobile-menu-btn');

    dom.navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
    dom.launchButtons = Array.prototype.slice.call(document.querySelectorAll('[data-launch]'));

    dom.views = {
      home: document.getElementById('view-home'),
      grid: document.getElementById('view-grid'),
      microscopy: document.getElementById('view-microscopy'),
      segment: document.getElementById('view-segment'),
      help: document.getElementById('view-help')
    };

    dom.topbarTitle = document.getElementById('topbar-title');
    dom.topbarSubtitle = document.getElementById('topbar-subtitle');
    dom.topbarToolControls = document.getElementById('topbar-tool-controls');
    dom.reloadActiveToolBtn = document.getElementById('reload-active-tool-btn');

    dom.bridgeStatusPill = document.getElementById('bridge-status-pill');
    dom.pillDot = document.getElementById('pill-dot');
    dom.pillText = document.getElementById('pill-text');

    dom.fallbackBanner = document.getElementById('fallback-banner');

    dom.navBadgeGrid = document.getElementById('nav-badge-grid');
    dom.navBadgeMicroscopy = document.getElementById('nav-badge-microscopy');
    dom.navBadgeSegment = document.getElementById('nav-badge-segment');

    dom.sidebarStatusDot = document.getElementById('sidebar-status-dot');
    dom.sidebarStatusTitle = document.getElementById('sidebar-status-title');
    dom.sidebarStatusMsg = document.getElementById('sidebar-status-msg');

    dom.heroStatusSummary = document.getElementById('hero-status-summary');
    dom.cardGridBadge = document.getElementById('card-grid-badge');
    dom.cardMicroscopyBadge = document.getElementById('card-microscopy-badge');
    dom.cardSegmentBadge = document.getElementById('card-segment-badge');

    dom.homeRtState = document.getElementById('home-rt-state');
    dom.homeRtGrid = document.getElementById('home-rt-grid');
    dom.homeRtSegment = document.getElementById('home-rt-segment');
    dom.homeRtMessage = document.getElementById('home-rt-message');

    Object.keys(staticTools).forEach(function (view) {
      var tool = staticTools[view];
      tool.frame = document.getElementById('frame-' + view);
      tool.overlay = document.getElementById(view + '-overlay');
      tool.activated = false;
      tool.loadedUrl = null;
    });

    dom.microscopyOverlay = document.getElementById('microscopy-overlay');
    dom.microscopySpinner = document.getElementById('microscopy-spinner');
    dom.microscopyErrorIcon = document.getElementById('microscopy-error-icon');
    dom.microscopyOverlayTitle = document.getElementById('microscopy-overlay-title');
    dom.microscopyOverlayMsg = document.getElementById('microscopy-overlay-msg');
    dom.frameMicroscopy = document.getElementById('frame-microscopy');

    dom.retryButtons = [
      'sidebar-retry-btn', 'topbar-retry-btn', 'card-retry-microscopy-btn', 'microscopy-retry-btn'
    ].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  }

  /* ------------------------------------------------------------------------
     Logo Asset Handling (../assets/icon.svg with matching PNG fallback)
     ------------------------------------------------------------------------ */
  function setupLogoFallback() {
    if (!dom.brandLogo || !dom.brandLogoWrap) return;

    dom.brandLogo.addEventListener('error', function () {
      dom.brandLogoWrap.classList.add('is-fallback');
    });

    dom.brandLogo.addEventListener('load', function () {
      if (dom.brandLogo.naturalWidth > 0) {
        dom.brandLogoWrap.classList.remove('is-fallback');
      } else {
        dom.brandLogoWrap.classList.add('is-fallback');
      }
    });

    if (dom.brandLogo.complete && dom.brandLogo.naturalWidth === 0) {
      dom.brandLogoWrap.classList.add('is-fallback');
    }
  }

  /* ------------------------------------------------------------------------
     Status Normalization & UI Synchronization
     ------------------------------------------------------------------------ */
  function normalizeStatus(raw) {
    var safe = raw && typeof raw === 'object' ? raw : {};
    var state = safe.state;
    if (state !== 'starting' && state !== 'ready' && state !== 'error') {
      state = 'starting';
    }

    var gridUrl = typeof safe.gridUrl === 'string' && safe.gridUrl.trim()
      ? safe.gridUrl.trim()
      : staticTools.grid.fallbackUrl;

    var segmentUrl = typeof safe.segmentUrl === 'string' && safe.segmentUrl.trim()
      ? safe.segmentUrl.trim()
      : staticTools.segment.fallbackUrl;

    var microscopyUrl = (state === 'ready' && typeof safe.microscopyUrl === 'string')
      ? safe.microscopyUrl.trim()
      : '';

    var version = typeof safe.version === 'string' && safe.version.trim()
      ? safe.version.trim()
      : '1.1.0';

    var defaultMessages = {
      starting: 'Starting Fluorescence Lab… Grid Studio and Segment are ready.',
      ready: 'All three tools are ready. Your data stays on this computer.',
      error: 'Fluorescence Lab could not start. Grid Studio and Segment remain available.'
    };

    var message = typeof safe.message === 'string' && safe.message.trim()
      ? safe.message.trim()
      : defaultMessages[state];

    return {
      state: state,
      message: message,
      microscopyUrl: microscopyUrl,
      gridUrl: gridUrl,
      segmentUrl: segmentUrl,
      version: version
    };
  }

  function setStatusDotClass(el, state) {
    if (!el) return;
    el.className = 'status-dot is-' + state;
  }

  function applyStatus(rawStatus) {
    var next = normalizeStatus(rawStatus);
    appState.status = next;

    // 1. Version pill
    if (dom.appVersion) {
      var vText = next.version.indexOf('v') === 0 ? next.version : 'v' + next.version;
      dom.appVersion.textContent = vText;
    }

    // 2. Topbar status pill & sidebar status indicators
    setStatusDotClass(dom.pillDot, next.state);
    setStatusDotClass(dom.sidebarStatusDot, next.state);
    setStatusDotClass(dom.navBadgeMicroscopy, next.state);
    setStatusDotClass(dom.navBadgeGrid, 'ready');
    setStatusDotClass(dom.navBadgeSegment, 'ready');

    if (dom.bridgeStatusPill) {
      dom.bridgeStatusPill.className = 'status-pill is-' + next.state;
    }

    var pillLabel = 'Starting…';
    var sidebarTitle = 'Starting…';
    var cardBadgeText = 'Starting…';
    var cardBadgeClass = 'badge badge-starting';
    var rtStateText = 'Starting…';

    if (!appState.hasBridge) {
      pillLabel = 'Preview Mode';
      sidebarTitle = 'Preview Mode';
      cardBadgeText = 'Desktop App Required';
      cardBadgeClass = 'badge badge-error';
      rtStateText = 'Unavailable in preview mode';
    } else if (next.state === 'ready') {
      pillLabel = 'All Tools Ready';
      sidebarTitle = 'Workspace Ready';
      cardBadgeText = 'Ready';
      cardBadgeClass = 'badge badge-ready';
      rtStateText = 'Ready';
    } else if (next.state === 'error') {
      pillLabel = 'Fluorescence Lab Error';
      sidebarTitle = 'Fluorescence Lab Error';
      cardBadgeText = 'Unavailable';
      cardBadgeClass = 'badge badge-error';
      rtStateText = 'Unavailable (Grid Studio & Segment ready)';
    }

    if (dom.pillText) dom.pillText.textContent = pillLabel;
    if (dom.sidebarStatusTitle) dom.sidebarStatusTitle.textContent = sidebarTitle;
    if (dom.sidebarStatusMsg) dom.sidebarStatusMsg.textContent = next.message;

    if (dom.heroStatusSummary) {
      dom.heroStatusSummary.textContent = next.state === 'ready'
        ? 'All Tools Ready'
        : (next.state === 'error' ? 'Grid Studio & Segment Ready • Fluorescence Lab Unavailable' : 'Starting Fluorescence Lab…');
    }

    if (dom.cardGridBadge) {
      dom.cardGridBadge.textContent = 'Ready';
      dom.cardGridBadge.className = 'badge badge-ready';
    }

    if (dom.cardSegmentBadge) {
      dom.cardSegmentBadge.textContent = 'Ready';
      dom.cardSegmentBadge.className = 'badge badge-ready';
    }

    if (dom.cardMicroscopyBadge) {
      dom.cardMicroscopyBadge.textContent = cardBadgeText;
      dom.cardMicroscopyBadge.className = cardBadgeClass;
    }

    if (dom.homeRtState) dom.homeRtState.textContent = rtStateText;
    if (dom.homeRtGrid) {
      dom.homeRtGrid.textContent = 'Ready';
    }
    if (dom.homeRtSegment) {
      dom.homeRtSegment.textContent = 'Ready';
    }
    if (dom.homeRtMessage) dom.homeRtMessage.textContent = next.message;

    // 3. Retry Buttons Visibility (only when bridge exists and state === 'error')
    var showRetry = appState.hasBridge && next.state === 'error';
    dom.retryButtons.forEach(function (btn) {
      toggleHidden(btn, !showRetry);
    });

    // 4. Sync Persistent Iframes
    Object.values(staticTools).forEach(function (tool) {
      syncStaticIframe(tool);
    });
    syncMicroscopyIframe();
  }

  function toggleHidden(el, shouldHide) {
    if (!el) return;
    if (shouldHide) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  }

  /* ------------------------------------------------------------------------
     Persistent Iframe Lifecycle
     ------------------------------------------------------------------------ */
  function syncStaticIframe(tool, forceReload) {
    if (!tool.frame || !tool.activated) return;
    var targetUrl = appState.status[tool.statusKey] ||
      (forceReload || !appState.hasBridge ? tool.fallbackUrl : '');
    if (!targetUrl || (!forceReload && tool.loadedUrl === targetUrl)) return;

    toggleHidden(tool.overlay, false);
    tool.loadedUrl = targetUrl;
    tool.frame.src = targetUrl;
  }

  function syncMicroscopyIframe() {
    if (!dom.frameMicroscopy || !dom.microscopyOverlay) return;
    var st = appState.status;

    if (!appState.hasBridge) {
      // Clear desktop-only fallback when opened outside Electron
      toggleHidden(dom.microscopyOverlay, false);
      toggleHidden(dom.microscopySpinner, true);
      toggleHidden(dom.microscopyErrorIcon, false);
      if (dom.microscopyOverlayTitle) {
        dom.microscopyOverlayTitle.textContent = 'Desktop App Required for Fluorescence Lab';
      }
      if (dom.microscopyOverlayMsg) {
        dom.microscopyOverlayMsg.textContent =
          'Launch the SUGAR desktop application to use Fluorescence Lab, or open Grid Studio.';
      }
      return;
    }

    if (st.state === 'starting') {
      toggleHidden(dom.microscopyOverlay, false);
      toggleHidden(dom.microscopySpinner, false);
      toggleHidden(dom.microscopyErrorIcon, true);
      if (dom.microscopyOverlayTitle) {
        dom.microscopyOverlayTitle.textContent = appState.retrying
          ? 'Restarting Fluorescence Lab…'
          : 'Starting Fluorescence Lab…';
      }
      if (dom.microscopyOverlayMsg) {
        dom.microscopyOverlayMsg.textContent = st.message;
      }
      return;
    }

    if (st.state === 'error' || !st.microscopyUrl) {
      toggleHidden(dom.microscopyOverlay, false);
      toggleHidden(dom.microscopySpinner, true);
      toggleHidden(dom.microscopyErrorIcon, false);
      if (dom.microscopyOverlayTitle) {
        dom.microscopyOverlayTitle.textContent = 'Fluorescence Lab Unavailable';
      }
      if (dom.microscopyOverlayMsg) {
        dom.microscopyOverlayMsg.textContent =
          st.message || 'Fluorescence Lab could not start. Retry below or continue working in Grid Studio.';
      }
      return;
    }

    // st.state === 'ready' and st.microscopyUrl is available
    if (appState.microscopyActivated) {
      if (appState.loadedMicroscopyUrl !== st.microscopyUrl) {
        toggleHidden(dom.microscopyOverlay, false);
        toggleHidden(dom.microscopySpinner, false);
        toggleHidden(dom.microscopyErrorIcon, true);
        if (dom.microscopyOverlayTitle) {
          dom.microscopyOverlayTitle.textContent = 'Opening Fluorescence Lab…';
        }
        if (dom.microscopyOverlayMsg) {
          dom.microscopyOverlayMsg.textContent = 'Loading well intensity and heatmap workspace…';
        }
        appState.loadedMicroscopyUrl = st.microscopyUrl;
        dom.frameMicroscopy.src = st.microscopyUrl;
      } else {
        toggleHidden(dom.microscopyOverlay, true);
      }
    }
  }

  function setupIframeListeners() {
    Object.values(staticTools).forEach(function (tool) {
      if (!tool.frame) return;
      tool.frame.addEventListener('load', function () {
        if (tool.loadedUrl) toggleHidden(tool.overlay, true);
      });
    });

    if (dom.frameMicroscopy) {
      dom.frameMicroscopy.addEventListener('load', function () {
        if (appState.loadedMicroscopyUrl && appState.status.state === 'ready') {
          toggleHidden(dom.microscopyOverlay, true);
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     View Navigation & Sidebar Collapse
     ------------------------------------------------------------------------ */
  function navigateTo(viewName) {
    if (VALID_VIEWS.indexOf(viewName) === -1) {
      viewName = 'home';
    }

    appState.currentView = viewName;

    if (dom.shell) {
      dom.shell.setAttribute('data-view', viewName);
      dom.shell.classList.remove('is-mobile-nav-open');
    }

    // Update sidebar nav active state & ARIA attributes
    dom.navButtons.forEach(function (btn) {
      var target = btn.getAttribute('data-nav');
      var active = target === viewName;
      btn.classList.toggle('is-active', active);
      if (active) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    // Show active view panel while keeping inactive iframe panels in DOM (hidden attribute only)
    VALID_VIEWS.forEach(function (key) {
      var panel = dom.views[key];
      if (!panel) return;
      if (key === viewName) {
        panel.removeAttribute('hidden');
        panel.classList.add('is-active');
      } else {
        panel.setAttribute('hidden', '');
        panel.classList.remove('is-active');
      }
    });

    // Update topbar title & subtitle
    var meta = VIEW_META[viewName] || VIEW_META.home;
    if (dom.topbarTitle) dom.topbarTitle.textContent = meta.title;
    if (dom.topbarSubtitle) dom.topbarSubtitle.textContent = meta.subtitle;

    // Show tool session controls when viewing an embedded tool
    var staticTool = staticTools[viewName];
    toggleHidden(dom.topbarToolControls, !staticTool && viewName !== 'microscopy');

    // Lazily activate persistent iframes on first navigation
    if (staticTool) {
      staticTool.activated = true;
      syncStaticIframe(staticTool);
    } else if (viewName === 'microscopy') {
      appState.microscopyActivated = true;
      syncMicroscopyIframe();
    }
  }

  function toggleSidebar() {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    if (dom.shell) {
      dom.shell.setAttribute(
        'data-sidebar',
        appState.sidebarCollapsed ? 'collapsed' : 'expanded'
      );
    }
    if (dom.sidebarToggle) {
      dom.sidebarToggle.setAttribute(
        'aria-expanded',
        appState.sidebarCollapsed ? 'false' : 'true'
      );
    }
  }

  function reloadActiveTool() {
    var staticTool = staticTools[appState.currentView];
    if (staticTool) {
      syncStaticIframe(staticTool, true);
    } else if (appState.currentView === 'microscopy' && dom.frameMicroscopy) {
      if (appState.status.state === 'ready' && appState.status.microscopyUrl) {
        toggleHidden(dom.microscopyOverlay, false);
        toggleHidden(dom.microscopySpinner, false);
        toggleHidden(dom.microscopyErrorIcon, true);
        dom.frameMicroscopy.src = appState.status.microscopyUrl;
      } else {
        handleRetryBackend();
      }
    }
  }

  /* ------------------------------------------------------------------------
     Preload Bridge Integration (window.surveyapps)
     ------------------------------------------------------------------------ */
  function safeThen(fn, onFulfilled, onRejected) {
    try {
      var res = fn();
      if (res && typeof res.then === 'function') {
        var chained = res.then(onFulfilled);
        if (chained && typeof chained.catch === 'function' && onRejected) {
          chained.catch(onRejected);
        }
      } else if (onFulfilled) {
        onFulfilled(res);
      }
    } catch (err) {
      if (onRejected) onRejected(err);
    }
  }

  function handleRetryBackend() {
    if (!appState.hasBridge || !window.surveyapps || typeof window.surveyapps.retryBackend !== 'function') {
      return;
    }
    if (appState.retrying) return;

    appState.retrying = true;
    setRetryButtonsDisabled(true);

    // Optimistically reflect starting state while retryBackend executes
    applyStatus({
      state: 'starting',
      message: 'Restarting Fluorescence Lab…',
      gridUrl: appState.status.gridUrl,
      segmentUrl: appState.status.segmentUrl,
      version: appState.status.version
    });

    function finishRetry(latestStatus) {
      appState.retrying = false;
      setRetryButtonsDisabled(false);
      if (latestStatus) applyStatus(latestStatus);
    }

    function failRetry(err) {
      finishRetry();
      applyStatus({
        state: 'error',
        message: err && err.message ? err.message : 'Fluorescence Lab retry failed.',
        gridUrl: appState.status.gridUrl,
        segmentUrl: appState.status.segmentUrl,
        version: appState.status.version
      });
    }

    safeThen(
      function () {
        return window.surveyapps.retryBackend();
      },
      function () {
        if (window.surveyapps && typeof window.surveyapps.getStatus === 'function') {
          safeThen(
            function () {
              return window.surveyapps.getStatus();
            },
            finishRetry,
            failRetry
          );
        } else {
          finishRetry();
        }
      },
      failRetry
    );
  }

  function setRetryButtonsDisabled(disabled) {
    dom.retryButtons.forEach(function (btn) {
      btn.disabled = disabled;
    });
  }

  function initBridge() {
    var bridge = window.surveyapps;
    var validBridge = Boolean(
      bridge &&
      typeof bridge === 'object' &&
      typeof bridge.getStatus === 'function'
    );

    appState.hasBridge = validBridge;

    if (!validBridge) {
      // Desktop-only fallback mode: no console error, clear banner + Grid Studio fallback
      toggleHidden(dom.fallbackBanner, false);
      applyStatus({
        state: 'error',
        message: 'Launch the SUGAR desktop application to use Fluorescence Lab.',
        gridUrl: staticTools.grid.fallbackUrl,
        version: '1.0.0'
      });
      return;
    }

    toggleHidden(dom.fallbackBanner, true);

    // Subscribe to live status updates if onStatus is available
    if (typeof bridge.onStatus === 'function') {
      try {
        var unsub = bridge.onStatus(function (statusPayload) {
          applyStatus(statusPayload);
        });
        if (typeof unsub === 'function') {
          appState.unsubscribeStatus = unsub;
        }
      } catch (_err) {
        // Guard against unexpected subscription error without crashing UI
      }
    }

    // Fetch initial status snapshot
    safeThen(
      function () {
        return bridge.getStatus();
      },
      function (initialStatus) {
        if (initialStatus) {
          applyStatus(initialStatus);
        }
      },
      function (err) {
        var msg = err && err.message ? err.message : 'Unable to check workspace status.';
        applyStatus({
          state: 'error',
          message: msg,
          gridUrl: appState.status.gridUrl || staticTools.grid.fallbackUrl,
          version: appState.status.version || '1.1.0'
        });
      }
    );
  }

  /* ------------------------------------------------------------------------
     Event Wiring & Keyboard Accessibility
     ------------------------------------------------------------------------ */
  function bindEvents() {
    dom.navButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-nav');
        navigateTo(target);
      });
    });

    dom.launchButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-launch');
        navigateTo(target);
      });
    });

    if (dom.sidebarToggle) {
      dom.sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (dom.mobileMenuBtn && dom.shell) {
      dom.mobileMenuBtn.addEventListener('click', function () {
        dom.shell.classList.toggle('is-mobile-nav-open');
      });
    }

    if (dom.reloadActiveToolBtn) {
      dom.reloadActiveToolBtn.addEventListener('click', reloadActiveTool);
    }

    dom.retryButtons.forEach(function (btn) {
      btn.addEventListener('click', handleRetryBackend);
    });

    window.addEventListener('keydown', function (e) {
      // Alt+1..5 switches top-level views
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          navigateTo('home');
        } else if (e.key === '2') {
          e.preventDefault();
          navigateTo('grid');
        } else if (e.key === '3') {
          e.preventDefault();
          navigateTo('microscopy');
        } else if (e.key === '4') {
          e.preventDefault();
          navigateTo('segment');
        } else if (e.key === '5') {
          e.preventDefault();
          navigateTo('help');
        }
      }

      // Ctrl/Cmd + B toggles sidebar collapse
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    window.addEventListener('beforeunload', function () {
      if (typeof appState.unsubscribeStatus === 'function') {
        try {
          appState.unsubscribeStatus();
        } catch (_e) {
          // Ignore cleanup errors on unload
        }
        appState.unsubscribeStatus = null;
      }
    });
  }

  /* ------------------------------------------------------------------------
     Bootstrap
     ------------------------------------------------------------------------ */
  function init() {
    cacheDom();
    setupLogoFallback();
    setupIframeListeners();
    bindEvents();
    initBridge();
    navigateTo('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
