// Integrated Question Manager
// Professional integration layer between CSV handling and question operations

import QuestionSchema from '../models/QuestionSchema.js';
import EnhancedCSVManager from '../data/EnhancedCSVManager.js';
// ValidationHelpers currently unused here; removed to satisfy linter

export class IntegratedQuestionManager {
  constructor(storageService = null) {
    this.storageService = storageService;
    this.csvManager = new EnhancedCSVManager();
    this.questionBank = [];
    this.metadata = {
      version: QuestionSchema.getSchemaVersion(),
      lastUpdated: new Date().toISOString(),
      totalQuestions: 0
    };
    this.changeListeners = [];
  }

  /**
   * Initialize the manager with existing data
   */
  async initialize(questionBankData = null) {
    if (questionBankData) {
      await this.loadFromData(questionBankData);
    } else if (this.storageService) {
      await this.loadFromStorage();
    }
    
    console.log(`🎯 Question Manager initialized with ${this.questionBank.length} questions`);
    return this;
  }

  /**
   * Load questions from various sources with schema migration
   */
  async loadFromData(data) {
    try {
      let questions = [];
      
      if (Array.isArray(data)) {
        // Direct array of questions
        questions = data;
      } else if (data.questions) {
        // Question bank format
        questions = data.questions;
        if (data.metadata) {
          this.metadata = { ...this.metadata, ...data.metadata };
        }
      }

      // Migrate questions to current schema
      this.questionBank = questions.map(q => this.migrateQuestion(q));
      this.updateMetadata();
      
      console.log(`📚 Loaded ${this.questionBank.length} questions`);
      this.notifyChange('loaded', { count: this.questionBank.length });
      
    } catch (error) {
      console.error('Failed to load question data:', error);
      throw new Error(`Failed to load questions: ${error.message}`);
    }
  }

  /**
   * Load from storage service
   */
  async loadFromStorage() {
    if (!this.storageService) {
      throw new Error('No storage service configured');
    }
    
    try {
      const data = await this.storageService.getQuestionBank();
      if (data) {
        await this.loadFromData(data);
      }
    } catch (error) {
      console.warn('Failed to load from storage, starting fresh:', error);
      this.questionBank = [];
    }
  }

  /**
   * Import questions from CSV with full integration
   */
  async importFromCSV(csvContent, options = {}) {
    const {
      mergeStrategy = 'skip',
      strictValidation = false,
      autoCorrect = true,
      preserveCustomFields = true,
      owner = 'system',
      tags = [],
      uploadId = null
  ,
  // New options for parse snapshot
  snapshotRowLimit = 50,
  includeFullParseReport = false
  ,
  // Schema preset and header mapping passthrough
  preset = null,
  headersMap = null
    } = options;

    try {
      // Parse CSV with enhanced manager
      const parseResult = await this.csvManager.parseCSV(csvContent, {
        strictValidation,
        autoCorrect,
        preserveCustomFields,
        snapshotRowLimit,
        preset,
        headersMap
      });

      // Add metadata to questions
      const uploadIdFinal = uploadId || this.generateUploadId();

      const questionsWithMetadata = parseResult.questions.map(question => ({
        ...question,
        source: {
          ...question.source,
          uploadId: uploadIdFinal,
          owner,
          importedAt: new Date().toISOString(),
          preset: preset || question.source?.preset || null
        },
        tags: [...(question.tags || []), ...tags]
      }));

      // Apply merge strategy
      const mergeResult = await this.mergeQuestions(questionsWithMetadata, mergeStrategy);
      
      // Update question bank
      this.questionBank = mergeResult.questions;
      this.updateMetadata();
      
      // Save if storage service available
      if (this.storageService) {
        await this.saveToStorage();
      }

      // Attach parse snapshot to result for UI
      this.lastImportParseSnapshot = parseResult.lastParseSnapshot || null;

      // Persist upload metadata into bank-level metadata for traceability
      if (!this.metadata.uploads) this.metadata.uploads = [];
      this.metadata.uploads.push({
        uploadId: uploadIdFinal,
        timestamp: new Date().toISOString(),
  preset: preset || this.lastImportParseSnapshot?.preset || null,
  headersMap: headersMap || this.lastImportParseSnapshot?.headersMap || null,
  rows: parseResult.summary?.total || (parseResult.questions || []).length,
        errors: parseResult.errors.length,
        warnings: parseResult.warnings.length
      });

      const result = {
        ...mergeResult,
        parseStats: parseResult.summary,
        parseErrors: parseResult.errors,
        parseWarnings: parseResult.warnings,
        collections: parseResult.collections,
        lastParseSnapshot: this.lastImportParseSnapshot,
        // compact summary for quick UI display
        compactParseSnapshot: this.csvManager.getLastParseSnapshotCompact(Math.min(10, snapshotRowLimit))
      };

      // Optionally include full JSON report (consumer can download/save)
      if (includeFullParseReport && this.lastImportParseSnapshot) {
        result.fullParseReportJSON = this.csvManager.exportLastParseSnapshotJSON();
      }

      this.notifyChange('imported', result);
      console.log(`✅ CSV import complete: ${result.summary.added} added, ${result.summary.updated} updated, ${result.summary.skipped} skipped`);
      
      return result;

    } catch (error) {
      console.error('CSV import failed:', error);
      throw new Error(`CSV import failed: ${error.message}`);
    }
  }

