// Storage Service - Handles local storage and session management
export class StorageService {
  constructor() {
    this.prefix = 'quiz_';
    this.sessionPrefix = 'session_';
  }

  /**
   * Save data to localStorage with error handling
   */
  setLocal(key, value) {
    try {
      const prefixedKey = this.prefix + key;
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(prefixedKey, serializedValue);
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  /**
   * Get data from localStorage with error handling
   */
  getLocal(key, defaultValue = null) {
    try {
      const prefixedKey = this.prefix + key;
      const item = localStorage.getItem(prefixedKey);
      
      if (item === null) {
        return defaultValue;
      }
      
      return JSON.parse(item);
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data from localStorage
   */
  removeLocal(key) {
    try {
      const prefixedKey = this.prefix + key;
      localStorage.removeItem(prefixedKey);
      return true;
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
      return false;
    }
  }

  /**
   * Clear all quiz-related localStorage data
   */
  clearLocal() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  /**
   * Save data to sessionStorage
   */
  setSession(key, value) {
    try {
      const prefixedKey = this.sessionPrefix + key;
      const serializedValue = JSON.stringify(value);
      sessionStorage.setItem(prefixedKey, serializedValue);
      return true;
    } catch (error) {
      console.error('Failed to save to sessionStorage:', error);
      return false;
    }
  }

  /**
   * Get data from sessionStorage
   */
  getSession(key, defaultValue = null) {
    try {
      const prefixedKey = this.sessionPrefix + key;
      const item = sessionStorage.getItem(prefixedKey);
      
      if (item === null) {
        return defaultValue;
      }
      
      return JSON.parse(item);
    } catch (error) {
      console.error('Failed to read from sessionStorage:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data from sessionStorage
   */
  removeSession(key) {
    try {
      const prefixedKey = this.sessionPrefix + key;
      sessionStorage.removeItem(prefixedKey);
      return true;
    } catch (error) {
      console.error('Failed to remove from sessionStorage:', error);
      return false;
    }
  }

  /**
   * Clear all session data
   */
  clearSession() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.sessionPrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
      return false;
    }
  }

  /**
   * Save quiz configuration
   */
  saveQuizConfig(config) {
    return this.setLocal('config', config);
  }

  /**
   * Get saved quiz configuration
   */
  getQuizConfig() {
    return this.getLocal('config', {
      timerMode: 'none',
      examTime: 60,
      sectionTime: 15,
      questionTime: 2,
      numQuestions: 10,
      randomize: true,
      passingScore: 70,
      showCorrectAnswers: true,
      enableAI: true,
      importLimits: {
        maxFiles: 5,
        maxTotalSizeMB: 10,
        maxRowsPerFile: 1000
      }
    });
  }

  /**
   * Save quiz progress
   */
  saveQuizProgress(progress) {
    return this.setSession('progress', {
      ...progress,
      timestamp: Date.now()
    });
  }

  /**
   * Get saved quiz progress
   */
  getQuizProgress() {
    const progress = this.getSession('progress');
    
    // Check if progress is recent (within 24 hours)
    if (progress && progress.timestamp) {
      const hoursDiff = (Date.now() - progress.timestamp) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        this.removeSession('progress');
        return null;
      }
    }
    
    return progress;
  }

  /**
   * Save quiz results
   */
  saveQuizResults(results) {
    const resultHistory = this.getLocal('results_history', []);
    
    const newResult = {
      ...results,
      id: Date.now().toString(),
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    resultHistory.unshift(newResult);
    
    // Keep only last 10 results
    const trimmedHistory = resultHistory.slice(0, 10);
    
    return this.setLocal('results_history', trimmedHistory);
  }

  /**
   * Get quiz results history
   */
  getQuizResultsHistory() {
    return this.getLocal('results_history', []);
  }

  /**
   * Get latest quiz result
   */
  getLatestResult() {
    const history = this.getQuizResultsHistory();
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Save user preferences
   */
  saveUserPreferences(preferences) {
    return this.setLocal('preferences', preferences);
  }

  /**
   * Get user preferences
   */
  getUserPreferences() {
    return this.getLocal('preferences', {
      theme: 'light',
      soundEnabled: true,
      animationsEnabled: true,
      autoSave: true,
      fontSize: 'medium'
    });
  }

  /**
   * Check localStorage availability
   */
  isLocalStorageAvailable() {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check sessionStorage availability
   */
  isSessionStorageAvailable() {
    try {
      const testKey = '__test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats() {
    const localUsed = new Blob(Object.values(localStorage)).size;
    const sessionUsed = new Blob(Object.values(sessionStorage)).size;
    
    return {
      localStorage: {
        used: localUsed,
        available: this.isLocalStorageAvailable()
      },
      sessionStorage: {
        used: sessionUsed,
        available: this.isSessionStorageAvailable()
      }
    };
  }

  /**
   * Export all quiz data
   */
  exportAllData() {
    try {
      const data = {
        config: this.getQuizConfig(),
        preferences: this.getUserPreferences(),
        resultsHistory: this.getQuizResultsHistory(),
        exportDate: new Date().toISOString()
      };
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  /**
   * Import quiz data
   */
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.config) {
        this.saveQuizConfig(data.config);
      }
      
      if (data.preferences) {
        this.saveUserPreferences(data.preferences);
      }
      
      if (data.resultsHistory) {
        this.setLocal('results_history', data.resultsHistory);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
}
