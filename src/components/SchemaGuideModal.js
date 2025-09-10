// Schema Guide Modal Component
// Modal with schema information, examples, and interactive validator

import { EventManager } from '../utils/EventManager.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';
import QuestionSchema from '../models/QuestionSchema.js';

export class SchemaGuideModal {
  constructor() {
    this.eventManager = new EventManager();
    this.selectedPreset = 'auto';
    this.isVisible = false;
    this.modalElement = null;
  }

  /**
   * Initialize the modal and attach global event listeners
   */
  init() {
    this.attachGlobalEventListeners();
  }

  /**
   * Attach global event listeners
   */
  attachGlobalEventListeners() {
    // Listen for schema guide open events
    document.addEventListener('schema-guide:open', () => {
      this.show();
    });

    // Listen for escape key to close modal
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Show the modal
   */
  show() {
    if (this.isVisible) return;

    this.render();
    this.isVisible = true;
    
    // Focus management for accessibility
    const modal = document.getElementById('schemaGuideModal');
    if (modal) {
      modal.focus();
    }
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.isVisible) return;

    const modal = document.getElementById('schemaGuideModal');
    if (modal) {
      modal.remove();
      this.modalElement = null;
    }
    
    this.isVisible = false;
    this.eventManager.removeAllListeners();
  }

