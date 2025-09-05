// Validation Helper Utilities
export class ValidationHelpers {
  
  /**
   * Validate configuration object
   */
  static validateQuizConfig(config) {
    const errors = [];
    
    // Required fields
    if (!config.csvFile) {
      errors.push('CSV file is required');
    }
    
    // Timer validation
    if (config.timerMode && !['exam', 'section', 'question'].includes(config.timerMode)) {
      errors.push('Timer mode must be one of: exam, section, question');
    }
    
    if (config.examTime && (isNaN(config.examTime) || config.examTime <= 0)) {
      errors.push('Exam time must be a positive number');
    }
    
    if (config.sectionTime && (isNaN(config.sectionTime) || config.sectionTime <= 0)) {
      errors.push('Section time must be a positive number');
    }
    
    if (config.questionTime && (isNaN(config.questionTime) || config.questionTime <= 0)) {
      errors.push('Question time must be a positive number');
    }
    
    // Numeric validations
    if (config.numQuestions && (isNaN(config.numQuestions) || config.numQuestions <= 0)) {
      errors.push('Number of questions must be a positive number');
    }
    
    if (config.passingScore && (isNaN(config.passingScore) || config.passingScore < 0 || config.passingScore > 100)) {
      errors.push('Passing score must be between 0 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate question data structure
   */
  static validateQuestion(question) {
    const errors = [];
    
    if (!question.question || typeof question.question !== 'string') {
      errors.push('Question text is required and must be a string');
    }
    
    if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
      errors.push('Question must have at least one option');
    }
    
    if (question.answer === undefined || question.answer === null) {
      errors.push('Question must have a correct answer');
    }
    
    // Validate answer is within options range
    if (question.options && Array.isArray(question.options)) {
      const answerIndex = parseInt(question.answer);
      if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) {
        errors.push('Answer must be a valid option index');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate CSV data structure
   */
  static validateCSVData(data) {
    const errors = [];
    
    if (!Array.isArray(data) || data.length === 0) {
      errors.push('CSV data must be a non-empty array');
      return { isValid: false, errors };
    }
    
    // Check headers
    const expectedHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const headers = Object.keys(data[0]);
    
    expectedHeaders.forEach(header => {
      if (!headers.includes(header)) {
        errors.push(`Missing required column: ${header}`);
      }
    });
    
    // Validate each row
    data.forEach((row, index) => {
      const rowErrors = [];
      
      if (!row.Question || row.Question.trim() === '') {
        rowErrors.push(`Row ${index + 1}: Question is required`);
      }
      
      const options = [row['Option A'], row['Option B'], row['Option C'], row['Option D']];
      const validOptions = options.filter(opt => opt && opt.trim() !== '');
      
      if (validOptions.length < 2) {
        rowErrors.push(`Row ${index + 1}: At least 2 options are required`);
      }
      
      const correctAnswer = row['Correct Answer'];
      if (!correctAnswer || !['A', 'B', 'C', 'D'].includes(correctAnswer.toUpperCase())) {
        rowErrors.push(`Row ${index + 1}: Correct answer must be A, B, C, or D`);
      }
      
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      validRows: data.length - errors.filter(e => e.includes('Row')).length
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate file extension
   */
  static validateFileExtension(filename, allowedExtensions) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }
    
    const extension = filename.split('.').pop().toLowerCase();
    return allowedExtensions.includes(extension);
  }

  /**
   * Sanitize HTML content
   */
  static sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Validate numeric input with range
   */
  static validateNumber(value, min = null, max = null) {
    const num = Number(value);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Must be a valid number' };
    }
    
    if (min !== null && num < min) {
      return { valid: false, error: `Must be at least ${min}` };
    }
    
    if (max !== null && num > max) {
      return { valid: false, error: `Must be no more than ${max}` };
    }
    
    return { valid: true };
  }

  /**
   * Validate string length
   */
  static validateStringLength(str, minLength = 0, maxLength = Infinity) {
    if (typeof str !== 'string') {
      return { valid: false, error: 'Must be a string' };
    }
    
    if (str.length < minLength) {
      return { valid: false, error: `Must be at least ${minLength} characters` };
    }
    
    if (str.length > maxLength) {
      return { valid: false, error: `Must be no more than ${maxLength} characters` };
    }
    
    return { valid: true };
  }

  /**
   * Check if object has required properties
   */
  static hasRequiredProperties(obj, requiredProps) {
    const missing = requiredProps.filter(prop => !(prop in obj));
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Validate array contains only specific types
   */
  static validateArrayTypes(arr, expectedType) {
    if (!Array.isArray(arr)) {
      return { valid: false, error: 'Must be an array' };
    }
    
    const invalidItems = arr.filter(item => typeof item !== expectedType);
    
    return {
      valid: invalidItems.length === 0,
      error: invalidItems.length > 0 ? `All items must be of type ${expectedType}` : null
    };
  }
}