  /**
   * Merge questions with existing bank using specified strategy
   */
  async mergeQuestions(newQuestions, strategy = 'skip') {
    const summary = {
      processed: newQuestions.length,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    const resultQuestions = [...this.questionBank];
    const conflicts = [];

  for (const newQuestion of newQuestions) {
      try {
        // Ensure question has valid ID
        if (!newQuestion.id) {
          newQuestion.id = this.generateQuestionId();
        }

        // Find existing question
        const existingIndex = resultQuestions.findIndex(q => 
          this.questionsMatch(q, newQuestion)
        );

        if (existingIndex === -1) {
          // New question - add it
          resultQuestions.push(newQuestion);
          summary.added++;
        } else {
          // Conflict found - apply strategy
          const existing = resultQuestions[existingIndex];
          const mergeResult = this.applyMergeStrategy(existing, newQuestion, strategy);
          // Apply merge result actions
          switch (mergeResult.action) {
            case 'skip':
              summary.skipped++;
              break;
            case 'update':
              resultQuestions[existingIndex] = mergeResult.question;
              summary.updated++;
              break;
            case 'add':
              newQuestion.id = this.generateQuestionId();
              resultQuestions.push(newQuestion);
              summary.added++;
              break;
            default:
              break;
          }

          if (mergeResult.conflict) conflicts.push(mergeResult.conflict);
        }

      } catch (error) {
        summary.errors.push({
          question: newQuestion.question || 'Unknown',
          error: error.message
        });
      }
    }

    return {
      questions: resultQuestions,
      summary,
      conflicts
    };
  }

  /**
   * Check if two questions match (for duplicate detection)
   */
  questionsMatch(q1, q2) {
    // Exact ID match
    if (q1.id && q2.id && q1.id === q2.id) {
      return true;
    }

    // Exact question text match (normalized)
    const text1 = this.normalizeText(q1.question || '');
    const text2 = this.normalizeText(q2.question || '');
    
    if (text1 && text2 && text1 === text2) {
      return true;
    }

    // Future: Add fuzzy matching here
    return false;
  }

  /**
   * Apply merge strategy for conflicting questions
   */
  applyMergeStrategy(existing, incoming, strategy) {
    const conflict = {
      existing: { id: existing.id, question: existing.question },
      incoming: { id: incoming.id, question: incoming.question },
      strategy
    };

    switch (strategy) {
      case 'skip':
        return { action: 'skip', question: existing, conflict };

      case 'overwrite':
        return { 
          action: 'update', 
          question: {
            ...incoming,
            id: existing.id,
            source: {
              ...incoming.source,
              originalId: existing.id,
              replacedAt: new Date().toISOString()
            },
            analytics: existing.analytics // Preserve analytics
          }
        };

      case 'force':
        return { action: 'add', question: incoming };

      case 'merge': {
        const merged = this.mergeQuestionFields(existing, incoming);
        return { action: 'update', question: merged };
      }

      default:
        throw new Error(`Unknown merge strategy: ${strategy}`);
    }
  }

  /**
   * Merge fields from two questions intelligently
   */
  mergeQuestionFields(existing, incoming) {
    const merged = { ...existing };

    // Merge non-empty fields from incoming
    Object.entries(incoming).forEach(([key, value]) => {
      if (key === 'id' || key === 'analytics') return; // Preserve these

      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          merged[key] = value;
        } else if (typeof value === 'object' && Object.keys(value).length > 0) {
          merged[key] = { ...existing[key], ...value };
        } else {
          merged[key] = value;
        }
      }
    });

