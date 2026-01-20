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
   * Validate CSV data structure with flexible header support
   */
  static validateCSVData(data) {
    const errors = [];
    
    if (!Array.isArray(data) || data.length === 0) {
      errors.push('CSV data must be a non-empty array');
      return { isValid: false, errors };
    }
    
    // Normalize string: lowercase, remove special chars
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Define required fields and their possible aliases
    const fieldMappings = {
      'Question': ['question', 'questiontext', 'text', 'problem'],
      'Option A': ['optiona', 'option_a', 'choicea', 'a', 'option1'],
      'Option B': ['optionb', 'option_b', 'choiceb', 'b', 'option2'],
      'Option C': ['optionc', 'option_c', 'choicec', 'c', 'option3'],
      'Option D': ['optiond', 'option_d', 'choiced', 'd', 'option4'],
      'Correct Answer': ['correctanswer', 'correct_answer', 'answer', 'correct', 'solution', 'key']
    };

    const headers = Object.keys(data[0]);
    const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalize(h) }));
    
    // Check if required fields exist
    const columnMap = {}; // Maps required field -> actual header in CSV
    
    Object.entries(fieldMappings).forEach(([field, aliases]) => {
      // 1. Check exact match first
      let match = headers.find(h => h === field);
      
      // 2. Check aliases match (normalized)
      if (!match) {
        const fieldNorm = normalize(field);
        match = headers.find(h => {
          const hNorm = normalize(h);
          return hNorm === fieldNorm || aliases.includes(hNorm);
        });
      }
      
      if (match) {
        columnMap[field] = match;
      } else {
        errors.push(`Missing required column: ${field} (or valid alias)`);
      }
    });
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    // Validate each row
    data.forEach((row, index) => {
      const rowErrors = [];
      const getVal = (field) => row[columnMap[field]];
      
      const question = getVal('Question');
      if (!question || String(question).trim() === '') {
        rowErrors.push(`Row ${index + 1}: Question is required`);
      }
      
      const options = [
        getVal('Option A'), 
        getVal('Option B'), 
        getVal('Option C'), 
        getVal('Option D')
      ];
      const validOptions = options.filter(opt => opt && String(opt).trim() !== '');
      
      if (validOptions.length < 2) {
        rowErrors.push(`Row ${index + 1}: At least 2 options are required`);
      }
      
      const correctAnswer = getVal('Correct Answer');
      if (!correctAnswer || !['A', 'B', 'C', 'D'].includes(String(correctAnswer).toUpperCase())) {
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
