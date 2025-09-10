// Centralized CSV Import Facade for Server APIs
// Consolidates all CSV import functionality as per refactor proposal

import { IntegratedQuestionManager } from './IntegratedQuestionManager.js';
import EnhancedCSVManager from '../data/EnhancedCSVManager.js';

/**
 * Centralized facade for all CSV import operations used by server endpoints
 * This replaces scattered CSV parsing logic throughout server.js
 */
export class CSVImportFacade {
  constructor() {
    this.questionManager = new IntegratedQuestionManager();
    this.csvManager = new EnhancedCSVManager();
  }

  /**
   * Import CSV files using the standard question manager workflow
   * @param {string|Buffer} csvContent - CSV content to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with summary and any errors
   */
  async importCSV(csvContent, options = {}) {
    const {
      mergeStrategy = 'skip',
      snapshotRowLimit = 50,
      uploadId = null,
      filename = 'unknown.csv',
      strictValidation = false,
      autoCorrect = true
    } = options;

    try {
      // Use the integrated question manager for standardized import
      const result = await this.questionManager.importFromCSV(csvContent, {
        mergeStrategy,
        snapshotRowLimit,
        strictValidation,
        autoCorrect
      });

      // Add upload metadata if provided
      if (uploadId && filename) {
        result.uploadMetadata = {
          uploadId,
          filename,
          uploadedAt: new Date().toISOString()
        };
      }

      return {
        success: true,
        summary: result.summary,
        questions: result.questions || [],
        errors: result.errors || [],
        warnings: result.warnings || [],
        parseSnapshot: result.lastParseSnapshot || null,
        uploadMetadata: result.uploadMetadata || null
      };

    } catch (error) {
      console.error('❌ CSV import facade error:', error);
      
      // Return standardized error response instead of throwing
      return {
        success: false,
        summary: { processed: 0, added: 0, updated: 0, skipped: 0, errors: 1 },
        questions: [],
        errors: [{ 
          error: error.message, 
          line: 'N/A', 
          question: 'N/A' 
        }],
        warnings: [],
        parseSnapshot: null,
        uploadMetadata: null
      };
    }
  }

  /**
   * Export last parse report for debugging/audit purposes
   * Standardized across browser and server environments
   * @returns {Promise<Object>} Export result with file path or blob info
   */
  async exportLastParseReport() {
    try {
      return await this.questionManager.exportLastParseReport();
    } catch (error) {
      console.error('❌ Export parse report error:', error);
      throw new Error(`Failed to export parse report: ${error.message}`);
    }
  }

  /**
   * Validate CSV content before importing (dry run)
   * @param {string|Buffer} csvContent - CSV content to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateCSV(csvContent, options = {}) {
    const { snapshotRowLimit = 50 } = options;

    try {
      // Use CSV manager for parsing validation
      const parseResult = await this.csvManager.parseCSV(csvContent, {
        snapshotRowLimit,
        strictValidation: true // Use strict mode for validation
      });

      return {
        isValid: parseResult.summary.errors === 0,
        summary: parseResult.summary,
        errors: parseResult.errors || [],
        warnings: parseResult.warnings || [],
        collections: parseResult.collections || {},
        parseSnapshot: parseResult.lastParseSnapshot
      };

    } catch (error) {
      return {
        isValid: false,
        summary: { total: 0, successful: 0, errors: 1, warnings: 0 },
        errors: [{ error: error.message, line: 'N/A', question: 'N/A' }],
        warnings: [],
        collections: {},
        parseSnapshot: null
      };
    }
  }

  /**
   * Legacy compatibility method for server.js migration
   * Gradually replace direct parseCSVContent calls with this
   * @param {string} csvText - CSV text content
   * @returns {Object} Parsed CSV structure
   */
  parseCSVContentLegacy(csvText) {
    // This provides backward compatibility while we migrate
    // TODO: Remove this once all server.js calls are migrated to importCSV()
    
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCSVLineLegacy(lines[i]);
      if (row.length === headers.length) {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        rows.push(obj);
      }
    }
    
    return { headers, rows };
  }

  /**
   * Legacy CSV line parser - for backward compatibility
   * @param {string} line - CSV line to parse
   * @returns {Array} Parsed values
   */
  parseCSVLineLegacy(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  /**
   * Get current question manager instance for advanced operations
   * @returns {IntegratedQuestionManager} The question manager instance
   */
  getQuestionManager() {
    return this.questionManager;
  }

  /**
   * Get current CSV manager instance for low-level operations
   * @returns {EnhancedCSVManager} The CSV manager instance
   */
  getCSVManager() {
    return this.csvManager;
  }
}

export default CSVImportFacade;