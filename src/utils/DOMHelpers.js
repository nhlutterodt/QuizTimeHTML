// DOM Helper Utilities
export class DOMHelpers {
  
  /**
   * Create an element with optional attributes and content
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    if (content) {
      element.textContent = content;
    }
    
    return element;
  }

  /**
   * Find element by ID with error handling
   */
  static getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID '${id}' not found`);
    }
    return element;
  }

  /**
   * Show/hide elements with optional transition
   */
  static toggleVisibility(element, show, transition = false) {
    if (!element) return;
    
    if (transition) {
      element.style.transition = 'opacity 0.3s ease';
    }
    
    if (show) {
      element.style.display = 'block';
      element.classList.remove('hidden');
      if (transition) {
        element.style.opacity = '1';
      }
    } else {
      element.classList.add('hidden');
      if (transition) {
        element.style.opacity = '0';
        setTimeout(() => {
          element.style.display = 'none';
        }, 300);
      } else {
        element.style.display = 'none';
      }
    }
  }

  /**
   * Add multiple event listeners to an element
   */
  static addEventListeners(element, events) {
    if (!element) return;
    
    Object.entries(events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  }

  /**
   * Shuffle array in place (Fisher-Yates algorithm)
   */
  static shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Format time from seconds to MM:SS or HH:MM:SS
   */
  static formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Safely parse JSON with error handling
   */
  static safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parsing error:', error);
      return defaultValue;
    }
  }

  /**
   * Deep clone an object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