    // Update source metadata
    merged.source = {
      ...existing.source,
      lastUpdated: new Date().toISOString(),
      mergedFrom: incoming.source?.uploadId || 'unknown'
    };

    return merged;
  }

  /**
   * Migrate question to current schema
   */
  migrateQuestion(question) {
    if (!QuestionSchema.needsMigration(question)) {
      return question;
    }

    console.log(`🔄 Migrating question ${question.id || 'unknown'} to current schema`);
    
    // Convert from legacy format
    const migrated = QuestionSchema.fromLegacyFormat(question);
    
    // Add migration metadata
    migrated.source = {
      ...migrated.source,
      migrated: true,
      migratedAt: new Date().toISOString(),
      originalFormat: 'legacy'
    };

    return migrated;
  }

  /**
   * Add or update a single question
   */
  async addQuestion(questionData, options = {}) {
    const { validate = true, autoCorrect = true } = options;

    try {
      let question = { ...questionData };

      // Auto-correct if enabled
      if (autoCorrect) {
        this.csvManager.autoCorrectQuestion(question);
      }

      // Generate ID if missing
      if (!question.id) {
        question.id = this.generateQuestionId();
      }

      // Create with schema defaults
      question = QuestionSchema.createDefault(question);

      // Validate if required
      if (validate) {
        const validation = QuestionSchema.validate(question);
        if (!validation.isValid) {
          throw new Error(`Question validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Add metadata
      question.source = {
        ...question.source,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Add to bank
      this.questionBank.push(question);
      this.updateMetadata();

      // Save if storage available
      if (this.storageService) {
        await this.saveToStorage();
      }

      this.notifyChange('added', { question });
      return question;

    } catch (error) {
      console.error('Failed to add question:', error);
      throw error;
    }
  }

  /**
   * Update existing question
   */
  async updateQuestion(id, updates, options = {}) {
    const { validate = true } = options;

    try {
      const index = this.questionBank.findIndex(q => q.id === id);
      if (index === -1) {
        throw new Error(`Question with ID ${id} not found`);
      }

      const existing = this.questionBank[index];
      const updated = {
        ...existing,
        ...updates,
        id: existing.id, // Preserve ID
        source: {
          ...existing.source,
          lastUpdated: new Date().toISOString()
        },
        analytics: existing.analytics // Preserve analytics
      };

      // Validate if required
      if (validate) {
        const validation = QuestionSchema.validate(updated);
        if (!validation.isValid) {
          throw new Error(`Question validation failed: ${validation.errors.join(', ')}`);
        }
      }

      this.questionBank[index] = updated;
      this.updateMetadata();

      // Save if storage available
      if (this.storageService) {
        await this.saveToStorage();
      }

      this.notifyChange('updated', { question: updated });
      return updated;

    } catch (error) {
      console.error('Failed to update question:', error);
      throw error;
    }
  }

  /**
   * Delete question
   */
  async deleteQuestion(id) {
    try {
      const index = this.questionBank.findIndex(q => q.id === id);
      if (index === -1) {
        throw new Error(`Question with ID ${id} not found`);
      }

      const deleted = this.questionBank.splice(index, 1)[0];
      this.updateMetadata();

      // Save if storage available
      if (this.storageService) {
        await this.saveToStorage();
      }

      this.notifyChange('deleted', { question: deleted });
      return deleted;

    } catch (error) {
      console.error('Failed to delete question:', error);
      throw error;
    }
  }

  /**
   * Get questions with filtering and pagination
   */
  getQuestions(options = {}) {
    const {
      category = null,
      difficulty = null,
      tags = [],
      search = '',
      offset = 0,
      limit = null,
      sortBy = 'id',
      sortOrder = 'asc'
    } = options;

    let filtered = [...this.questionBank];

    // Apply filters
    if (category) {
      filtered = filtered.filter(q => q.category === category);
    }

    if (difficulty) {
      filtered = filtered.filter(q => q.difficulty === difficulty);
    }

    if (tags.length > 0) {
      filtered = filtered.filter(q => 
        q.tags && tags.some(tag => q.tags.includes(tag))
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(q =>
        q.question?.toLowerCase().includes(searchLower) ||
        q.explanation?.toLowerCase().includes(searchLower) ||
        q.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortOrder === 'desc') {
        if (bVal > aVal) return 1;
        if (bVal < aVal) return -1;
        return 0;
      } else {
        if (aVal > bVal) return 1;
        if (aVal < bVal) return -1;
        return 0;
      }
    });

    // Paginate
    if (limit) {
      filtered = filtered.slice(offset, offset + limit);
    } else if (offset > 0) {
      filtered = filtered.slice(offset);
    }

    return filtered;
  }

  /**
   * Export questions in various formats
   */
  async exportQuestions(format = 'csv', options = {}) {
    const questions = this.getQuestions(options);

    switch (format.toLowerCase()) {
      case 'csv':
        return this.csvManager.exportToCSV(questions, options);
      
      case 'json':
        return JSON.stringify(questions, null, 2);
      
      case 'bank':
        return JSON.stringify({
          questions,
          metadata: this.metadata,
          exported: new Date().toISOString()
        }, null, 2);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get statistics about the question bank
   */
  getStatistics() {
    const questions = this.questionBank;
    const categories = new Map();
    const difficulties = new Map();
    const tags = new Map();
    const types = new Map();

    questions.forEach(q => {
      // Count categories
      const cat = q.category || 'Unknown';
      categories.set(cat, (categories.get(cat) || 0) + 1);

      // Count difficulties
      const diff = q.difficulty || 'Unknown';
      difficulties.set(diff, (difficulties.get(diff) || 0) + 1);

      // Count types
      const type = q.type || 'multiple_choice';
      types.set(type, (types.get(type) || 0) + 1);

      // Count tags
      if (q.tags) {
        q.tags.forEach(tag => {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        });
      }
    });

    return {
      total: questions.length,
      categories: Object.fromEntries(categories),
      difficulties: Object.fromEntries(difficulties),
      types: Object.fromEntries(types),
      tags: Object.fromEntries(tags),
      metadata: this.metadata
    };
  }

  // Utility methods
  generateQuestionId() {
    const maxId = Math.max(0, ...this.questionBank.map(q => q.id || 0));
    return maxId + 1;
  }

  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  normalizeText(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  updateMetadata() {
    this.metadata.lastUpdated = new Date().toISOString();
    this.metadata.totalQuestions = this.questionBank.length;
  }

  async saveToStorage() {
    if (this.storageService) {
      await this.storageService.saveQuestionBank({
        questions: this.questionBank,
        metadata: this.metadata
      });
    }
  }

  /**
   * Export the last parse report as a downloadable artifact.
   * - In browser: returns { type: 'browser', filename, blob, url }
   * - In Node/server: writes to os.tmpdir and returns { type: 'server', filename, path }
   * - Fallback: returns raw JSON string
   */
  async exportLastParseReport(options = {}) {
    const { filename = null } = options;

    const snapshot = this.lastImportParseSnapshot || this.csvManager.lastParseSnapshot;
    if (!snapshot) {
      throw new Error('No parse snapshot available to export');
    }

    const json = this.csvManager.exportLastParseSnapshotJSON();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = filename || `parse-report-${ts}.json`;

    // Browser environment: return Blob and object URL for UI to download
    try {
      if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = (typeof URL !== 'undefined') ? URL.createObjectURL(blob) : null;
        return { type: 'browser', filename: name, blob, url };
      }
    } catch (e) {
      console.error('Browser export attempt failed, falling back to server export:', e?.message || e);
    }

    // Server/Node environment: write to temp file
    try {
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const tmpdir = os.default.tmpdir();
      const fullPath = path.default.join(tmpdir, name);
      await fs.promises.writeFile(fullPath, json, 'utf8');
      return { type: 'server', filename: name, path: fullPath };
    } catch (e) {
      console.error('Server export attempt failed, returning raw content fallback:', e?.message || e);
      // Final fallback: return raw content
      return { type: 'raw', filename: name, content: json };
    }
  }

  // Event system for change notifications
  onChange(listener) {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) this.changeListeners.splice(index, 1);
    };
  }

  notifyChange(action, data) {
    this.changeListeners.forEach(listener => {
      try {
        listener(action, data);
      } catch (error) {
        console.error('Change listener error:', error);
      }
    });
  }

  // Legacy compatibility
  getAllQuestions() { return [...this.questionBank]; }
  getCategories() { 
    return [...new Set(this.questionBank.map(q => q.category).filter(Boolean))];
  }
  getDifficulties() {
    return [...new Set(this.questionBank.map(q => q.difficulty).filter(Boolean))];
  }
}

export default IntegratedQuestionManager;
