// Configuration Panel Component
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { ValidationHelpers } from '../utils/ValidationHelpers.js';
import { EventManager } from '../utils/EventManager.js';
import QuestionSupplementManager from '../services/QuestionSupplementManager.js';
import SupplementationDialog from './SupplementationDialog.js';

export class ConfigurationPanel {
  constructor(container, storageService, apiService, notifications) {
    this.container = container;
    this.storageService = storageService;
    this.apiService = apiService;
    this.notifications = notifications;
    this.eventManager = new EventManager();
    this.config = {};
    this.csvData = null;
    this.isVisible = false;
    
    // These will be set by QuizApp after initialization
    this.apiKeyManager = null;
    this.supplementManager = null;
    this.supplementDialog = null;
  }

  /**
   * Initialize the configuration panel
   */
  init() {
    this.loadConfig();
    this.render();
    this.attachEventListeners();
    
    // Load initial question bank statistics
    this.refreshQuestionBankStats();
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
          <!-- Multi-CSV Upload Section -->
          <div class="config-section">
            <h3>Question Source</h3>
            
            <!-- Upload Mode Toggle -->
            <div class="form-group">
              <label class="upload-mode-toggle">
                <input type="checkbox" id="multiUploadMode"> Enable Multiple CSV Upload
              </label>
              <small class="help-text">Upload multiple CSV files to build a question bank</small>
            </div>

            <!-- Single CSV Upload (Legacy) -->
            <div id="singleUploadSection" class="upload-section">
              <div class="form-group">
                <label for="csvFile">Upload CSV File:</label>
                <input type="file" id="csvFile" accept=".csv" class="form-control">
                <small class="help-text">CSV should contain: Question, Option A, Option B, Option C, Option D, Correct Answer</small>
              </div>
              <div id="csvStatus" class="status-message"></div>
            </div>

            <!-- Multiple CSV Upload -->
            <div id="multiUploadSection" class="upload-section" style="display: none;">
              <!-- Upload Limits Display -->
              <div class="upload-limits">
                <span class="limit-text" id="uploadLimitsText">Max 5 files, 10MB total, 1000 rows per file</span>
              </div>

              <!-- Drag & Drop Zone -->
              <div class="csv-drop-zone" id="csvDropZone">
                <div class="drop-zone-content">
                  <div class="drop-icon">📁</div>
                  <p>Drag & drop CSV files here or <span class="browse-link" id="browseCsvs">browse files</span></p>
                  <input type="file" id="multiCsvFiles" accept=".csv" multiple style="display: none;">
                </div>
              </div>

              <!-- Upload Options -->
              <div class="upload-options">
                <div class="form-group">
                  <label for="mergeStrategy">Merge Strategy:</label>
                  <select id="mergeStrategy" class="form-control">
                    <option value="skip">Skip duplicates (default)</option>
                    <option value="overwrite">Overwrite existing</option>
                    <option value="force">Create new (force)</option>
                    <option value="merge">Merge fields</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="uploadStrictness">Validation Mode:</label>
                  <select id="uploadStrictness" class="form-control">
                    <option value="lenient">Lenient (skip invalid rows)</option>
                    <option value="strict">Strict (reject file on error)</option>
                  </select>
                </div>
              </div>

              <!-- File Preview Section -->
              <div id="filePreviewSection" class="file-preview-section" style="display: none;">
                <h4>File Previews</h4>
                <div id="filePreviewList" class="file-preview-list"></div>
                
                <!-- Action Buttons -->
                <div class="upload-actions">
                  <button type="button" id="clearFiles" class="btn btn-secondary">Clear All</button>
                  <button type="button" id="uploadFiles" class="btn btn-primary" disabled>Upload to Question Bank</button>
                </div>
              </div>

              <!-- Upload Progress -->
              <div id="uploadProgress" class="upload-progress" style="display: none;">
                <div class="upload-progress-bar">
                  <div class="upload-progress-fill" id="progressFill"></div>
                </div>
                <div class="progress-text" id="progressText">Uploading...</div>
              </div>

              <!-- Upload Results -->
              <div id="uploadResults" class="upload-results" style="display: none;"></div>
            </div>
          </div>

          <!-- Question Bank Statistics -->
          <div class="config-section">
            <h3>Question Bank Status</h3>
            <div id="questionBankStats" class="question-bank-stats">
              <div class="stats-loading">Loading question bank statistics...</div>
            </div>
            <div class="form-group">
              <button type="button" id="refreshStats" class="btn btn-secondary">Refresh Statistics</button>
              <button type="button" id="exportQuestionBank" class="btn btn-outline">Export Question Bank</button>
            </div>
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
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const csvFile = document.getElementById('csvFile');
    const multiUploadMode = document.getElementById('multiUploadMode');
    const multiCsvFiles = document.getElementById('multiCsvFiles');
    const browseCsvs = document.getElementById('browseCsvs');
    const csvDropZone = document.getElementById('csvDropZone');
    const clearFiles = document.getElementById('clearFiles');
    const uploadFiles = document.getElementById('uploadFiles');
    const timerMode = document.getElementById('timerMode');
    const closeBtn = document.getElementById('closeConfig');
    const resetBtn = document.getElementById('resetConfig');
    const saveBtn = document.getElementById('saveConfig');
    const startBtn = document.getElementById('startQuiz');

    // CSV file upload (single)
    this.eventManager.on(csvFile, 'change', (e) => this.handleCSVUpload(e));

    // Multi-upload mode toggle
    this.eventManager.on(multiUploadMode, 'change', (e) => this.toggleUploadMode(e.target.checked));

    // Multi-CSV file selection
    this.eventManager.on(multiCsvFiles, 'change', (e) => this.handleMultiCSVSelection(e));
    this.eventManager.on(browseCsvs, 'click', () => multiCsvFiles.click());

    // Drag and drop handlers
    this.eventManager.on(csvDropZone, 'dragover', (e) => this.handleDragOver(e));
    this.eventManager.on(csvDropZone, 'dragleave', (e) => this.handleDragLeave(e));
    this.eventManager.on(csvDropZone, 'drop', (e) => this.handleDrop(e));

    // Multi-upload action buttons
    this.eventManager.on(clearFiles, 'click', () => this.clearSelectedFiles());
    this.eventManager.on(uploadFiles, 'click', () => this.uploadToQuestionBank());

    // Question bank management
    const refreshStats = document.getElementById('refreshStats');
    const exportQuestionBank = document.getElementById('exportQuestionBank');
    this.eventManager.on(refreshStats, 'click', () => this.refreshQuestionBankStats());
    this.eventManager.on(exportQuestionBank, 'click', () => this.exportQuestionBank());

    // Timer mode change
    this.eventManager.on(timerMode, 'change', () => this.updateTimerSettings());

    // Button events
    this.eventManager.on(closeBtn, 'click', () => this.hide());
    this.eventManager.on(resetBtn, 'click', () => this.resetToDefaults());
    this.eventManager.on(saveBtn, 'click', () => this.saveConfiguration());
    this.eventManager.on(startBtn, 'click', () => this.startQuiz());

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
   * Toggle between single and multi-upload modes
   */
  toggleUploadMode(isMultiMode) {
    const singleSection = document.getElementById('singleUploadSection');
    const multiSection = document.getElementById('multiUploadSection');
    
    if (isMultiMode) {
      singleSection.style.display = 'none';
      multiSection.style.display = 'block';
      this.initializeUploadLimits();
    } else {
      singleSection.style.display = 'block';
      multiSection.style.display = 'none';
      this.clearSelectedFiles();
    }
  }

  /**
   * Initialize upload limits display
   */
  initializeUploadLimits() {
    const config = this.storageService.getQuizConfig();
    const limits = config.importLimits || {
      maxFiles: 5,
      maxTotalSizeMB: 10,
      maxRowsPerFile: 1000
    };
    
    const limitsText = document.getElementById('uploadLimitsText');
    limitsText.textContent = `Max ${limits.maxFiles} files, ${limits.maxTotalSizeMB}MB total, ${limits.maxRowsPerFile} rows per file`;
    
    this.uploadLimits = limits;
  }

  /**
   * Handle multi-CSV file selection
   */
  async handleMultiCSVSelection(event) {
    const files = Array.from(event.target.files);
    await this.processSelectedFiles(files);
  }

  /**
   * Handle drag over event
   */
  handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropZone = document.getElementById('csvDropZone');
    dropZone.classList.add('drag-over');
  }

