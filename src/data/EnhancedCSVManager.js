// Enhanced CSV Question Manager with Schema Integration
import QuestionSchema from '../models/QuestionSchema.js';

export class EnhancedCSVManager {
  constructor() {
    this.questions = [];
    this.categories = new Set();
    this.difficulties = new Set();
    this.tags = new Set();
    this.parseErrors = [];
    this.parseWarnings = [];
  this.lastParseSnapshot = null;
  }

  /**
   * Parse CSV content with enhanced error handling and schema validation
   */
  async parseCSV(csvContent, options = {}) {
    const {
      strictValidation = false,
      autoCorrect = true,
      preserveCustomFields = true,
  batchSize = 1000,
  snapshotRowLimit = 50
    } = options;

    this.clearState();
    
    try {
      const { headers, rows } = this.parseCSVStructure(csvContent);
      console.log(`📊 Parsed CSV: ${headers.length} columns, ${rows.length} rows`);

      // Validate headers
      const headerValidation = this.validateHeaders(headers);
      if (!headerValidation.isValid && strictValidation) {
        throw new Error(`Header validation failed: ${headerValidation.errors.join(', ')}`);
      }

      // Process rows in batches for memory efficiency
      const results = await this.processRowsBatched(headers, rows, {
        batchSize,
        strictValidation,
        autoCorrect,
        preserveCustomFields
      });

      this.updateCollections();
      
      // Create parse snapshot using extracted helper
      this.lastParseSnapshot = this.createParseSnapshot(headers, rows.length, snapshotRowLimit);
      
      return {
        questions: this.questions,
        summary: {
          total: rows.length,
          successful: this.questions.length,
          errors: this.parseErrors.length,
          warnings: this.parseWarnings.length
        },
        errors: this.parseErrors,
        warnings: this.parseWarnings,
        collections: {
          categories: Array.from(this.categories),
          difficulties: Array.from(this.difficulties),
          tags: Array.from(this.tags)
        },
        // Provide the stable snapshot for consumers (UI) to display row-level issues
        lastParseSnapshot: this.lastParseSnapshot
      };

    } catch (error) {
      console.error('CSV parsing failed:', error);
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse CSV structure handling quotes and escapes properly
   */
  parseCSVStructure(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty CSV content');
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);
    const rows = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines

      try {
        const row = this.parseCSVLine(line);
        if (row.length > 0) {
          // Pad row to match header length
          while (row.length < headers.length) {
            row.push('');
          }
          rows.push(row);
        }
      } catch (error) {
        this.parseErrors.push({
          line: i + 1,
          content: line,
          error: error.message
        });
      }
    }

    return { headers, rows };
  }

