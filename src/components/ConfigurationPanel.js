// Configuration Panel Component
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { ValidationHelpers } from '../utils/ValidationHelpers.js';
import { EventManager } from '../utils/EventManager.js';

export class ConfigurationPanel {
  constructor(container, storageService) {
    this.container = container;
    this.storageService = storageService;
    this.eventManager = new EventManager();
    this.config = {};
    this.csvData = null;
    this.isVisible = false;
  }

  /**
   * Initialize the configuration panel
   */
  init() {
    this.loadConfig();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Load configuration from storage
   */
  loadConfig() {
    this.config = this.storageService.getQuizConfig();
  }

  /**
   * Render the configuration panel
   */
  render() {
    this.container.innerHTML = `
      <div class="config-panel" id="configPanel">
        <div class="config-header">
          <h2>Quiz Configuration</h2>
          <button type="button" class="close-btn" id="closeConfig">×</button>
        </div>
        
        <div class="config-content">
          <!-- CSV File Section -->
          <div class="config-section">
            <h3>Question Source</h3>
            <div class="form-group">
              <label for="csvFile">Upload CSV File:</label>
              <input type="file" id="csvFile" accept=".csv" class="form-control">
              <small class="help-text">CSV should contain: Question, Option A, Option B, Option C, Option D, Correct Answer</small>
            </div>
            <div id="csvStatus" class="status-message"></div>
          </div>

          <!-- Timer Configuration -->
          <div class="config-section">
            <h3>Timer Settings</h3>
            <div class="form-group">
              <label for="timerMode">Timer Mode:</label>
              <select id="timerMode" class="form-control">
                <option value="none">No Timer</option>
                <option value="exam">Exam Timer (Overall)</option>
                <option value="section">Section Timer</option>
                <option value="question">Question Timer</option>
              </select>
            </div>
            
            <div id="timerSettings" class="timer-settings">
              <div class="form-group" id="examTimeGroup">
                <label for="examTime">Exam Time (minutes):</label>
                <input type="number" id="examTime" class="form-control" min="1" max="300">
              </div>
              
              <div class="form-group" id="sectionTimeGroup">
                <label for="sectionTime">Section Time (minutes):</label>
                <input type="number" id="sectionTime" class="form-control" min="1" max="60">
              </div>
              
              <div class="form-group" id="questionTimeGroup">
                <label for="questionTime">Question Time (minutes):</label>
                <input type="number" id="questionTime" class="form-control" min="0.5" max="10" step="0.5">
              </div>
            </div>
          </div>

          <!-- Quiz Settings -->
          <div class="config-section">
            <h3>Quiz Settings</h3>
            <div class="form-group">
              <label for="numQuestions">Number of Questions:</label>
              <input type="number" id="numQuestions" class="form-control" min="1" max="100">
            </div>
            
            <div class="form-group">
              <label for="passingScore">Passing Score (%):</label>
              <input type="number" id="passingScore" class="form-control" min="0" max="100">
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="randomize"> Randomize Questions
              </label>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="showCorrectAnswers"> Show Correct Answers in Results
              </label>
            </div>
          </div>

          <!-- AI Assessment -->
          <div class="config-section">
            <h3>AI Assessment</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="enableAI"> Enable AI-Powered Assessment
              </label>
              <small class="help-text">Get personalized feedback and recommendations</small>
            </div>
            <div id="aiStatus" class="status-message"></div>
          </div>

          <!-- Filtering Options -->
          <div class="config-section">
            <h3>Question Filtering</h3>
            <div class="form-group">
              <label for="sectionFilter">Filter by Section:</label>
              <select id="sectionFilter" class="form-control">
                <option value="all">All Sections</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="difficultyFilter">Filter by Difficulty:</label>
              <select id="difficultyFilter" class="form-control">
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        <div class="config-footer">
          <button type="button" class="btn btn-secondary" id="resetConfig">Reset to Defaults</button>
          <button type="button" class="btn btn-primary" id="saveConfig">Save Configuration</button>
          <button type="button" class="btn btn-success" id="startQuiz">Start Quiz</button>
        </div>
      </div>
    `;

    this.populateFormFields();
    this.updateTimerSettings();
  }

  /**
   * Populate form fields with current configuration
   */
  populateFormFields() {
    // Timer settings
    document.getElementById('timerMode').value = this.config.timerMode;
    document.getElementById('examTime').value = this.config.examTime;
    document.getElementById('sectionTime').value = this.config.sectionTime;
    document.getElementById('questionTime').value = this.config.questionTime;

    // Quiz settings
    document.getElementById('numQuestions').value = this.config.numQuestions;
    document.getElementById('passingScore').value = this.config.passingScore;
    document.getElementById('randomize').checked = this.config.randomize;
    document.getElementById('showCorrectAnswers').checked = this.config.showCorrectAnswers;
    document.getElementById('enableAI').checked = this.config.enableAI;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const csvFile = document.getElementById('csvFile');
    const timerMode = document.getElementById('timerMode');
    const closeBtn = document.getElementById('closeConfig');
    const resetBtn = document.getElementById('resetConfig');
    const saveBtn = document.getElementById('saveConfig');
    const startBtn = document.getElementById('startQuiz');
    const enableAI = document.getElementById('enableAI');

    // CSV file upload
    this.eventManager.on(csvFile, 'change', (e) => this.handleCSVUpload(e));

    // Timer mode change
    this.eventManager.on(timerMode, 'change', () => this.updateTimerSettings());

    // Button events
    this.eventManager.on(closeBtn, 'click', () => this.hide());
    this.eventManager.on(resetBtn, 'click', () => this.resetToDefaults());
    this.eventManager.on(saveBtn, 'click', () => this.saveConfiguration());
    this.eventManager.on(startBtn, 'click', () => this.startQuiz());

    // AI toggle
    this.eventManager.on(enableAI, 'change', () => this.checkAIAvailability());

    // Real-time validation
    this.attachValidationListeners();
  }

  /**
   * Attach validation listeners for real-time feedback
   */
  attachValidationListeners() {
    const numericFields = ['examTime', 'sectionTime', 'questionTime', 'numQuestions', 'passingScore'];
    
    numericFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        this.eventManager.on(field, 'input', () => this.validateField(fieldId));
        this.eventManager.on(field, 'blur', () => this.validateField(fieldId));
      }
    });
  }

  /**
   * Validate individual field
   */
  validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const value = field.value;
    let isValid = true;
    let errorMessage = '';

    switch (fieldId) {
      case 'examTime':
        const examValidation = ValidationHelpers.validateNumber(value, 1, 300);
        isValid = examValidation.valid;
        errorMessage = examValidation.error || '';
        break;
      
      case 'sectionTime':
        const sectionValidation = ValidationHelpers.validateNumber(value, 1, 60);
        isValid = sectionValidation.valid;
        errorMessage = sectionValidation.error || '';
        break;
      
      case 'questionTime':
        const questionValidation = ValidationHelpers.validateNumber(value, 0.5, 10);
        isValid = questionValidation.valid;
        errorMessage = questionValidation.error || '';
        break;
      
      case 'numQuestions':
        const numValidation = ValidationHelpers.validateNumber(value, 1, 100);
        isValid = numValidation.valid;
        errorMessage = numValidation.error || '';
        break;
      
      case 'passingScore':
        const scoreValidation = ValidationHelpers.validateNumber(value, 0, 100);
        isValid = scoreValidation.valid;
        errorMessage = scoreValidation.error || '';
        break;
    }

    // Update field styling
    field.classList.toggle('error', !isValid);
    
    // Show/hide error message
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!isValid && errorMessage) {
      if (!errorElement) {
        errorElement = DOMHelpers.createElement('div', { className: 'field-error' });
        field.parentNode.appendChild(errorElement);
      }
      errorElement.textContent = errorMessage;
    } else if (errorElement) {
      errorElement.remove();
    }

    return isValid;
  }

  /**
   * Handle CSV file upload
   */
  async handleCSVUpload(event) {
    const file = event.target.files[0];
    const statusElement = document.getElementById('csvStatus');

    if (!file) {
      statusElement.textContent = '';
      statusElement.className = 'status-message';
      return;
    }

    // Validate file type
    if (!ValidationHelpers.validateFileExtension(file.name, ['csv'])) {
      this.showStatus('csvStatus', 'Please select a valid CSV file.', 'error');
      return;
    }

    try {
      statusElement.textContent = 'Processing CSV file...';
      statusElement.className = 'status-message info';

      // Read and parse CSV
      const csvText = await this.readFileAsText(file);
      const csvData = await this.parseCSV(csvText);

      // Validate CSV data
      const validation = ValidationHelpers.validateCSVData(csvData);
      if (!validation.isValid) {
        this.showStatus('csvStatus', `CSV validation failed: ${validation.errors.join(', ')}`, 'error');
        return;
      }

      this.csvData = csvData;
      this.updateSectionFilter(csvData);
      this.showStatus('csvStatus', `Successfully loaded ${csvData.length} questions`, 'success');
      
      // Update max questions
      document.getElementById('numQuestions').max = csvData.length;

      // Dispatch event
      this.container.dispatchEvent(new CustomEvent('csvLoaded', {
        detail: { data: csvData }
      }));

    } catch (error) {
      console.error('CSV upload error:', error);
      this.showStatus('csvStatus', `Error processing CSV: ${error.message}`, 'error');
    }
  }

  /**
   * Read file as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse CSV text to array of objects
   */
  async parseCSV(csvText) {
    // Use the csv-manager.js if available, otherwise simple parsing
    if (window.parseCSV) {
      return window.parseCSV(csvText);
    }

    // Simple CSV parsing fallback
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  }

  /**
   * Update section filter options
   */
  updateSectionFilter(csvData) {
    const sectionFilter = document.getElementById('sectionFilter');
    const sections = [...new Set(csvData.map(row => row.Section || 'General'))];
    
    // Clear existing options except "All Sections"
    sectionFilter.innerHTML = '<option value="all">All Sections</option>';
    
    sections.forEach(section => {
      const option = DOMHelpers.createElement('option', { value: section }, section);
      sectionFilter.appendChild(option);
    });
  }

  /**
   * Update timer settings visibility
   */
  updateTimerSettings() {
    const timerMode = document.getElementById('timerMode').value;
    const examGroup = document.getElementById('examTimeGroup');
    const sectionGroup = document.getElementById('sectionTimeGroup');
    const questionGroup = document.getElementById('questionTimeGroup');

    // Hide all timer settings first
    DOMHelpers.toggleVisibility(examGroup, false);
    DOMHelpers.toggleVisibility(sectionGroup, false);
    DOMHelpers.toggleVisibility(questionGroup, false);

    // Show relevant settings based on mode
    switch (timerMode) {
      case 'exam':
        DOMHelpers.toggleVisibility(examGroup, true);
        break;
      case 'section':
        DOMHelpers.toggleVisibility(sectionGroup, true);
        break;
      case 'question':
        DOMHelpers.toggleVisibility(questionGroup, true);
        break;
    }
  }

  /**
   * Check AI availability
   */
  async checkAIAvailability() {
    const enableAI = document.getElementById('enableAI');
    const statusElement = document.getElementById('aiStatus');

    if (!enableAI.checked) {
      statusElement.textContent = '';
      statusElement.className = 'status-message';
      return;
    }

    try {
      statusElement.textContent = 'Checking AI availability...';
      statusElement.className = 'status-message info';

      // This would call the API service to check AI availability
      // For now, we'll simulate the check
      const response = await fetch('/api/check-ai');
      const result = await response.json();

      if (result.available) {
        this.showStatus('aiStatus', 'AI assessment is available', 'success');
      } else {
        this.showStatus('aiStatus', result.message || 'AI assessment is not available', 'warning');
      }
    } catch (error) {
      this.showStatus('aiStatus', 'Unable to verify AI availability', 'warning');
    }
  }

  /**
   * Show status message
   */
  showStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      element.className = `status-message ${type}`;
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      this.config = {
        timerMode: 'none',
        examTime: 60,
        sectionTime: 15,
        questionTime: 2,
        numQuestions: 10,
        randomize: true,
        passingScore: 70,
        showCorrectAnswers: true,
        enableAI: true
      };
      
      this.populateFormFields();
      this.updateTimerSettings();
      this.showStatus('csvStatus', 'Configuration reset to defaults', 'info');
    }
  }

  /**
   * Save configuration
   */
  saveConfiguration() {
    // Validate all fields
    const isValid = this.validateAllFields();
    if (!isValid) {
      this.showStatus('csvStatus', 'Please fix validation errors before saving', 'error');
      return;
    }

    // Collect configuration
    this.config = {
      timerMode: document.getElementById('timerMode').value,
      examTime: parseInt(document.getElementById('examTime').value) || 60,
      sectionTime: parseInt(document.getElementById('sectionTime').value) || 15,
      questionTime: parseFloat(document.getElementById('questionTime').value) || 2,
      numQuestions: parseInt(document.getElementById('numQuestions').value) || 10,
      passingScore: parseInt(document.getElementById('passingScore').value) || 70,
      randomize: document.getElementById('randomize').checked,
      showCorrectAnswers: document.getElementById('showCorrectAnswers').checked,
      enableAI: document.getElementById('enableAI').checked,
      section: document.getElementById('sectionFilter').value,
      difficulty: document.getElementById('difficultyFilter').value
    };

    // Save to storage
    this.storageService.saveQuizConfig(this.config);
    this.showStatus('csvStatus', 'Configuration saved successfully', 'success');

    // Dispatch event
    this.container.dispatchEvent(new CustomEvent('configSaved', {
      detail: { config: this.config }
    }));
  }

  /**
   * Validate all fields
   */
  validateAllFields() {
    const fields = ['examTime', 'sectionTime', 'questionTime', 'numQuestions', 'passingScore'];
    return fields.every(fieldId => this.validateField(fieldId));
  }

  /**
   * Start quiz with current configuration
   */
  startQuiz() {
    if (!this.csvData) {
      this.showStatus('csvStatus', 'Please upload a CSV file first', 'error');
      return;
    }

    // Save configuration first
    this.saveConfiguration();

    // Dispatch start quiz event
    this.container.dispatchEvent(new CustomEvent('startQuiz', {
      detail: { 
        config: this.config,
        csvData: this.csvData
      }
    }));
  }

  /**
   * Show configuration panel
   */
  show() {
    this.isVisible = true;
    DOMHelpers.toggleVisibility(this.container, true, true);
    this.container.classList.add('visible');
  }

  /**
   * Hide configuration panel
   */
  hide() {
    this.isVisible = false;
    this.container.classList.remove('visible');
    DOMHelpers.toggleVisibility(this.container, false, true);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (this.isVisible) {
      this.populateFormFields();
      this.updateTimerSettings();
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.eventManager.cleanup();
  }
}
