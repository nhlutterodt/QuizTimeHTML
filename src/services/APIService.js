// API Service - Handles all server communication
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
