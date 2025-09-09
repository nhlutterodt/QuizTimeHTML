// Supplementation Dialog Component - UI for question shortage confirmation
// Provides user-friendly interface for AI question generation

import { DOMHelpers } from '../utils/DOMHelpers.js';
import { EventManager } from '../utils/EventManager.js';

export class SupplementationDialog {
  constructor(apiKeyManager = null) {
    this.apiKeyManager = apiKeyManager;
    this.eventManager = new EventManager();
    this.isVisible = false;
    this.dialog = null;
    this.currentOptions = null;
    this.callbacks = {
      onConfirm: null,
      onCancel: null,
      onConfigureAPI: null
    };
  }

  /**
   * Show supplementation dialog with shortage information
   * @param {Object} options - Dialog configuration
   * @param {number} options.requested - Number of questions requested
   * @param {number} options.available - Number of questions available
   * @param {string} options.provider - AI provider name
   * @param {boolean} options.hasValidAPIKey - Whether API key is configured
   * @param {Object} options.callbacks - Event callbacks
   */
  show(options) {
    this.currentOptions = {
      requested: options.requested || 0,
      available: options.available || 0,
      missing: (options.requested || 0) - (options.available || 0),
      provider: options.provider || 'OpenAI',
      hasValidAPIKey: options.hasValidAPIKey || false,
      estimatedCost: this.calculateCostEstimate(options.requested - options.available, options.provider)
    };

    this.callbacks = {
      onConfirm: options.onConfirm || (() => {}),
      onCancel: options.onCancel || (() => {}),
      onConfigureAPI: options.onConfigureAPI || (() => {})
    };

    this.render();
    this.attachEventListeners();
    this.isVisible = true;
  }

  /**
   * Hide the dialog
   */
  hide() {
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
    this.isVisible = false;
    this.eventManager.cleanup();
  }

  /**
   * Render the supplementation dialog
   */
  render() {
    const { requested, available, missing, provider, hasValidAPIKey, estimatedCost } = this.currentOptions;

    this.dialog = document.createElement('div');
    this.dialog.className = 'supplementation-dialog-overlay';
    this.dialog.innerHTML = `
      <div class="supplementation-dialog">
        <div class="dialog-header">
          <h3>⚠️ Question Shortage Detected</h3>
          <button type="button" class="close-btn" id="closeSupplementDialog">×</button>
        </div>
        
        <div class="dialog-content">
          <div class="shortage-summary">
            <div class="shortage-stats">
              <div class="stat">
                <span class="stat-label">Requested:</span>
                <span class="stat-value">${requested} questions</span>
              </div>
              <div class="stat">
                <span class="stat-label">Available:</span>
                <span class="stat-value">${available} questions from your CSV files</span>
              </div>
              <div class="stat missing">
                <span class="stat-label">Missing:</span>
                <span class="stat-value">${missing} questions</span>
              </div>
            </div>
          </div>

          ${this.renderSupplementationOptions(hasValidAPIKey, provider, missing, estimatedCost)}
        </div>

        <div class="dialog-actions">
          ${this.renderActionButtons(hasValidAPIKey)}
        </div>
      </div>
    `;

    document.body.appendChild(this.dialog);
    
    // Add fade-in effect
    requestAnimationFrame(() => {
      this.dialog.classList.add('visible');
    });
  }

  /**
   * Render supplementation options based on API key availability
   */
  renderSupplementationOptions(hasValidAPIKey, provider, missing, estimatedCost) {
    if (hasValidAPIKey) {
      return `
        <div class="ai-supplementation available">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <h4>AI Supplementation Available</h4>
          </div>
          <p>Your ${provider} API key is valid. AI can generate the missing ${missing} questions based on your CSV patterns.</p>
          
          <div class="generation-details">
            <div class="detail-item">
              <span class="detail-label">Estimated cost:</span>
              <span class="detail-value">${estimatedCost}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Generation time:</span>
              <span class="detail-value">~30-60 seconds</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Quality assurance:</span>
              <span class="detail-value">Automatic validation and review</span>
            </div>
          </div>

          <div class="persistence-option">
            <label class="checkbox-container">
              <input type="checkbox" id="persistQuestions" checked>
              <span class="checkmark"></span>
              <span class="checkbox-label">Save generated questions to question bank</span>
            </label>
            <p class="persistence-note">Generated questions will be validated and can be reviewed before final confirmation.</p>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="ai-supplementation unavailable">
          <div class="ai-header">
            <span class="ai-icon">🔑</span>
            <h4>AI Supplementation Requires Configuration</h4>
          </div>
          <p>To generate missing questions, you need to configure an AI provider API key.</p>
          
          <div class="configuration-prompt">
            <p><strong>Available options:</strong></p>
            <ul>
              <li><strong>Configure AI:</strong> Set up OpenAI or Gemini API key for question generation</li>
              <li><strong>Use Available:</strong> Proceed with only ${this.currentOptions.available} questions</li>
              <li><strong>Upload More:</strong> Add additional CSV files with more questions</li>
            </ul>
          </div>
        </div>
      `;
    }
  }

