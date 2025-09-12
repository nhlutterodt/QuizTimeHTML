// API Service - Enhanced with Professional Question Bank Integration
export class APIService {
  constructor() {
    this.baseURL = window.location.origin;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generic API request method
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      console.error('API Request failed:', error);
      throw new APIError(
        'Network error or server unavailable',
        0,
        { originalError: error.message }
      );
    }
  }

  // ============================================
  // ENHANCED QUESTION BANK API METHODS
  // ============================================

  /**
   * Upload multiple CSV files to question bank
   */
  async uploadCSVsToQuestionBank(files, options = {}) {
    const formData = new FormData();
    
    // Add files
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Add options
    formData.append('options', JSON.stringify({
      mergeStrategy: options.mergeStrategy || 'skip',
      strictness: options.strictness || 'lenient',
      owner: options.owner || 'user',
      tags: options.tags || [],
      autoCorrect: options.autoCorrect !== false
    }));

    // Optional preset and headersMap
    if (options.preset) formData.append('preset', options.preset);
    if (options.headersMap) formData.append('headersMap', JSON.stringify(options.headersMap));

    try {
      const response = await fetch(`${this.baseURL}/api/upload-csvs`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || 'Multi-CSV upload failed',
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Multi-CSV upload failed:', error);
      throw error;
    }
  }

  /**
   * Get question bank statistics
   */
  async getQuestionBankStats() {
    try {
      return await this.request('/api/question-bank/stats');
    } catch (error) {
      console.error('Failed to get question bank stats:', error);
      throw error;
    }
  }

  /**
   * Export question bank in various formats
   */
  async exportQuestionBank(format = 'csv', options = {}) {
    try {
      const queryParams = new URLSearchParams({
        format,
        ...options
      });
      
      const response = await fetch(`${this.baseURL}/api/question-bank/export?${queryParams}`);
      
      if (!response.ok) {
        throw new APIError('Export failed', response.status);
      }

      if (format === 'json') {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Migrate existing questions to question bank
   */
  async migrateExistingQuestions() {
    try {
      return await this.request('/api/migrate-existing-questions', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Search questions in the bank
   */
  async searchQuestions(searchParams = {}) {
    try {
      const queryParams = new URLSearchParams({
        category: searchParams.category || '',
        difficulty: searchParams.difficulty || '',
        tags: (searchParams.tags || []).join(','),
        search: searchParams.search || '',
        limit: searchParams.limit || 50,
        offset: searchParams.offset || 0
      });

      return await this.request(`/api/question-bank/search?${queryParams}`);
    } catch (error) {
      console.error('Question search failed:', error);
      throw error;
    }
  }

  /**
   * Add or update a single question
   */
  async saveQuestion(questionData, isUpdate = false) {
    try {
      const endpoint = isUpdate ? 
        `/api/question-bank/questions/${questionData.id}` : 
        '/api/question-bank/questions';
      
      const method = isUpdate ? 'PUT' : 'POST';

      return await this.request(endpoint, {
        method,
        body: JSON.stringify(questionData)
      });
    } catch (error) {
      console.error('Save question failed:', error);
      throw error;
    }
  }

  /**
   * Delete a question from the bank
   */
  async deleteQuestion(questionId) {
    try {
      return await this.request(`/api/question-bank/questions/${questionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Delete question failed:', error);
      throw error;
    }
  }

  // ============================================
  // EXISTING AI ASSESSMENT METHODS (Enhanced)
  // ============================================

  /**
   * Check if AI assessment is available
   */
  async checkAIAvailability() {
    try {
      const result = await this.request('/api/check-ai');
      return {
        available: result.available,
        message: result.message || ''
      };
    } catch (error) {
      console.error('AI availability check failed:', error);
      return {
        available: false,
        message: error.message || 'AI service unavailable'
      };
    }
  }

  /**
   * Submit quiz results for AI assessment
   */
  async submitForAIAssessment(quizData) {
    try {
      const response = await this.request('/api/assess', {
        method: 'POST',
        body: JSON.stringify(quizData)
      });

      return {
        success: true,
        assessment: response.assessment,
        recommendations: response.recommendations || [],
        strengths: response.strengths || [],
        improvements: response.improvements || []
      };
    } catch (error) {
      console.error('AI assessment failed:', error);
      
      // Handle specific OpenAI errors with user-friendly messages
      const errorHandling = this.handleAIError(error);
      
      return {
        success: false,
        error: errorHandling.message,
        type: errorHandling.type,
        retryable: errorHandling.retryable
      };
    }
  }

  /**
   * Handle AI-specific errors with user-friendly messages
   */
  handleAIError(error) {
    const errorData = error.data || {};
    
    switch (error.status) {
      case 429:
        if (errorData.type === 'insufficient_quota') {
          return {
            message: 'AI assessment is temporarily unavailable due to quota limits. Please try again later or contact support.',
            type: 'quota_exceeded',
            retryable: true
          };
        } else {
          return {
            message: 'AI service is experiencing high demand. Please wait a moment and try again.',
            type: 'rate_limit',
            retryable: true
          };
        }
      
      case 401:
        return {
          message: 'AI service authentication failed. Please contact support.',
          type: 'authentication',
          retryable: false
        };
      
      case 400:
        if (errorData.type === 'context_length_exceeded') {
          return {
            message: 'Your quiz is too large for AI assessment. Try with fewer questions.',
            type: 'content_too_large',
            retryable: false
          };
        } else {
          return {
            message: 'Invalid request format. Please try again.',
            type: 'invalid_request',
            retryable: false
          };
        }
      
      case 500:
      case 502:
      case 503:
        return {
          message: 'AI service is temporarily unavailable. Please try again in a few minutes.',
          type: 'server_error',
          retryable: true
        };
      
      default:
        return {
          message: error.message || 'AI assessment failed. Please try again.',
          type: 'unknown',
          retryable: true
        };
    }
  }

  /**
   * Upload and process CSV file
   */
  async uploadCSV(file) {
    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const response = await fetch(`${this.baseURL}/api/upload-csv`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || 'CSV upload failed',
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      console.error('CSV upload failed:', error);
      throw error;
    }
  }

  /**
   * Get server health status
   */
  async getHealthStatus() {
    try {
      const response = await this.request('/api/health');
      return {
        healthy: true,
        ...response
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Save quiz results to server
   */
  async saveResults(results) {
    try {
      const response = await this.request('/api/save-results', {
        method: 'POST',
        body: JSON.stringify(results)
      });

      return {
        success: true,
        resultId: response.resultId
      };
    } catch (error) {
      console.error('Failed to save results:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get saved results
   */
  async getResults(resultId) {
    try {
      const response = await this.request(`/api/results/${resultId}`);
      return {
        success: true,
        results: response
      };
    } catch (error) {
      console.error('Failed to get results:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Request AI question supplementation
   * @param {Object} options - Supplementation request options
   * @returns {Promise<Object>} Supplementation result
   */
  async supplementQuestions(options) {
    try {
      return await this.request('/api/supplement-questions', {
        method: 'POST',
        body: JSON.stringify(options)
      });
    } catch (error) {
      console.error('Question supplementation failed:', error);
      throw error;
    }
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, status = 0, data = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}
