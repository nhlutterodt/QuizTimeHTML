// Event Management System
export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.globalListeners = [];
  }

  /**
   * Add event listener with automatic cleanup
   */
  on(target, event, handler, options = {}) {
    const wrappedHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    };

    target.addEventListener(event, wrappedHandler, options);

    // Store for cleanup
    if (!this.listeners.has(target)) {
      this.listeners.set(target, []);
    }
    this.listeners.get(target).push({
      event,
      handler: wrappedHandler,
      options
    });

    return () => this.off(target, event, wrappedHandler);
  }

  /**
   * Remove specific event listener
   */
  off(target, event, handler) {
    target.removeEventListener(event, handler);
    
    const targetListeners = this.listeners.get(target);
    if (targetListeners) {
      const index = targetListeners.findIndex(
        l => l.event === event && l.handler === handler
      );
      if (index !== -1) {
        targetListeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners for a target
   */
  removeAllListeners(target) {
    const targetListeners = this.listeners.get(target);
    if (targetListeners) {
      targetListeners.forEach(({ event, handler }) => {
        target.removeEventListener(event, handler);
      });
      this.listeners.delete(target);
    }
  }

  /**
   * Clean up all managed event listeners
   */
  cleanup() {
    this.listeners.forEach((listeners, target) => {
      listeners.forEach(({ event, handler }) => {
        target.removeEventListener(event, handler);
      });
    });
    this.listeners.clear();
    
    // Clean up global listeners
    this.globalListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.globalListeners = [];
  }

  /**
   * Add global event listener (document/window level)
   */
  addGlobalListener(target, event, handler, options = {}) {
    const wrappedHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        console.error(`Error in global event handler for ${event}:`, error);
      }
    };

    target.addEventListener(event, wrappedHandler, options);
    this.globalListeners.push({ target, event, handler: wrappedHandler });

    return () => {
      target.removeEventListener(event, wrappedHandler);
      const index = this.globalListeners.findIndex(
        l => l.target === target && l.event === event && l.handler === wrappedHandler
      );
      if (index !== -1) {
        this.globalListeners.splice(index, 1);
      }
    };
  }

  /**
   * Debounce function calls
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function calls
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Create a one-time event listener
   */
  once(target, event, handler) {
    const onceHandler = (e) => {
      handler(e);
      this.off(target, event, onceHandler);
    };
    return this.on(target, event, onceHandler);
  }

  /**
   * Wait for specific event as Promise
   */
  waitForEvent(target, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let timeoutId;
      
      const handler = (e) => {
        clearTimeout(timeoutId);
        this.off(target, event, handler);
        resolve(e);
      };

      this.on(target, event, handler);

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(target, event, handler);
          reject(new Error(`Event '${event}' timeout after ${timeout}ms`));
        }, timeout);
      }
    });
  }
}