  /**
   * Render action buttons based on API key availability
   */
  renderActionButtons(hasValidAPIKey) {
    if (hasValidAPIKey) {
      return `
        <button type="button" class="btn btn-primary" id="generateMissingQuestions">
          <span class="btn-icon">🤖</span>
          Generate Missing Questions
        </button>
        <button type="button" class="btn btn-secondary" id="useAvailableOnly">
          Use Available Only (${this.currentOptions.available})
        </button>
        <button type="button" class="btn btn-link" id="cancelSupplement">Cancel</button>
      `;
    } else {
      return `
        <button type="button" class="btn btn-primary" id="configureAPIKey">
          <span class="btn-icon">🔑</span>
          Configure AI Provider
        </button>
        <button type="button" class="btn btn-secondary" id="useAvailableOnly">
          Use Available Only (${this.currentOptions.available})
        </button>
        <button type="button" class="btn btn-link" id="cancelSupplement">Cancel</button>
      `;
    }
  }

  /**
   * Attach event listeners to dialog elements
   */
  attachEventListeners() {
    const closeBtn = this.dialog.querySelector('#closeSupplementDialog');
    const cancelBtn = this.dialog.querySelector('#cancelSupplement');
    const useAvailableBtn = this.dialog.querySelector('#useAvailableOnly');
    const generateBtn = this.dialog.querySelector('#generateMissingQuestions');
    const configureBtn = this.dialog.querySelector('#configureAPIKey');

    // Close dialog events
    if (closeBtn) {
      this.eventManager.on(closeBtn, 'click', () => this.handleCancel());
    }
    if (cancelBtn) {
      this.eventManager.on(cancelBtn, 'click', () => this.handleCancel());
    }

    // Use available questions only
    if (useAvailableBtn) {
      this.eventManager.on(useAvailableBtn, 'click', () => this.handleUseAvailable());
    }

    // Generate missing questions (if API key available)
    if (generateBtn) {
      this.eventManager.on(generateBtn, 'click', () => this.handleGenerateQuestions());
    }

    // Configure API key (if not available)
    if (configureBtn) {
      this.eventManager.on(configureBtn, 'click', () => this.handleConfigureAPI());
    }

    // Close on overlay click
    this.eventManager.on(this.dialog, 'click', (e) => {
      if (e.target === this.dialog) {
        this.handleCancel();
      }
    });

    // Close on Escape key
    this.eventManager.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.handleCancel();
      }
    });
  }

  /**
   * Handle generate questions action
   */
  handleGenerateQuestions() {
    const persistCheckbox = this.dialog.querySelector('#persistQuestions');
    const shouldPersist = persistCheckbox ? persistCheckbox.checked : true;

    this.callbacks.onConfirm({
      action: 'generate',
      persist: shouldPersist,
      requested: this.currentOptions.requested,
      available: this.currentOptions.available,
      missing: this.currentOptions.missing
    });

    this.hide();
  }

  /**
   * Handle use available questions only
   */
  handleUseAvailable() {
    this.callbacks.onConfirm({
      action: 'useAvailable',
      requested: this.currentOptions.available,
      available: this.currentOptions.available,
      missing: 0
    });

    this.hide();
  }

  /**
   * Handle configure API key action
   */
  handleConfigureAPI() {
    this.callbacks.onConfigureAPI();
    this.hide();
  }

  /**
   * Handle cancel action
   */
  handleCancel() {
    this.callbacks.onCancel();
    this.hide();
  }

  /**
   * Calculate cost estimate for AI generation
   * @param {number} questionCount - Number of questions to generate
   * @param {string} provider - AI provider name
   * @returns {string} Human-readable cost estimate
   */
  calculateCostEstimate(questionCount, provider = 'openai') {
    // Rough estimates based on typical token usage
    // These are estimates and actual costs may vary
    const estimates = {
      openai: {
        tokensPerQuestion: 150, // Rough estimate for prompt + response
        costPer1kTokens: 0.002 // GPT-3.5-turbo approximate cost
      },
      gemini: {
        tokensPerQuestion: 150,
        costPer1kTokens: 0.001 // Gemini Pro approximate cost
      }
    };

    const providerData = estimates[provider.toLowerCase()] || estimates.openai;
    const totalTokens = questionCount * providerData.tokensPerQuestion;
    const estimatedCost = (totalTokens / 1000) * providerData.costPer1kTokens;

    if (estimatedCost < 0.01) {
      return 'Less than $0.01';
    } else if (estimatedCost < 0.10) {
      return `~$${estimatedCost.toFixed(2)}`;
    } else {
      return `~$${estimatedCost.toFixed(2)} (${Math.ceil(questionCount / 10)} API calls)`;
    }
  }

  /**
   * Show loading state during generation
   */
  showLoadingState() {
    if (!this.dialog) return;

    const content = this.dialog.querySelector('.dialog-content');
    if (content) {
      content.innerHTML = `
        <div class="generation-progress">
          <div class="progress-header">
            <span class="progress-icon">🤖</span>
            <h4>Generating Questions...</h4>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p class="progress-text">Analyzing your question patterns and generating ${this.currentOptions.missing} new questions...</p>
          <div class="progress-details">
            <div class="detail">✓ Pattern analysis complete</div>
            <div class="detail">🔄 Generating questions with AI</div>
            <div class="detail">⏳ Validating question format</div>
          </div>
        </div>
      `;
    }

    const actions = this.dialog.querySelector('.dialog-actions');
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-secondary" disabled>
          <span class="btn-icon">⏳</span>
          Generating...
        </button>
      `;
    }
  }

  /**
   * Show generation results
   * @param {Object} result - Generation result with success/error info
   */
  showGenerationResult(result) {
    if (!this.dialog) return;

    const content = this.dialog.querySelector('.dialog-content');
    if (!content) return;

    if (result.success) {
      content.innerHTML = `
        <div class="generation-success">
          <div class="success-header">
            <span class="success-icon">✅</span>
            <h4>Questions Generated Successfully</h4>
          </div>
          <div class="generation-summary">
            <div class="summary-stat">
              <span class="stat-label">Generated:</span>
              <span class="stat-value">${result.metadata.generated} questions</span>
            </div>
            <div class="summary-stat">
              <span class="stat-label">Valid:</span>
              <span class="stat-value">${result.metadata.valid} questions</span>
            </div>
            ${result.metadata.duplicates > 0 ? `
            <div class="summary-stat warning">
              <span class="stat-label">Duplicates filtered:</span>
              <span class="stat-value">${result.metadata.duplicates} questions</span>
            </div>
            ` : ''}
          </div>
          <p class="success-message">The generated questions have been validated and are ready to use in your quiz.</p>
        </div>
      `;

      const actions = this.dialog.querySelector('.dialog-actions');
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="btn btn-primary" id="confirmGeneration">
            Continue with Quiz
          </button>
        `;

        const confirmBtn = actions.querySelector('#confirmGeneration');
        if (confirmBtn) {
          this.eventManager.on(confirmBtn, 'click', () => this.hide());
        }
      }
    } else {
      content.innerHTML = `
        <div class="generation-error">
          <div class="error-header">
            <span class="error-icon">❌</span>
            <h4>Generation Failed</h4>
          </div>
          <p class="error-message">${result.error || 'Unknown error occurred during generation'}</p>
          <div class="error-actions">
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Try again with fewer questions</li>
              <li>Check your API key configuration</li>
              <li>Use the available ${this.currentOptions.available} questions</li>
              <li>Upload additional CSV files</li>
            </ul>
          </div>
        </div>
      `;

      const actions = this.dialog.querySelector('.dialog-actions');
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="btn btn-primary" id="retryGeneration">
            Try Again
          </button>
          <button type="button" class="btn btn-secondary" id="useAvailableAfterError">
            Use Available (${this.currentOptions.available})
          </button>
        `;

        const retryBtn = actions.querySelector('#retryGeneration');
        const useAvailableBtn = actions.querySelector('#useAvailableAfterError');

        if (retryBtn) {
          this.eventManager.on(retryBtn, 'click', () => {
            this.render(); // Re-render original dialog
            this.attachEventListeners();
          });
        }

        if (useAvailableBtn) {
          this.eventManager.on(useAvailableBtn, 'click', () => this.handleUseAvailable());
        }
      }
    }
  }

  /**
   * Check if dialog is currently visible
   * @returns {boolean} Visibility state
   */
  isDialogVisible() {
    return this.isVisible;
  }

  /**
   * Destroy the dialog and clean up resources
   */
  destroy() {
    this.hide();
    this.eventManager.cleanup();
    this.callbacks = {};
    this.currentOptions = null;
  }
}

export default SupplementationDialog;