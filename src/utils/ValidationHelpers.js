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
  /**
   * Validate CSV data structure with flexible header support using QuestionSchema
   */
  static validateCSVData(data) {
    // Lazy load the schema check if possible or assume it's available in scope. 
    // Since we can't easily import inside a static method in basic JS modules without top-level import,
    // we assume QuestionSchema is imported or we hardcode the mapping logic to match QuestionSchema 
    // to avoid circular dependency issues if ValidationHelpers is used by QuestionSchema.
    
    // Ideally, we should import QuestionSchema at the top. 
    // Checking imports... ValidationHelpers doesn't import QuestionSchema currently.
    
    if (!Array.isArray(data) || data.length === 0) {
      return { isValid: false, errors: ['CSV data must be a non-empty array'] };
    }
    
    const errors = [];
    const headers = Object.keys(data[0]);
    
    // We will use a simplified validation here that aligns with QuestionSchema
    // but avoids direct dependency to prevent circular refs if any.
    // However, the best practice is to move this logic TO QuestionSchema completely
    // or import QuestionSchema.
    
    // For now, let's keep the logic here but align the mappings with QuestionSchema.CSV_FIELD_MAPPING
    
    // Normalize string: lowercase, remove special chars
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Mappings aligned with QuestionSchema.CSV_FIELD_MAPPING
    const fieldMappings = {
      'question': ['question', 'question_text', 'text', 'problem', 'prompt'],
      'correct_answer': ['correct_answer', 'correct', 'answer', 'solution', 'key', 'correctanswer']
    };

    // Check required fields
    const columnMap = {}; 
    const missingFields = [];

    // 1. Check Question field
    let questionMatch = headers.find(h => {
      const n = normalize(h);
      return fieldMappings.question.some(alias => normalize(alias) === n);
    });
    if (questionMatch) columnMap.question = questionMatch;
    else missingFields.push('Question (or alias like "text", "prompt")');

    // 2. Check Option fields (flexible)
    // We look for at least 2 options for MC, or proceed if it's open text (handled in row validation)
    const optionMatches = headers.filter(h => normalize(h).match(/^option_?[a-z0-9]+$|^[a-e]$|^choice_?[a-z]$/));
    columnMap.options = optionMatches;

    // 3. Check Correct Answer field
    let answerMatch = headers.find(h => {
      const n = normalize(h);
      return fieldMappings.correct_answer.some(alias => normalize(alias) === n);
    });
    if (answerMatch) columnMap.correct_answer = answerMatch;
    else missingFields.push('Correct Answer (or alias like "answer", "key")');

    if (missingFields.length > 0) {
      errors.push(`Missing required columns: ${missingFields.join(', ')}`);
      return { isValid: false, errors };
    }
    
    // Validate rows
    data.forEach((row, index) => {
      const rowErrors = [];
      const getVal = (col) => row[col];
      
      // Validate Question Text
      const qText = getVal(columnMap.question);
      if (!qText || String(qText).trim() === '') {
        rowErrors.push(`Row ${index + 1}: Question text is empty`);
      }
      
      // Validate Options (if MC)
      // Logic: If options exist in headers, we expect meaningful content in them
      if (columnMap.options.length > 0) {
        const validOpts = columnMap.options.map(col => getVal(col)).filter(v => v && String(v).trim() !== '');
        if (validOpts.length < 2) {
          // It might be a non-MC question, but if options cols exist, we usually expect them filled.
          // Relaxing this: only error if NO options and type implies MC? 
          // For now, we enforce 2 options if it looks like an MC structure.
           rowErrors.push(`Row ${index + 1}: Found option columns but fewer than 2 valid options provided`);
        }
      }
      
      // Validate Correct Answer
      const ans = getVal(columnMap.correct_answer);
      if (!ans || String(ans).trim() === '') {
        rowErrors.push(`Row ${index + 1}: Correct answer is empty`);
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