  /**
   * Handle drag leave event
   */
  handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropZone = document.getElementById('csvDropZone');
    dropZone.classList.remove('drag-over');
  }

  /**
   * Handle file drop
   */
  async handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const dropZone = document.getElementById('csvDropZone');
    dropZone.classList.remove('drag-over');
    
    const files = Array.from(event.dataTransfer.files).filter(file => 
      file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
    );
    
    if (files.length === 0) {
      this.showUploadMessage('No CSV files found in drop', 'error');
      return;
    }
    
    await this.processSelectedFiles(files);
  }

  /**
   * Process selected files with validation and preview
   */
  async processSelectedFiles(files) {
    const limits = this.uploadLimits || { maxFiles: 5, maxTotalSizeMB: 10, maxRowsPerFile: 1000 };
    
    // Validate file count
    if (files.length > limits.maxFiles) {
      this.showUploadMessage(`Too many files. Maximum ${limits.maxFiles} allowed.`, 'error');
      return;
    }
    
    // Validate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    if (totalSizeMB > limits.maxTotalSizeMB) {
      this.showUploadMessage(`Total file size too large. Maximum ${limits.maxTotalSizeMB}MB allowed.`, 'error');
      return;
    }
    
    this.selectedFiles = [];
    const previewList = document.getElementById('filePreviewList');
    previewList.innerHTML = '';
    
    let allValid = true;
    
    for (const file of files) {
      try {
        const fileInfo = await this.validateAndPreviewFile(file, limits);
        this.selectedFiles.push(fileInfo);
        this.renderFilePreview(fileInfo);
        
        if (fileInfo.status === 'error') {
          allValid = false;
        }
      } catch (error) {
        console.error('Error processing file:', error);
        allValid = false;
      }
    }
    
    // Show preview section and update upload button
    document.getElementById('filePreviewSection').style.display = 'block';
    document.getElementById('uploadFiles').disabled = !allValid || this.selectedFiles.length === 0;
  }

  /**
   * Validate and preview individual file
   */
  async validateAndPreviewFile(file, limits) {
    const fileInfo = {
      file,
      name: file.name,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      status: 'processing',
      preview: [],
      rowCount: 0,
      validRows: 0,
      errors: []
    };
    
    try {
      // Read and parse CSV
      const csvText = await this.readFileAsText(file);
      const lines = csvText.trim().split('\n');
      
      if (lines.length === 0) {
        fileInfo.status = 'error';
        fileInfo.errors.push('Empty file');
        return fileInfo;
      }
      
      // Check row count limit
      if (lines.length - 1 > limits.maxRowsPerFile) {
        fileInfo.status = 'error';
        fileInfo.errors.push(`Too many rows: ${lines.length - 1} (max ${limits.maxRowsPerFile})`);
        return fileInfo;
      }
      
      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['question'];
      const missingHeaders = requiredHeaders.filter(h => 
        !headers.some(header => header.toLowerCase().includes(h.toLowerCase()))
      );
      
      if (missingHeaders.length > 0) {
        fileInfo.status = 'error';
        fileInfo.errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return fileInfo;
      }
      
      // Preview first 5 rows
      fileInfo.headers = headers;
      fileInfo.rowCount = lines.length - 1;
      
      let validCount = 0;
      for (let i = 1; i <= Math.min(6, lines.length - 1); i++) {
        const row = this.parseCSVRow(lines[i]);
        if (row.length === headers.length) {
          validCount++;
          if (i <= 5) {
            const rowObj = {};
            headers.forEach((header, idx) => {
              rowObj[header] = row[idx];
            });
            fileInfo.preview.push(rowObj);
          }
        }
      }
      
      fileInfo.validRows = validCount;
      fileInfo.status = validCount > 0 ? 'valid' : 'warning';
      
      if (validCount === 0) {
        fileInfo.errors.push('No valid data rows found');
      } else if (validCount < Math.min(5, fileInfo.rowCount)) {
        fileInfo.errors.push('Some rows have parsing issues');
      }
      
    } catch (error) {
      fileInfo.status = 'error';
      fileInfo.errors.push(`Parse error: ${error.message}`);
    }
    
    return fileInfo;
  }

  /**
   * Parse CSV row handling quotes and commas
   */
  parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Render file preview in the UI
   */
  renderFilePreview(fileInfo) {
    const previewContainer = document.createElement('div');
    previewContainer.className = `file-preview ${fileInfo.status}`;
    
    const statusIcon = fileInfo.status === 'valid' ? '✅' : 
                      fileInfo.status === 'warning' ? '⚠️' : '❌';
    
    const previewHTML = `
      <div class="file-header">
        <span class="file-status">${statusIcon}</span>
        <span class="file-name">${fileInfo.name}</span>
        <span class="file-info">${fileInfo.sizeMB}MB, ${fileInfo.rowCount} rows</span>
        <button class="remove-file-btn" onclick="this.closest('.file-preview').remove()">×</button>
      </div>
      ${fileInfo.errors.length > 0 ? `
        <div class="file-errors">
          ${fileInfo.errors.map(error => `<div class="error-item">• ${error}</div>`).join('')}
        </div>
      ` : ''}
      ${fileInfo.preview.length > 0 ? `
        <div class="file-preview-table">
          <table class="preview-table">
            <thead>
              <tr>
                ${fileInfo.headers.slice(0, 5).map(h => `<th>${h}</th>`).join('')}
                ${fileInfo.headers.length > 5 ? '<th>...</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${fileInfo.preview.map(row => `
                <tr>
                  ${fileInfo.headers.slice(0, 5).map(h => `<td>${(row[h] || '').substring(0, 50)}${(row[h] || '').length > 50 ? '...' : ''}</td>`).join('')}
                  ${fileInfo.headers.length > 5 ? '<td>...</td>' : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
    
    previewContainer.innerHTML = previewHTML;
    document.getElementById('filePreviewList').appendChild(previewContainer);
  }

  /**
   * Clear all selected files
   */
  clearSelectedFiles() {
    this.selectedFiles = [];
    document.getElementById('filePreviewList').innerHTML = '';
    document.getElementById('filePreviewSection').style.display = 'none';
    document.getElementById('multiCsvFiles').value = '';
    document.getElementById('uploadFiles').disabled = true;
  }

  /**
   * Upload files to question bank
   */
  async uploadToQuestionBank() {
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      return;
    }
    
    const validFiles = this.selectedFiles.filter(f => f.status === 'valid' || f.status === 'warning');
    if (validFiles.length === 0) {
      this.showUploadMessage('No valid files to upload', 'error');
      return;
    }

    // Show progress
    const progressSection = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('uploadResults');
    
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    try {
      // Prepare files and options for professional API
      const files = validFiles.map(fileInfo => fileInfo.file);
      const options = {
        mergeStrategy: document.getElementById('mergeStrategy').value,
        strictness: document.getElementById('uploadStrictness').value,
        owner: 'user', // TODO: get from user context
        tags: []
      };

      // Use the professional API service
      progressText.textContent = 'Uploading to question bank...';
      progressFill.style.width = '50%';
      
      const result = await this.apiService.uploadCSVsToQuestionBank(files, options);
      
      progressFill.style.width = '100%';
      progressText.textContent = 'Upload complete!';
      
      // Show results
      setTimeout(() => {
        progressSection.style.display = 'none';
        this.showUploadResults(result);
      }, 500);
      
      // Clear files on success
      this.clearSelectedFiles();
      
      // Notify parent app of successful upload
      if (this.notifications && result.summary) {
        const processed = result.summary.processed || result.summary.added || 0;
        this.notifications.showSuccess(`Successfully uploaded ${processed} questions to the question bank!`);
      }
      
      // Refresh question bank statistics
      this.refreshQuestionBankStats();
      
      // Refresh the parent app's question service if available
      this.notifications?.refreshQuestions?.();
      
    } catch (error) {
      console.error('Upload error:', error);
      progressSection.style.display = 'none';
      this.showUploadMessage(`Upload failed: ${error.message}`, 'error');
      
      // Also notify parent app of error
      if (this.notifications) {
        this.notifications.showError(`Question bank upload failed: ${error.message}`);
      }
    }
  }

  /**
   * Upload with progress tracking
   */
  uploadWithProgress(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr);
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });
      
      xhr.open('POST', '/api/upload-csvs');
      xhr.send(formData);
    });
  }

  /**
   * Show upload results
   */
  showUploadResults(result) {
    const resultsSection = document.getElementById('uploadResults');
    const { summary, detailsPerFile } = result;
    
    const resultsHTML = `
      <h4>Upload Complete</h4>
      <div class="upload-summary">
        <div class="summary-item">
          <span class="label">Processed:</span>
          <span class="value">${summary.processed} questions</span>
        </div>
        <div class="summary-item">
          <span class="label">Added:</span>
          <span class="value">${summary.added} new</span>
        </div>
        <div class="summary-item">
          <span class="label">Updated:</span>
          <span class="value">${summary.updated} existing</span>
        </div>
        <div class="summary-item">
          <span class="label">Skipped:</span>
          <span class="value">${summary.skipped} duplicates</span>
        </div>
      </div>
      ${summary.errors && summary.errors.length > 0 ? `
        <div class="upload-errors">
          <h5>Errors:</h5>
          ${summary.errors.map(error => `<div class="error-item">• ${error}</div>`).join('')}
        </div>
      ` : ''}
    `;
    
    resultsSection.innerHTML = resultsHTML;
    resultsSection.style.display = 'block';
  }

  /**
   * Show upload message
   */
  showUploadMessage(message, type = 'info') {
    const resultsSection = document.getElementById('uploadResults');
    resultsSection.innerHTML = `<div class="upload-message ${type}">${message}</div>`;
    resultsSection.style.display = 'block';
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
        showCorrectAnswers: true
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
   * Get the count of available questions based on current filters
   * @returns {number} Number of available questions
   */
  getAvailableQuestionCount() {
    if (!this.csvData || !Array.isArray(this.csvData)) {
      return 0;
    }

    // Apply section filter if specified
    const sectionFilter = this.config.sectionFilter;
    if (sectionFilter && sectionFilter !== 'all') {
      return this.csvData.filter(q => q.Section === sectionFilter).length;
    }

    return this.csvData.length;
  }

  /**
   * Handle question shortage by showing supplementation dialog
   * @param {number} requestedCount - Number of questions requested
   * @param {number} availableCount - Number of questions available
   */
  async handleQuestionShortage(requestedCount, availableCount) {
    const missingCount = requestedCount - availableCount;
    
    // Check if AI is available
    const hasValidAPIKey = this.apiKeyManager ? this.apiKeyManager.isAvailable() : false;
    const aiStatus = this.apiKeyManager ? this.apiKeyManager.getStatus() : { provider: 'OpenAI' };
    const provider = aiStatus.provider || 'OpenAI';

    // Show supplementation dialog
    this.supplementDialog.show({
      requested: requestedCount,
      available: availableCount,
      provider: provider,
      hasValidAPIKey: hasValidAPIKey,
      callbacks: {
        onConfirm: (result) => this.handleSupplementationConfirm(result),
        onCancel: () => this.handleSupplementationCancel(),
        onConfigureAPI: () => this.handleConfigureAPI()
      }
    });
  }

  /**
   * Handle supplementation confirmation
   * @param {Object} result - User's choice and configuration
   */
  async handleSupplementationConfirm(result) {
    if (result.action === 'useAvailable') {
      // Proceed with available questions only
      this.config.numQuestions = result.available;
      this.proceedWithQuiz();
    } else if (result.action === 'generate') {
      // Generate missing questions with AI
      await this.generateMissingQuestions(result);
    }
  }

  /**
   * Handle supplementation cancellation
   */
  handleSupplementationCancel() {
    // User cancelled, return to configuration
    this.showStatus('csvStatus', 'Quiz start cancelled - please adjust question count or upload more questions', 'info');
  }

  /**
   * Handle API configuration request
   */
  handleConfigureAPI() {
    // Focus on API key management section (this would need to be implemented based on your UI)
    this.showStatus('csvStatus', 'Please configure your AI provider API key in the AI Assessment section', 'info');
    
    // If there's an API key manager UI, focus on it
    if (this.apiKeyManager && typeof this.apiKeyManager.show === 'function') {
      this.apiKeyManager.show();
    }
  }

  /**
   * Generate missing questions using AI
   * @param {Object} options - Generation options from user
   */
  async generateMissingQuestions(options) {
    try {
      this.supplementDialog.showLoadingState();
      this.showStatus('csvStatus', 'Generating missing questions with AI...', 'info');

      // Generate questions using the supplement manager
      const result = await this.supplementManager.supplementQuestions(
        this.csvData,
        options.missing,
        {
          persist: options.persist,
          provider: this.apiKeyManager?.getStatus()?.provider || 'openai'
        }
      );

      if (result.success && result.questions.length > 0) {
        // Add generated questions to CSV data
        if (options.persist) {
          this.csvData = [...this.csvData, ...result.questions];
          this.updateSectionFilter(this.csvData);
          
          // Update max questions
          document.getElementById('numQuestions').max = this.csvData.length;
        }

        this.supplementDialog.showGenerationResult(result);
        this.showStatus('csvStatus', 
          `Successfully generated ${result.questions.length} questions. Starting quiz...`, 'success');

        // Proceed with quiz after a short delay
        setTimeout(() => {
          this.proceedWithQuiz();
        }, 2000);

      } else {
        // Show error in dialog
        this.supplementDialog.showGenerationResult({
          success: false,
          error: result.error || 'Failed to generate questions'
        });
        this.showStatus('csvStatus', `Question generation failed: ${result.error}`, 'error');
      }

    } catch (error) {
      console.error('Question generation error:', error);
      this.supplementDialog.showGenerationResult({
        success: false,
        error: error.message || 'Unknown error during generation'
      });
      this.showStatus('csvStatus', `Question generation failed: ${error.message}`, 'error');
    }
  }

  /**
   * Proceed with quiz using current configuration and data
   */
  proceedWithQuiz() {
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
   * Start quiz with current configuration
   */
  async startQuiz() {
    // Check if we have questions either from CSV upload or question bank
    const hasCSVData = this.csvData && Array.isArray(this.csvData) && this.csvData.length > 0;
    
    if (!hasCSVData) {
      // Try to get questions from question bank
      try {
        const questionBankStats = await this.apiService.getQuestionBankStats();
        if (questionBankStats.success && questionBankStats.totalQuestions > 0) {
          // Use question bank questions
          const questionsResponse = await this.apiService.request('/api/question-bank/questions');
          this.csvData = questionsResponse.questions || [];
          console.log(`📚 Using ${this.csvData.length} questions from question bank`);
        } else {
          this.showStatus('csvStatus', 'Please upload a CSV file first or ensure question bank has questions', 'error');
          return;
        }
      } catch (error) {
        this.showStatus('csvStatus', 'Please upload a CSV file first', 'error');
        return;
      }
    }

    // Get requested number of questions
    const requestedCount = parseInt(document.getElementById('numQuestions').value) || 10;
    const availableCount = this.getAvailableQuestionCount();

    console.log(`🎯 Quiz start requested: ${requestedCount} questions, ${availableCount} available`);

    // Check for question shortage
    if (requestedCount > availableCount) {
      await this.handleQuestionShortage(requestedCount, availableCount);
      return; // Stop normal flow - dialog will handle next steps
    }

    // Sufficient questions available - proceed normally
    this.proceedWithQuiz();
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
   * Refresh question bank statistics
   */
  async refreshQuestionBankStats() {
    const statsContainer = document.getElementById('questionBankStats');
    if (!this.apiService) {
      statsContainer.innerHTML = '<div class="stats-error">API service not available</div>';
      return;
    }

    try {
      statsContainer.innerHTML = '<div class="stats-loading">Loading statistics...</div>';
      
      const stats = await this.apiService.getQuestionBankStats();
      
      const statsHTML = `
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${stats.totalQuestions || 0}</div>
            <div class="stat-label">Total Questions</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.uniqueSources || 0}</div>
            <div class="stat-label">Sources</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'Never'}</div>
            <div class="stat-label">Last Updated</div>
          </div>
        </div>
        ${stats.tagCounts && Object.keys(stats.tagCounts).length > 0 ? `
          <div class="stats-section">
            <h4>Tags</h4>
            <div class="tag-list">
              ${Object.entries(stats.tagCounts).map(([tag, count]) => 
                `<span class="tag-item">${tag} (${count})</span>`
              ).join('')}
            </div>
          </div>
        ` : ''}
      `;
      
      statsContainer.innerHTML = statsHTML;
      
    } catch (error) {
      console.error('Error loading question bank stats:', error);
      statsContainer.innerHTML = '<div class="stats-error">Failed to load statistics</div>';
    }
  }

  /**
   * Export question bank
   */
  async exportQuestionBank() {
    if (!this.apiService) {
      if (this.notifications) {
        this.notifications.showError('API service not available for export');
      }
      return;
    }

    try {
      const exportData = await this.apiService.exportQuestionBank();
      
      // Create download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `question-bank-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (this.notifications) {
        this.notifications.showSuccess('Question bank exported successfully!');
      }
      
    } catch (error) {
      console.error('Error exporting question bank:', error);
      if (this.notifications) {
        this.notifications.showError(`Export failed: ${error.message}`);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.eventManager.cleanup();
  }
}

// CSS Styles for Multi-CSV Upload
export const MULTI_CSV_UPLOAD_STYLES = `
/* Upload Mode Toggle */
.upload-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.upload-mode-toggle input[type="checkbox"] {
  margin: 0;
}

/* Upload Sections */
.upload-section {
  transition: all 0.3s ease;
}

/* Upload Limits */
.upload-limits {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 16px;
  text-align: center;
}

.limit-text {
  font-size: 0.9em;
  color: #6c757d;
  font-weight: 500;
}

/* Drag & Drop Zone */
.csv-drop-zone {
  border: 2px dashed #007bff;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 20px;
}

.csv-drop-zone:hover,
.csv-drop-zone.drag-over {
  border-color: #0056b3;
  background: #e3f2fd;
}

.drop-zone-content {
  pointer-events: none;
}

.drop-icon {
  font-size: 2.5em;
  margin-bottom: 10px;
}

.browse-link {
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
  pointer-events: all;
}

.browse-link:hover {
  color: #0056b3;
}

/* Upload Options */
.upload-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .upload-options {
    grid-template-columns: 1fr;
  }
}

/* File Preview Section */
.file-preview-section {
  border-top: 1px solid #e9ecef;
  padding-top: 20px;
}

.file-preview-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
}

/* Individual File Preview */
.file-preview {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
  background: white;
}

.file-preview.valid {
  border-color: #28a745;
}

.file-preview.warning {
  border-color: #ffc107;
}

.file-preview.error {
  border-color: #dc3545;
}

.file-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  gap: 12px;
}

.file-status {
  font-size: 1.2em;
}

.file-name {
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-info {
  font-size: 0.9em;
  color: #6c757d;
}

.remove-file-btn {
  background: none;
  border: none;
  font-size: 1.5em;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.remove-file-btn:hover {
  background: #dc3545;
  color: white;
}

/* File Errors */
.file-errors {
  padding: 12px 16px;
  background: #fff5f5;
  border-bottom: 1px solid #e9ecef;
}

.error-item {
  color: #dc3545;
  font-size: 0.9em;
  margin-bottom: 4px;
}

.error-item:last-child {
  margin-bottom: 0;
}

/* Preview Table */
.file-preview-table {
  padding: 16px;
  max-height: 200px;
  overflow: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}

.preview-table th,
.preview-table td {
  border: 1px solid #e9ecef;
  padding: 6px 8px;
  text-align: left;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-table th {
  background: #f8f9fa;
  font-weight: 600;
  position: sticky;
  top: 0;
}

/* Upload Actions */
.upload-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

/* Upload Progress */
.upload-progress {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  width: 0%;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 0.9em;
  color: #6c757d;
}

/* Upload Results */
.upload-results {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  margin-top: 20px;
  background: white;
}

.upload-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  text-align: center;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.summary-item .label {
  font-size: 0.8em;
  color: #6c757d;
  margin-bottom: 4px;
}

.summary-item .value {
  font-weight: 600;
  color: #495057;
}

.upload-errors {
  border-top: 1px solid #e9ecef;
  padding-top: 16px;
}

.upload-message {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.upload-message.error {
  background: #fff5f5;
  color: #dc3545;
  border: 1px solid #f5c6cb;
}

.upload-message.info {
  background: #e3f2fd;
  color: #0277bd;
  border: 1px solid #b3e5fc;
}

.upload-message.success {
  background: #f0f9f0;
  color: #28a745;
  border: 1px solid #c3e6cb;
}

/* Responsive Design */
@media (max-width: 768px) {
  .file-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .file-info {
    order: 3;
    width: 100%;
  }
  
  .upload-actions {
    flex-direction: column;
  }
  
  .upload-summary {
    grid-template-columns: 1fr 1fr;
  }
}
`;