  /**
   * Render the modal
   */
  render() {
    // Remove existing modal if present
    const existingModal = document.getElementById('schemaGuideModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div id="schemaGuideModal" class="modal-overlay" role="dialog" aria-labelledby="schemaGuideTitle" 
           aria-describedby="schemaGuideDescription" tabindex="-1">
        <div class="modal-container schema-guide-modal">
          <div class="modal-header">
            <h2 id="schemaGuideTitle">CSV Schema Guide</h2>
            <p id="schemaGuideDescription" class="modal-subtitle">
              Select a question type to see required fields and examples
            </p>
            <button type="button" id="closeSchemaGuide" class="modal-close" aria-label="Close schema guide">
              &times;
            </button>
          </div>

          <div class="modal-content">
            <!-- Preset Selector -->
            <div class="schema-section preset-section">
              <h3>Question Type</h3>
              <div class="preset-selector">
                <label class="preset-option">
                  <input type="radio" name="preset" value="auto" checked>
                  <span class="preset-card">
                    <strong>Auto</strong>
                    <small>Automatic detection</small>
                  </span>
                </label>
                <label class="preset-option">
                  <input type="radio" name="preset" value="multiple-choice">
                  <span class="preset-card">
                    <strong>Multiple Choice</strong>
                    <small>A, B, C, D options</small>
                  </span>
                </label>
                <label class="preset-option">
                  <input type="radio" name="preset" value="short-answer">
                  <span class="preset-card">
                    <strong>Short Answer</strong>
                    <small>Text response</small>
                  </span>
                </label>
                <label class="preset-option">
                  <input type="radio" name="preset" value="true-false">
                  <span class="preset-card">
                    <strong>True/False</strong>
                    <small>Boolean response</small>
                  </span>
                </label>
                <label class="preset-option">
                  <input type="radio" name="preset" value="numeric">
                  <span class="preset-card">
                    <strong>Numeric</strong>
                    <small>Number response</small>
                  </span>
                </label>
              </div>
            </div>

            <!-- Required Fields -->
            <div class="schema-section">
              <h3>Required Fields</h3>
              <div id="requiredFields" class="fields-list">
                <!-- Will be populated by JavaScript -->
              </div>
            </div>

            <!-- Optional Fields -->
            <div class="schema-section">
              <h3>Optional Fields</h3>
              <div id="optionalFields" class="fields-list">
                <!-- Will be populated by JavaScript -->
              </div>
            </div>

            <!-- Examples -->
            <div class="schema-section">
              <h3>Examples</h3>
              
              <!-- CSV Example -->
              <div class="example-section">
                <h4>CSV Format</h4>
                <div class="example-container">
                  <pre id="csvExample" class="example-code">
                    <!-- Will be populated by JavaScript -->
                  </pre>
                  <button type="button" id="copyCsvExample" class="btn btn-small copy-btn" title="Copy CSV example">
                    📋 Copy
                  </button>
                </div>
              </div>

              <!-- JSON Example -->
              <div class="example-section">
                <h4>JSON Format</h4>
                <div class="example-container">
                  <pre id="jsonExample" class="example-code">
                    <!-- Will be populated by JavaScript -->
                  </pre>
                  <button type="button" id="copyJsonExample" class="btn btn-small copy-btn" title="Copy JSON example">
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>

            <!-- Quick Validator (Collapsible) -->
            <div class="schema-section">
              <h3>
                <button type="button" id="toggleValidator" class="section-toggle" aria-expanded="false">
                  <span class="toggle-icon">▶</span>
                  Quick Validator
                </button>
              </h3>
              <div id="validatorSection" class="validator-section" style="display: none;">
                <p class="validator-description">
                  Paste a few CSV rows to test validation (max 10 rows)
                </p>
                <div class="validator-container">
                  <textarea id="csvInput" class="validator-input" 
                            placeholder="id,question,type,correct_answer&#10;1,What is 2+2?,short_answer,4"
                            rows="4"></textarea>
                  <button type="button" id="validateCsv" class="btn btn-primary validate-btn">
                    Validate
                  </button>
                </div>
                <div id="validationResults" class="validation-results" style="display: none;">
                  <!-- Will be populated by JavaScript -->
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="footer-links">
              <a href="#" id="viewDocumentation" class="link">View Documentation</a>
            </div>
            <div class="footer-actions">
              <button type="button" id="closeModal" class="btn btn-secondary">Close</button>
              <button type="button" id="proceedToUpload" class="btn btn-primary">Proceed to Upload</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('schemaGuideModal');
    
    this.attachEventListeners();
    this.updateContent();
  }

  /**
   * Attach event listeners for the modal
   */
  attachEventListeners() {
    // Close modal events
    const closeBtn = document.getElementById('closeSchemaGuide');
    const closeModalBtn = document.getElementById('closeModal');
    const modalOverlay = document.getElementById('schemaGuideModal');

    if (closeBtn) {
      this.eventManager.on(closeBtn, 'click', () => this.hide());
    }
    if (closeModalBtn) {
      this.eventManager.on(closeModalBtn, 'click', () => this.hide());
    }
    if (modalOverlay) {
      this.eventManager.on(modalOverlay, 'click', (event) => {
        if (event.target === modalOverlay) {
          this.hide();
        }
      });
    }

    // Preset selection
    const presetRadios = document.querySelectorAll('input[name="preset"]');
    presetRadios.forEach(radio => {
      this.eventManager.on(radio, 'change', () => {
        if (radio.checked) {
          this.selectedPreset = radio.value;
          this.updateContent();
        }
      });
    });

    // Toggle validator section
    const toggleValidator = document.getElementById('toggleValidator');
    if (toggleValidator) {
      this.eventManager.on(toggleValidator, 'click', () => {
        const section = document.getElementById('validatorSection');
        const icon = toggleValidator.querySelector('.toggle-icon');
        const isExpanded = toggleValidator.getAttribute('aria-expanded') === 'true';

        if (section && icon) {
          if (isExpanded) {
            section.style.display = 'none';
            icon.textContent = '▶';
            toggleValidator.setAttribute('aria-expanded', 'false');
          } else {
            section.style.display = 'block';
            icon.textContent = '▼';
            toggleValidator.setAttribute('aria-expanded', 'true');
          }
        }
      });
    }

    // Copy buttons
    const copyCsvBtn = document.getElementById('copyCsvExample');
    const copyJsonBtn = document.getElementById('copyJsonExample');

    if (copyCsvBtn) {
      this.eventManager.on(copyCsvBtn, 'click', () => {
        this.copyToClipboard('csvExample');
      });
    }
    if (copyJsonBtn) {
      this.eventManager.on(copyJsonBtn, 'click', () => {
        this.copyToClipboard('jsonExample');
      });
    }

    // Validate button (Phase 2 - will be implemented next)
    const validateBtn = document.getElementById('validateCsv');
    if (validateBtn) {
      this.eventManager.on(validateBtn, 'click', () => {
        this.validateCsvInput();
      });
    }

    // Proceed to upload
    const proceedBtn = document.getElementById('proceedToUpload');
    if (proceedBtn) {
      this.eventManager.on(proceedBtn, 'click', () => {
        this.hide();
        // Focus back to the upload section
        const uploadSection = document.getElementById('singleUploadSection') || 
                            document.getElementById('multiUploadSection');
        if (uploadSection) {
          uploadSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  /**
   * Update content based on selected preset
   */
  updateContent() {
    this.updateRequiredFields();
    this.updateOptionalFields();
    this.updateExamples();
  }

  /**
   * Update required fields display
   */
  updateRequiredFields() {
    const requiredFieldsContainer = document.getElementById('requiredFields');
    if (!requiredFieldsContainer) return;

    const baseFields = QuestionSchema.getBaseFields();
    const presetData = QuestionSchema.getPresetFields(this.selectedPreset);
    const allRequiredFields = [...baseFields, ...presetData.required];

    requiredFieldsContainer.innerHTML = allRequiredFields.map(field => `
      <div class="field-item required-field">
        <div class="field-header">
          <strong>${field.name}</strong>
          <span class="field-type">${field.type}</span>
          <span class="required-badge">Required</span>
        </div>
        <div class="field-description">${field.description}</div>
        ${field.enum ? `<div class="field-values">Values: ${field.enum.join(', ')}</div>` : ''}
      </div>
    `).join('');
  }

  /**
   * Update optional fields display
   */
  updateOptionalFields() {
    const optionalFieldsContainer = document.getElementById('optionalFields');
    if (!optionalFieldsContainer) return;

    const presetData = QuestionSchema.getPresetFields(this.selectedPreset);
    const optionalFields = presetData.optional || [];

    if (optionalFields.length === 0) {
      optionalFieldsContainer.innerHTML = '<p class="no-fields">No preset-specific optional fields for this question type.</p>';
      return;
    }

    optionalFieldsContainer.innerHTML = optionalFields.map(field => `
      <div class="field-item optional-field">
        <div class="field-header">
          <strong>${field.name}</strong>
          <span class="field-type">${field.type}</span>
          <span class="optional-badge">Optional</span>
        </div>
        <div class="field-description">${field.description}</div>
        ${field.enum ? `<div class="field-values">Values: ${field.enum.join(', ')}</div>` : ''}
      </div>
    `).join('');
  }

  /**
   * Update examples display
   */
  updateExamples() {
    const csvExample = document.getElementById('csvExample');
    const jsonExample = document.getElementById('jsonExample');

    if (csvExample) {
      const csvData = QuestionSchema.getExampleCSVRow(this.selectedPreset);
      const csvContent = csvData.headers.join(',') + '\n' + csvData.row.map(cell => 
        cell.includes(',') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(',');
      csvExample.textContent = csvContent;
    }

    if (jsonExample) {
      const jsonData = QuestionSchema.getExampleJSON(this.selectedPreset);
      jsonExample.textContent = JSON.stringify(jsonData, null, 2);
    }
  }

  /**
   * Copy content to clipboard
   */
  async copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      await navigator.clipboard.writeText(element.textContent);
      
      // Show feedback
      const button = document.querySelector(`[onclick*="${elementId}"], #copy${elementId.charAt(0).toUpperCase()}${elementId.slice(1)}`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '';
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      this.fallbackCopyToClipboard(element.textContent);
    }
  }

  /**
   * Fallback copy method for older browsers
   */
  fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
  }

  /**
   * Validate CSV input (Phase 2 implementation - placeholder for now)
   */
  validateCsvInput() {
    const csvInput = document.getElementById('csvInput');
    const resultsContainer = document.getElementById('validationResults');
    
    if (!csvInput || !resultsContainer) return;

    const inputValue = csvInput.value.trim();
    if (!inputValue) {
      resultsContainer.innerHTML = '<div class="validation-error">Please enter some CSV data to validate.</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    // Phase 2: This will be implemented with actual validation using EnhancedCSVManager
    resultsContainer.innerHTML = `
      <div class="validation-info">
        <h4>Validation Results</h4>
        <p>Validation feature will be implemented in Phase 2.</p>
        <p>For now, please ensure your CSV follows the format shown in the examples above.</p>
      </div>
    `;
    resultsContainer.style.display = 'block';
  }
}

export default SchemaGuideModal;