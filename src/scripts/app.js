// Main application bootstrap extracted from index.html
import { QuizApp } from '../components/QuizApp.js';

// Application configuration
const APP_CONFIG = {
  version: '2.1.0',
  build: 'modular-optimized',
  debug: false,
  features: {
    aiAssessment: true,
    csvSupport: true,
    timerModes: ['none', 'exam', 'section', 'question'],
    progressSaving: true,
    keyboardShortcuts: true,
    offlineSupport: false // Future enhancement
  }
};

// Enhanced error handling with better UX
class ErrorBoundary {
  static handleError(error, context = 'Unknown') {
    console.error(`[${context}] Application Error:`, error);

    // Create enhanced error UI
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-boundary';
    errorContainer.innerHTML = `
      <h1>🚫 Application Error</h1>
      <p><strong>Context:</strong> ${context}</p>
      <p><strong>Error:</strong> ${error.message}</p>
      <details class="error-details">
        <summary>Technical Details</summary>
        <pre>${error.stack || 'No stack trace available'}</pre>
      </details>
      <div style="margin-top: 1.5rem;">
        <button id="errorReloadBtn" class="btn btn-danger" style="margin-right: 0.5rem;">🔄 Reload Application</button>
        <button id="errorDismissBtn" class="btn btn-secondary">✖️ Dismiss Error</button>
      </div>
    `;

    // Clear body and show error
    document.body.innerHTML = '';
    document.body.appendChild(errorContainer);

    // Attach handlers (avoid inline onclick)
    const reloadBtn = document.getElementById('errorReloadBtn');
    const dismissBtn = document.getElementById('errorDismissBtn');
    if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload());
    if (dismissBtn) dismissBtn.addEventListener('click', () => errorContainer.remove());
  }
}

// Performance monitoring
class PerformanceMonitor {
  static marks = new Map();

  static mark(name) {
    if (performance.mark) {
      performance.mark(name);
      this.marks.set(name, performance.now());
    }
  }

  static measure(name, startMark) {
    if (performance.measure && this.marks.has(startMark)) {
      try {
        performance.measure(name, startMark);
        const entries = performance.getEntriesByName(name);
        if (entries.length > 0) {
          console.log(`📊 ${name}: ${entries[0].duration.toFixed(2)}ms`);
        }
      } catch (e) {
        console.warn('Performance measurement failed:', e);
      }
    }
  }

  static getLoadTime() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      return navigation.loadEventEnd - navigation.fetchStart;
    }
    return null;
  }
}

// Application initialization
async function initializeApplication() {
  try {
    PerformanceMonitor.mark('app-init-start');
    console.log(`🚀 Starting Professional Quiz Application v${APP_CONFIG.version}...`);

    // Create loading indicator
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">Initializing Application...</div>
      <div style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.8;">Loading modular components...</div>
    `;
    document.body.appendChild(loadingOverlay);

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));

    const quizApp = new QuizApp();

    await Promise.all([quizApp.init(), minLoadTime]);

    window.quizApp = quizApp;
    window.APP_CONFIG = APP_CONFIG;
    window.PerformanceMonitor = PerformanceMonitor;

    // Remove loading overlay with fade out
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay.parentNode) loadingOverlay.remove();
    }, 300);

    PerformanceMonitor.mark('app-init-end');
    PerformanceMonitor.measure('App Initialization', 'app-init-start');

    console.log(`✅ Professional Quiz Application v${APP_CONFIG.version} ready!`);
    console.log(`🎯 Features enabled:`, APP_CONFIG.features);

    if (quizApp.showSuccess) quizApp.showSuccess(`Welcome to Quiz Application v${APP_CONFIG.version}! 🎯`);

    const loadTime = PerformanceMonitor.getLoadTime();
    if (loadTime) console.log(`📊 Total load time: ${loadTime.toFixed(2)}ms`);

  } catch (error) {
    ErrorBoundary.handleError(error, 'Application Initialization');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApplication);

// Global error handlers
window.addEventListener('unhandledrejection', (event) => {
  ErrorBoundary.handleError(new Error(`Unhandled Promise Rejection: ${event.reason}`), 'Promise Rejection');
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  ErrorBoundary.handleError(new Error(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`), 'Runtime Error');
});

// Service worker registration (future)
if ('serviceWorker' in navigator && APP_CONFIG.features.offlineSupport) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('💡 Service Worker registered successfully:', registration);
    } catch (error) {
      console.log('💡 Service Worker registration failed:', error);
    }
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === 'h') {
    event.preventDefault();
    console.log('🎯 Quiz Application Keyboard Shortcuts:');
    console.log('Alt + H: Show this help');
    console.log('Ctrl/Cmd + 1-4: Select answer options (during quiz)');
    console.log('Ctrl/Cmd + ←/→: Navigate questions');
    console.log('Ctrl/Cmd + Space: Pause/Resume timer');
  }
});

// Load event performance hooks
window.addEventListener('load', () => {
  PerformanceMonitor.mark('app-load-complete');
  if (performance.memory) {
    const memory = performance.memory;
    console.log(`💾 Memory Usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB used / ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB total`);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') console.log('🔄 Application update available');
    });
  }
});

export default {};