  /**
   * Enhanced CSV line parsing with better quote handling
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add final field
    result.push(current.trim());

    return result;
  }

  /**
   * Validate CSV headers against expected fields
   */
  validateHeaders(headers) {
    const errors = [];
    const warnings = [];
    const normalizedHeaders = headers.map(h => QuestionSchema.normalizeFieldName(h));

    // Check for required fields
    const hasQuestion = normalizedHeaders.some(h => 
      ['question', 'question_text', 'text'].includes(h)
    );
    
    if (!hasQuestion) {
      errors.push('Missing required question field (question, question_text, or text)');
    }

    // Check for multiple choice structure
    const hasOptions = normalizedHeaders.some(h => h.startsWith('option_'));
    const hasCorrectAnswer = normalizedHeaders.some(h => 
      ['correct_answer', 'correct', 'answer'].includes(h)
    );

    if (hasOptions && !hasCorrectAnswer) {
      warnings.push('Found option fields but no correct answer field');
    }

    // Check for duplicates
    const duplicates = headers.filter((header, index) => 
      headers.indexOf(header) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate headers found: ${duplicates.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedHeaders
    };
  }

  /**
   * Process rows in batches for memory efficiency
   */
  async processRowsBatched(headers, rows, options) {
    const { batchSize } = options;
    const results = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchResults = await this.processBatch(headers, batch, i, options);
      results.push(...batchResults);

      // Allow event loop to breathe
      if (i % (batchSize * 5) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return results;
  }

  /**
   * Process a batch of rows
   */
  async processBatch(headers, rows, startIndex, options) {
    const { strictValidation, autoCorrect, preserveCustomFields } = options;
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = startIndex + i;
      const row = rows[i];

      try {
        const question = this.processRow(headers, row, rowIndex, {
          autoCorrect,
          preserveCustomFields
        });

        // Validate question
        const validation = QuestionSchema.validate(question);
        
        if (!validation.isValid) {
          if (strictValidation) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
          } else {
            this.parseErrors.push({
              line: rowIndex + 2, // +2 for header and 0-based index
              error: `Validation failed: ${validation.errors.join(', ')}`,
              question: question.question || 'Unknown'
            });
            continue;
          }
        }

        // Add warnings
        validation.warnings.forEach(warning => {
          this.parseWarnings.push({
            line: rowIndex + 2,
            warning,
            question: question.question || 'Unknown'
          });
        });

        this.questions.push(question);
        results.push(question);

      } catch (error) {
        this.parseErrors.push({
          line: rowIndex + 2,
          error: error.message,
          content: row.join(',')
        });

        if (strictValidation) {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Process individual row to question
   */
  processRow(headers, row, rowIndex, options = {}) {
    const { autoCorrect = true, preserveCustomFields = true } = options;

    // Create question from CSV row
    const question = QuestionSchema.fromCSVRow(row, headers, {
      rowIndex,
      created: new Date().toISOString()
    });

    // Auto-correct common issues
    if (autoCorrect) {
      this.autoCorrectQuestion(question);
    }

    // Preserve custom fields if requested
    if (preserveCustomFields) {
      headers.forEach((header, index) => {
        const normalizedField = QuestionSchema.normalizeFieldName(header);
        if (!QuestionSchema.CORE_SCHEMA[normalizedField] && row[index]) {
          if (!question.custom_fields) question.custom_fields = {};
          question.custom_fields[normalizedField] = row[index];
        }
      });
    }

    return question;
  }

  /**
   * Auto-correct common issues in questions
   */
  autoCorrectQuestion(question) {
    // Fix common answer format issues
    if (question.correct_answer && question.options.length > 0) {
      const answer = question.correct_answer.toString().trim();
      
      // If it's a number, convert to letter
      if (/^\d+$/.test(answer)) {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < question.options.length) {
          question.correct_answer = ['A', 'B', 'C', 'D', 'E', 'F'][index];
        }
      }
      
      // If it's the actual answer text, find the letter
      if (answer.length > 1) {
        const matchIndex = question.options.findIndex(opt => 
          opt.toLowerCase().trim() === answer.toLowerCase().trim()
        );
        if (matchIndex !== -1) {
          question.correct_answer = ['A', 'B', 'C', 'D', 'E', 'F'][matchIndex];
        }
      }
    }

    // Standardize difficulty levels
    if (question.difficulty) {
      const diff = question.difficulty.toLowerCase();
      if (['1', 'beginner', 'basic', 'simple'].includes(diff)) {
        question.difficulty = 'Easy';
      } else if (['2', 'intermediate', 'normal', 'average'].includes(diff)) {
        question.difficulty = 'Medium';
      } else if (['3', 'advanced', 'difficult', 'challenging'].includes(diff)) {
        question.difficulty = 'Hard';
      } else if (['4', '5', 'expert', 'master', 'professional'].includes(diff)) {
        question.difficulty = 'Expert';
      }
    }

    // Clean and standardize tags
    if (question.tags) {
      question.tags = question.tags
        .map(tag => tag.toString().toLowerCase().trim())
        .filter(tag => tag.length > 0)
        .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
    }

    // Ensure positive numeric values
    if (question.points !== undefined && question.points < 0) {
      question.points = 1;
    }
    if (question.time_limit !== undefined && question.time_limit < 0) {
      question.time_limit = 30;
    }
  }

  /**
   * Update internal collections
   */
  updateCollections() {
    this.categories.clear();
    this.difficulties.clear();
    this.tags.clear();

    this.questions.forEach(question => {
      if (question.category) this.categories.add(question.category);
      if (question.difficulty) this.difficulties.add(question.difficulty);
      if (question.tags) {
        question.tags.forEach(tag => this.tags.add(tag));
      }
    });
  }

  /**
   * Clear internal state
   */
  clearState() {
    this.questions = [];
    this.parseErrors = [];
    this.parseWarnings = [];
    this.categories.clear();
    this.difficulties.clear();
    this.tags.clear();
  }

  /**
   * Export questions to CSV with schema compliance
   */
  exportToCSV(questions = null, options = {}) {
    const questionsToExport = questions || this.questions;
    const {
      includeCustomFields = true,
      includeMetadata = false,
      includeAnalytics = false
    } = options;

    if (questionsToExport.length === 0) {
      return '';
    }

    // Build headers
    const headers = [
      'id', 'question', 'type', 'option_a', 'option_b', 'option_c', 'option_d',
      'correct_answer', 'category', 'difficulty', 'points', 'time_limit',
      'explanation', 'tags', 'prerequisites', 'learning_objectives'
    ];

    if (includeMetadata) {
      headers.push('source_filename', 'created', 'last_updated', 'owner', 'version');
    }

    if (includeAnalytics) {
      headers.push('times_used', 'correct_answers', 'total_attempts', 'average_time');
    }

    // Add custom field headers
    if (includeCustomFields) {
      const customFields = new Set();
      questionsToExport.forEach(q => {
        if (q.custom_fields) {
          Object.keys(q.custom_fields).forEach(field => customFields.add(field));
        }
      });
      headers.push(...Array.from(customFields));
    }

    // Build CSV content
    const csvLines = [headers.join(',')];

    questionsToExport.forEach(question => {
      const row = [];

      // Standard fields
      row.push(this.escapeCSVValue(question.id || ''));
      row.push(this.escapeCSVValue(question.question || ''));
      row.push(this.escapeCSVValue(question.type || ''));
      
      // Options (pad to 4)
      for (let i = 0; i < 4; i++) {
        row.push(this.escapeCSVValue(question.options?.[i] || ''));
      }
      
      row.push(this.escapeCSVValue(question.correct_answer || ''));
      row.push(this.escapeCSVValue(question.category || ''));
      row.push(this.escapeCSVValue(question.difficulty || ''));
      row.push(this.escapeCSVValue(question.points || ''));
      row.push(this.escapeCSVValue(question.time_limit || ''));
      row.push(this.escapeCSVValue(question.explanation || ''));
      row.push(this.escapeCSVValue(question.tags?.join(', ') || ''));
      row.push(this.escapeCSVValue(question.prerequisites?.join(', ') || ''));
      row.push(this.escapeCSVValue(question.learning_objectives?.join(', ') || ''));

      // Metadata
      if (includeMetadata) {
        row.push(this.escapeCSVValue(question.source?.filename || ''));
        row.push(this.escapeCSVValue(question.source?.created || ''));
        row.push(this.escapeCSVValue(question.source?.lastUpdated || ''));
        row.push(this.escapeCSVValue(question.source?.owner || ''));
        row.push(this.escapeCSVValue(question.source?.version || ''));
      }

      // Analytics
      if (includeAnalytics) {
        row.push(this.escapeCSVValue(question.analytics?.timesUsed || 0));
        row.push(this.escapeCSVValue(question.analytics?.correctAnswers || 0));
        row.push(this.escapeCSVValue(question.analytics?.totalAttempts || 0));
        row.push(this.escapeCSVValue(question.analytics?.averageTime || 0));
      }

      // Custom fields
      if (includeCustomFields) {
        headers.slice(includeMetadata ? -5 : -0).forEach(header => {
          if (!headers.slice(0, includeMetadata ? -5 : headers.length).includes(header)) {
            row.push(this.escapeCSVValue(question.custom_fields?.[header] || ''));
          }
        });
      }

      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Escape CSV value properly
   */
  escapeCSVValue(value) {
    const str = value.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Get parsing statistics
   */
  getParsingStats() {
    return {
      totalProcessed: this.questions.length + this.parseErrors.length,
      successful: this.questions.length,
      errors: this.parseErrors.length,
      warnings: this.parseWarnings.length,
      successRate: this.questions.length / (this.questions.length + this.parseErrors.length) * 100,
      collections: {
        categories: this.categories.size,
        difficulties: this.difficulties.size,
        tags: this.tags.size
      }
    };
  }

  /**
   * Return a compact snapshot (first N) of errors/warnings from last parse
   */
  getLastParseSnapshotCompact(limit = 10) {
    if (!this.lastParseSnapshot) return null;
    return {
      timestamp: this.lastParseSnapshot.timestamp,
      headers: this.lastParseSnapshot.headers,
      rows: this.lastParseSnapshot.rows,
      totalErrors: this.lastParseSnapshot.totalErrors,
      totalWarnings: this.lastParseSnapshot.totalWarnings,
      compactErrors: (this.lastParseSnapshot.errors || []).slice(0, limit),
      compactWarnings: (this.lastParseSnapshot.warnings || []).slice(0, limit),
      snapshotRowLimit: Math.min(limit, this.lastParseSnapshot.snapshotRowLimit || limit)
    };
  }

  /**
   * Export the full last parse snapshot as JSON string
   */
  exportLastParseSnapshotJSON() {
    if (!this.lastParseSnapshot) return null;
    return JSON.stringify(this.lastParseSnapshot, null, 2);
  }

  /**
   * Create a parse snapshot with errors and warnings - extracted helper for testability
   * @param {Array} headers - CSV headers
   * @param {number} rowCount - Total number of rows processed  
   * @param {number} snapshotRowLimit - Limit for compact errors/warnings
   * @returns {Object} Parse snapshot object
   */
  createParseSnapshot(headers, rowCount, snapshotRowLimit = 50) {
    // Capture a stable snapshot of parse errors/warnings for UI consumption
    const errorsCopy = this.parseErrors.slice();
    const warningsCopy = this.parseWarnings.slice();

    return {
      timestamp: new Date().toISOString(),
      headers,
      rows: rowCount,
      totalErrors: errorsCopy.length,
      totalWarnings: warningsCopy.length,
      errors: errorsCopy,
      warnings: warningsCopy,
      compactErrors: errorsCopy.slice(0, snapshotRowLimit),
      compactWarnings: warningsCopy.slice(0, snapshotRowLimit),
      snapshotRowLimit
    };
  }

  // Legacy compatibility methods
  getAllQuestions() { return [...this.questions]; }
  getCategories() { return Array.from(this.categories); }
  getDifficulties() { return Array.from(this.difficulties); }
  getTags() { return Array.from(this.tags); }
}

export default EnhancedCSVManager;
