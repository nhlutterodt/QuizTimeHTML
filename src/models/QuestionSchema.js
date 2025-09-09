// Question Schema and Data Model
// Provides a unified, extensible schema for questions across the application

export class QuestionSchema {
  /**
   * Core question schema definition
   * This is the canonical structure for all questions in the system
   */
  static get CORE_SCHEMA() {
    return {
      // Required fields
      id: {
        type: 'number',
        required: true,
        description: 'Unique identifier for the question'
      },
      question: {
        type: 'string',
        required: true,
        minLength: 1,
        description: 'The question text'
      },
      type: {
        type: 'string',
        required: true,
        enum: ['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching'],
        default: 'multiple_choice',
        description: 'Question type'
      },
      
      // Multiple choice specific fields
      options: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        description: 'Answer options for multiple choice questions'
      },
      correct_answer: {
        type: 'string',
        description: 'Correct answer (letter for MC, true/false for boolean, text for others)'
      },
      
      // Metadata fields
      category: {
        type: 'string',
        default: 'General',
        description: 'Question category'
      },
      difficulty: {
        type: 'string',
        enum: ['Easy', 'Medium', 'Hard', 'Expert'],
        default: 'Medium',
        description: 'Question difficulty level'
      },
      points: {
        type: 'number',
        default: 1,
        min: 0,
        description: 'Points awarded for correct answer'
      },
      time_limit: {
        type: 'number',
        default: 30,
        min: 0,
        description: 'Time limit in seconds'
      },
      explanation: {
        type: 'string',
        default: '',
        description: 'Explanation for the correct answer'
      },
      
      // Extensible fields for future enhancements
      tags: {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Question tags for filtering and categorization'
      },
      prerequisites: {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Required knowledge or previous questions'
      },
      learning_objectives: {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Learning objectives this question addresses'
      },
      media: {
        type: 'object',
        properties: {
          images: { type: 'array', items: { type: 'string' } },
          audio: { type: 'array', items: { type: 'string' } },
          video: { type: 'array', items: { type: 'string' } }
        },
        default: {},
        description: 'Media attachments'
      },
      
      // Provenance and metadata
      source: {
        type: 'object',
        properties: {
          uploadId: { type: 'string' },
          filename: { type: 'string' },
          rowIndex: { type: 'number' },
          created: { type: 'string', format: 'date-time' },
          lastUpdated: { type: 'string', format: 'date-time' },
          owner: { type: 'string' },
          version: { type: 'string', default: '1.0.0' }
        },
        description: 'Question provenance and metadata'
      },
      
      // Analytics and performance tracking
      analytics: {
        type: 'object',
        properties: {
          timesUsed: { type: 'number', default: 0 },
          correctAnswers: { type: 'number', default: 0 },
          totalAttempts: { type: 'number', default: 0 },
          averageTime: { type: 'number', default: 0 },
          lastUsed: { type: 'string', format: 'date-time' }
        },
        default: {},
        description: 'Question usage analytics'
      }
    };
  }

  /**
   * CSV field mapping for flexible imports
   * Maps various CSV header formats to our canonical schema
   */
  static get CSV_FIELD_MAPPING() {
    return {
      // Question text mappings
      question: ['question', 'question_text', 'text', 'problem', 'prompt'],
      
      // ID mappings
      id: ['id', 'question_id', 'qid', 'number', '#'],
      
      // Type mappings
      type: ['type', 'question_type', 'format', 'style'],
      
      // Options mappings
      option_a: ['option_a', 'a', 'choice_a', 'answer_a', 'option1'],
      option_b: ['option_b', 'b', 'choice_b', 'answer_b', 'option2'],
      option_c: ['option_c', 'c', 'choice_c', 'answer_c', 'option3'],
      option_d: ['option_d', 'd', 'choice_d', 'answer_d', 'option4'],
      option_e: ['option_e', 'e', 'choice_e', 'answer_e', 'option5'],
      
      // Correct answer mappings
      correct_answer: ['correct_answer', 'correct', 'answer', 'solution', 'key'],
      
      // Metadata mappings
      category: ['category', 'subject', 'topic', 'domain', 'area'],
      difficulty: ['difficulty', 'level', 'complexity', 'grade'],
      points: ['points', 'score', 'weight', 'value', 'marks'],
      time_limit: ['time_limit', 'time', 'duration', 'seconds', 'timeout'],
      explanation: ['explanation', 'rationale', 'why', 'reason', 'detail'],
      
      // Extended fields
      tags: ['tags', 'keywords', 'labels', 'topics'],
      prerequisites: ['prerequisites', 'prereqs', 'requires', 'depends_on'],
      learning_objectives: ['learning_objectives', 'objectives', 'goals', 'outcomes'],
      
      // Media
      image: ['image', 'img', 'picture', 'figure'],
      audio: ['audio', 'sound', 'recording'],
      video: ['video', 'clip', 'movie']
    };
  }

  /**
   * Normalize field name to canonical schema field
   */
  static normalizeFieldName(csvHeader) {
    const normalized = csvHeader.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Check direct mapping
    for (const [schemaField, csvVariants] of Object.entries(this.CSV_FIELD_MAPPING)) {
      if (csvVariants.includes(normalized)) {
        return schemaField;
      }
    }
    
    // If no mapping found, return normalized name for custom fields
    return normalized;
  }

  /**
   * Create default question object with proper structure
   */
  static createDefault(overrides = {}) {
    const defaults = {
      id: null,
      question: '',
      type: 'multiple_choice',
      options: [],
      correct_answer: '',
      category: 'General',
      difficulty: 'Medium',
      points: 1,
      time_limit: 30,
      explanation: '',
      tags: [],
      prerequisites: [],
      learning_objectives: [],
      media: {},
      source: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      },
      analytics: {
        timesUsed: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        averageTime: 0
      }
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Validate question against schema
   */
  static validate(question) {
    const errors = [];
    const warnings = [];
    const schema = this.CORE_SCHEMA;

    // Check required fields
    for (const [field, definition] of Object.entries(schema)) {
      if (definition.required && (!question[field] || question[field] === '')) {
        errors.push(`Required field '${field}' is missing or empty`);
      }
    }

    // Type-specific validation
    if (question.type === 'multiple_choice') {
      if (!question.options || question.options.length < 2) {
        errors.push('Multiple choice questions must have at least 2 options');
      }
      
      if (question.correct_answer) {
        const answerLetter = question.correct_answer.toUpperCase();
        const answerIndex = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(answerLetter);
        if (answerIndex === -1 || answerIndex >= question.options.length) {
          errors.push(`Correct answer '${question.correct_answer}' doesn't match available options`);
        }
      }
    }

    // Value validation
    if (question.points !== undefined && question.points < 0) {
      errors.push('Points cannot be negative');
    }

    if (question.time_limit !== undefined && question.time_limit < 0) {
      errors.push('Time limit cannot be negative');
    }

    // Warnings for missing optional but recommended fields
    if (!question.explanation || question.explanation.trim() === '') {
      warnings.push('No explanation provided');
    }

    if (!question.category || question.category === 'General') {
      warnings.push('Question not categorized');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize and normalize question data
   */
  static sanitize(question) {
    const sanitized = { ...question };

    // Trim strings
    if (sanitized.question) sanitized.question = sanitized.question.trim();
    if (sanitized.explanation) sanitized.explanation = sanitized.explanation.trim();
    if (sanitized.category) sanitized.category = sanitized.category.trim();

    // Normalize arrays
    if (sanitized.options) {
      sanitized.options = sanitized.options
        .filter(opt => opt && opt.trim() !== '')
        .map(opt => opt.trim());
    }

    if (sanitized.tags) {
      sanitized.tags = sanitized.tags
        .filter(tag => tag && tag.trim() !== '')
        .map(tag => tag.trim().toLowerCase());
    }

    // Ensure numeric fields are numbers
    if (sanitized.id !== undefined) sanitized.id = parseInt(sanitized.id) || null;
    if (sanitized.points !== undefined) sanitized.points = parseInt(sanitized.points) || 1;
    if (sanitized.time_limit !== undefined) sanitized.time_limit = parseInt(sanitized.time_limit) || 30;

    // Normalize correct answer
    if (sanitized.correct_answer && sanitized.type === 'multiple_choice') {
      sanitized.correct_answer = sanitized.correct_answer.toString().toUpperCase();
    }

    return sanitized;
  }

  /**
   * Convert from CSV row to question format
   */
  static fromCSVRow(csvRow, headers, metadata = {}) {
    const question = this.createDefault();

    // Map CSV fields to schema fields
    headers.forEach((header, index) => {
      const normalizedField = this.normalizeFieldName(header);
      const value = csvRow[index];

      if (value !== undefined && value !== '') {
        // Handle special field mappings
        if (normalizedField.startsWith('option_')) {
          if (!question.options) question.options = [];
          question.options.push(value.trim());
        } else if (normalizedField === 'tags' && typeof value === 'string') {
          question.tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        } else if (normalizedField === 'prerequisites' && typeof value === 'string') {
          question.prerequisites = value.split(',').map(p => p.trim()).filter(p => p);
        } else if (normalizedField === 'learning_objectives' && typeof value === 'string') {
          question.learning_objectives = value.split(',').map(obj => obj.trim()).filter(obj => obj);
        } else {
          question[normalizedField] = value;
        }
      }
    });

    // Add metadata
    if (metadata.uploadId) question.source.uploadId = metadata.uploadId;
    if (metadata.filename) question.source.filename = metadata.filename;
    if (metadata.rowIndex !== undefined) question.source.rowIndex = metadata.rowIndex;
    if (metadata.owner) question.source.owner = metadata.owner;

    return this.sanitize(question);
  }

  /**
   * Convert to legacy format for backwards compatibility
   */
  static toLegacyFormat(question) {
    return {
      id: question.id,
      text: question.question, // Legacy field name
      options: question.options || [],
      answer: question.options ? question.options.findIndex(opt => 
        opt === question.correct_answer || 
        ['A', 'B', 'C', 'D', 'E'][question.options.indexOf(opt)] === question.correct_answer
      ) : -1,
      correct: [question.correct_answer], // Legacy array format
      explanation: question.explanation || '',
      category: question.category || 'General',
      difficulty: question.difficulty || 'Medium',
      points: question.points || 1,
      timeLimit: question.time_limit || 30,
      section: question.category // Legacy field mapping
    };
  }

  /**
   * Convert from legacy format to current schema
   */
  static fromLegacyFormat(legacyQuestion) {
    const question = this.createDefault({
      id: legacyQuestion.id,
      question: legacyQuestion.text || legacyQuestion.question,
      options: legacyQuestion.options || [],
      category: legacyQuestion.category || legacyQuestion.section || 'General',
      difficulty: legacyQuestion.difficulty || 'Medium',
      points: legacyQuestion.points || 1,
      time_limit: legacyQuestion.timeLimit || legacyQuestion.time_limit || 30,
      explanation: legacyQuestion.explanation || ''
    });

    // Handle correct answer conversion
    if (legacyQuestion.answer !== undefined && question.options.length > 0) {
      const answerIndex = parseInt(legacyQuestion.answer);
      if (answerIndex >= 0 && answerIndex < question.options.length) {
        question.correct_answer = ['A', 'B', 'C', 'D', 'E'][answerIndex];
      }
    } else if (legacyQuestion.correct && Array.isArray(legacyQuestion.correct)) {
      question.correct_answer = legacyQuestion.correct[0];
    }

    return question;
  }

  /**
   * Get schema version for migration purposes
   */
  static getSchemaVersion() {
    return '2.0.0';
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(question) {
    // Check if it's in legacy format
    return (
      question.text && !question.question || // Old field names
      typeof question.answer === 'number' || // Old answer format
      !question.source || // Missing metadata
      !question.analytics // Missing analytics
    );
  }
}

export default QuestionSchema;
