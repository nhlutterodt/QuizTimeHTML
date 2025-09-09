// Main Quiz Application Orchestrator - Enhanced with Professional Integration
import { QuestionService } from '../services/QuestionService.js';
import { APIService } from '../services/APIService.js';
import { StorageService } from '../services/StorageService.js';
import { ConfigurationPanel } from './ConfigurationPanel.js';
import { TimerManager } from './TimerManager.js';
import { QuizRenderer } from './QuizRenderer.js';
import { AIAssessment } from './AIAssessment.js';
import { APIKeyManager } from './APIKeyManager.js';
import { ResultsManager } from './ResultsManager.js';
import { EventManager } from '../utils/EventManager.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class QuizApp {
  constructor() {
    // Initialize services with professional integration
    this.storageService = new StorageService();
    this.questionService = new QuestionService(this.storageService); // Pass storage service
    this.apiService = new APIService();
    this.eventManager = new EventManager();
    
    // Initialize components
    this.configPanel = null;
    this.timerManager = null;
    this.quizRenderer = null;
    this.aiAssessment = null;
    this.apiKeyManager = null;
    this.resultsManager = null;
    
    // Application state
    this.currentState = 'configuration'; // configuration, quiz, results
    this.quizConfig = {};
    this.isQuizActive = false;
    this.questionBankLoaded = false;
    
    // DOM elements
    this.containers = {};
  }

  /**
   * Initialize the quiz application
   */
  async init() {
    try {
      console.log('Initializing Quiz Application...');
      
      // Initialize DOM containers
      this.initializeContainers();
      
      // Initialize services
      await this.initializeServices();
      
      // Initialize components
      this.initializeComponents();
      
      // Set up global event listeners
      this.setupGlobalEventListeners();
      
      // Show configuration panel by default
      this.showConfiguration();
      
      console.log('Quiz Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Quiz Application:', error);
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }

  /**
   * Initialize DOM containers
   */
  initializeContainers() {
    // Main application container
    this.containers.app = DOMHelpers.getElementById('quizApp') || document.body;
    
    // Create main layout if it doesn't exist
    if (!DOMHelpers.getElementById('configurationContainer')) {
      this.createMainLayout();
    }
    
    // Get container references
    this.containers.configuration = DOMHelpers.getElementById('configurationContainer');
    this.containers.quiz = DOMHelpers.getElementById('quizContainer');
    this.containers.results = DOMHelpers.getElementById('resultsContainer');
    this.containers.timer = DOMHelpers.getElementById('timerContainer');
    this.containers.nav = DOMHelpers.getElementById('navigationContainer');
  }

  /**
   * Create main application layout
   */
  createMainLayout() {
    const layout = `
      <div id="quizApp" class="quiz-application">
        <!-- Header -->
        <header class="app-header">
          <h1>Quiz Application</h1>
          <div id="timerContainer" class="timer-container"></div>
          <div class="header-controls">
            <button id="configBtn" class="btn btn-secondary">Configuration</button>
            <button id="pauseBtn" class="btn btn-warning" style="display: none;">Pause</button>
            <button id="resumeBtn" class="btn btn-success" style="display: none;">Resume</button>
          </div>
        </header>

        <!-- Navigation -->
        <nav id="navigationContainer" class="quiz-navigation" style="display: none;"></nav>

        <!-- Main Content -->
        <main class="app-main">
          <!-- Configuration Panel -->
          <div id="configurationContainer" class="container configuration-container"></div>
          
          <!-- Quiz Container -->
          <div id="quizContainer" class="container quiz-container" style="display: none;"></div>
          
          <!-- Results Container -->
          <div id="resultsContainer" class="container results-container" style="display: none;"></div>
        </main>

        <!-- Status Messages -->
        <div id="statusMessages" class="status-messages"></div>
        
        <!-- Loading Overlay -->
        <div id="loadingOverlay" class="loading-overlay" style="display: none;">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading...</div>
        </div>
      </div>
    `;

    this.containers.app.innerHTML = layout;
    this.updateContainerReferences();
  }

  /**
   * Update container references after layout creation
   */
  updateContainerReferences() {
    this.containers.configuration = DOMHelpers.getElementById('configurationContainer');
    this.containers.quiz = DOMHelpers.getElementById('quizContainer');
    this.containers.results = DOMHelpers.getElementById('resultsContainer');
    this.containers.timer = DOMHelpers.getElementById('timerContainer');
    this.containers.nav = DOMHelpers.getElementById('navigationContainer');
  }

  /**
   * Initialize services with professional integration
   */
  async initializeServices() {
    try {
      console.log('🔧 Initializing services...');
      
      // Check storage availability
      if (!this.storageService.isLocalStorageAvailable()) {
        console.warn('LocalStorage not available - some features may be limited');
      }

      // Initialize question service with storage integration
      // Note: QuestionService constructor already passed storageService,
      // but we need to explicitly initialize the manager
      await this.questionService.initializeManager();
      this.questionBankLoaded = true;
      
      // Check if we have questions in the bank
      const questionCount = this.questionService.questionManager.getAllQuestions().length;
      console.log(`📚 Question bank loaded with ${questionCount} questions`);
      
      // If no questions, try to migrate from legacy CSV
      if (questionCount === 0) {
        await this.attemptLegacyMigration();
      }

      // Check API health
      const healthStatus = await this.apiService.getHealthStatus();
      if (!healthStatus.healthy) {
        console.warn('API service may be unavailable:', healthStatus.error);
      }
      
      console.log('✅ Services initialized successfully');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      this.questionBankLoaded = false;
      // Continue with degraded functionality
    }
  }

  /**
   * Attempt to migrate from legacy questions.csv
   */
  async attemptLegacyMigration() {
    try {
      console.log('🔄 Attempting legacy migration...');
      const migrationResult = await this.apiService.migrateExistingQuestions();
      
      if (migrationResult.success && migrationResult.summary.added > 0) {
        const added = migrationResult.summary.added;
        console.log(`✅ Migrated ${added} questions from legacy CSV`);
        this.showSuccess(`Successfully migrated ${added} questions from legacy CSV to the professional question bank.`);
        
        // Show detailed results if available
        if (migrationResult.summary.errors && migrationResult.summary.errors.length > 0) {
          this.showWarning(`${migrationResult.summary.errors.length} questions had issues during migration. Check console for details.`);
        }
        
        // Refresh question service
        this.questionService.refreshActiveQuestions();
      } else {
        console.log('ℹ️ No legacy questions found to migrate');
      }
    } catch (error) {
      console.warn('⚠️ Legacy migration failed:', error);
      this.showWarning('Legacy question migration failed, but you can still upload CSV files manually.');
    }
  }

  /**
   * Initialize components
   */
  initializeComponents() {
    // Configuration Panel
    // Configuration Panel with professional API integration
    this.configPanel = new ConfigurationPanel(
      this.containers.configuration,
      this.storageService,
      this.apiService,
      {
        showSuccess: (msg) => this.showSuccess(msg),
        showWarning: (msg) => this.showWarning(msg),
        showError: (msg) => this.showError(msg),
        refreshQuestions: () => this.questionService.refreshActiveQuestions()
      }
    );
    this.configPanel.init();

    // API Key Manager
    this.apiKeyManager = new APIKeyManager();
    this.apiKeyManager.initialize();

    // Timer Manager
    this.timerManager = new TimerManager();

    // Quiz Renderer
    this.quizRenderer = new QuizRenderer(
      this.containers.quiz,
      this.questionService
    );

    // AI Assessment
    this.aiAssessment = new AIAssessment(this.apiService);

    // Results Manager
    this.resultsManager = new ResultsManager(
      this.containers.results,
      this.storageService
    );

    // Set up component event listeners
    this.setupComponentEventListeners();
  }

  /**
   * Set up global event listeners
   */
  setupGlobalEventListeners() {
    // Header button events
    const configBtn = DOMHelpers.getElementById('configBtn');
    const pauseBtn = DOMHelpers.getElementById('pauseBtn');
    const resumeBtn = DOMHelpers.getElementById('resumeBtn');

    if (configBtn) {
      this.eventManager.on(configBtn, 'click', () => this.showConfiguration());
    }

    if (pauseBtn) {
      this.eventManager.on(pauseBtn, 'click', () => this.pauseQuiz());
    }

    if (resumeBtn) {
      this.eventManager.on(resumeBtn, 'click', () => this.resumeQuiz());
    }

    // Keyboard shortcuts
    this.eventManager.addGlobalListener(document, 'keydown', (e) => this.handleKeyboardShortcuts(e));

    // Window events
    this.eventManager.addGlobalListener(window, 'beforeunload', (e) => this.handleBeforeUnload(e));
    this.eventManager.addGlobalListener(window, 'visibilitychange', () => this.handleVisibilityChange());
  }

  /**
   * Set up component event listeners
   */
  setupComponentEventListeners() {
    // Configuration Panel Events
    this.eventManager.on(this.containers.configuration, 'startQuiz', (e) => {
      this.startQuiz(e.detail.config, e.detail.csvData);
    });

    this.eventManager.on(this.containers.configuration, 'configSaved', (e) => {
      this.quizConfig = e.detail.config;
    });

    // Timer Events
    this.timerManager.addEventListener('timeExpired', (e) => {
      this.handleTimeExpired(e.detail);
    });

    this.timerManager.addEventListener('timerWarning', (e) => {
      this.showTimerWarning(e.detail);
    });

    this.timerManager.addEventListener('examEnded', () => {
      this.endQuiz('timeout');
    });

    // Quiz Renderer Events
    if (this.quizRenderer) {
      this.eventManager.on(this.containers.quiz, 'answerSelected', (e) => {
        this.handleAnswerSelected(e.detail);
      });

      this.eventManager.on(this.containers.quiz, 'quizCompleted', () => {
        this.endQuiz('completed');
      });

      this.eventManager.on(this.containers.quiz, 'questionChanged', (e) => {
        this.handleQuestionChanged(e.detail);
      });
    }

    // Results Events
    this.eventManager.on(this.containers.results, 'restartQuiz', () => {
      this.restartQuiz();
    });

    this.eventManager.on(this.containers.results, 'newQuiz', () => {
      this.showConfiguration();
    });
  }

  /**
   * Start a new quiz
   */
  async startQuiz(config, csvData) {
    try {
      this.showLoading('Preparing quiz...');
      
      // Save configuration
      this.quizConfig = config;
      
      // Load questions into service
      await this.questionService.loadQuestionsFromCSV(csvData);
      
      // Get filtered questions for quiz
      const quizQuestions = this.questionService.getQuizQuestions(config);
      
      if (quizQuestions.length === 0) {
        throw new Error('No questions match the selected criteria');
      }
      
      // Set questions in service
      this.questionService.setQuestions(quizQuestions);
      
      // Initialize timer
      this.timerManager.init({
        timerMode: config.timerMode,
        examTime: config.examTime * 60, // Convert to seconds
        sectionTime: config.sectionTime * 60,
        questionTime: config.questionTime * 60
      });
      
      // Initialize quiz renderer
      this.quizRenderer.init(config);
      
      // Update UI state
      this.setState('quiz');
      this.isQuizActive = true;
      
      // Start timer if configured
      if (config.timerMode !== 'none') {
        this.timerManager.start();
      }
      
      // Render first question
      this.quizRenderer.renderCurrentQuestion();
      
      // Save progress
      this.saveQuizProgress();
      
      this.hideLoading();
      this.showSuccess('Quiz started successfully!');
      
    } catch (error) {
      console.error('Failed to start quiz:', error);
      this.hideLoading();
      this.showError(`Failed to start quiz: ${error.message}`);
    }
  }

  /**
   * Pause the current quiz
   */
  pauseQuiz() {
    if (!this.isQuizActive) return;
    
    this.timerManager.pause();
    this.quizRenderer?.pause();
    
    // Update UI
    const pauseBtn = DOMHelpers.getElementById('pauseBtn');
    const resumeBtn = DOMHelpers.getElementById('resumeBtn');
    
    DOMHelpers.toggleVisibility(pauseBtn, false);
    DOMHelpers.toggleVisibility(resumeBtn, true);
    
    this.showInfo('Quiz paused');
  }

  /**
   * Resume the paused quiz
   */
  resumeQuiz() {
    if (!this.isQuizActive) return;
    
    this.timerManager.resume();
    this.quizRenderer?.resume();
    
    // Update UI
    const pauseBtn = DOMHelpers.getElementById('pauseBtn');
    const resumeBtn = DOMHelpers.getElementById('resumeBtn');
    
    DOMHelpers.toggleVisibility(pauseBtn, true);
    DOMHelpers.toggleVisibility(resumeBtn, false);
    
    this.showInfo('Quiz resumed');
  }

  /**
   * End the current quiz
   */
  async endQuiz(reason = 'completed') {
    try {
      this.showLoading('Processing results...');
      
      // Stop timer
      this.timerManager.stop();
      this.isQuizActive = false;
      
      // Calculate results
      const results = this.questionService.calculateResults();
      results.completionReason = reason;
      results.quizConfig = this.quizConfig;
      results.completedAt = new Date().toISOString();
      
      // Save results
      this.storageService.saveQuizResults(results);
      
      // Get AI assessment if enabled and available
      if (this.apiKeyManager?.isAvailable()) {
        await this.getAIAssessment(results);
      }
      
      // Show results
      this.showResults(results);
      
      // Clear quiz progress
      this.storageService.removeSession('progress');
      
      this.hideLoading();
      
    } catch (error) {
      console.error('Failed to end quiz:', error);
      this.hideLoading();
      this.showError(`Failed to process results: ${error.message}`);
    }
  }

  /**
   * Get AI assessment for quiz results
   */
  async getAIAssessment(results) {
    try {
      // Check if AI is available through APIKeyManager
      if (!this.apiKeyManager?.isAvailable()) {
        results.aiAssessmentError = 'AI assessment not configured';
        return;
      }

      const quizData = this.questionService.exportForAIAssessment();
      const assessment = await this.aiAssessment.getAssessment(quizData);
      
      if (assessment.success) {
        results.aiAssessment = assessment;
      } else {
        results.aiAssessmentError = assessment.error;
      }
    } catch (error) {
      console.error('AI assessment failed:', error);
      results.aiAssessmentError = 'AI assessment unavailable';
    }
  }

  /**
   * Show quiz results
   */
  showResults(results) {
    this.setState('results');
    this.resultsManager.init(results);
    this.resultsManager.render();
  }

  /**
   * Restart the current quiz
   */
  restartQuiz() {
    if (confirm('Are you sure you want to restart the quiz? All progress will be lost.')) {
      this.questionService.reset();
      this.timerManager.reset();
      this.startQuiz(this.quizConfig, this.questionService.getAllQuestions());
    }
  }

  /**
   * Show configuration panel
   */
  showConfiguration() {
    this.setState('configuration');
    this.configPanel.show();
  }

  /**
   * Handle answer selection
   */
  handleAnswerSelected(detail) {
    this.questionService.saveAnswer(detail.answerIndex);
    this.saveQuizProgress();
  }

  /**
   * Handle question change
   */
  handleQuestionChanged(detail) {
    // Reset question timer if applicable
    if (this.quizConfig.timerMode === 'question') {
      this.timerManager.resetQuestionTimer();
    }
    
    this.saveQuizProgress();
  }

  /**
   * Handle time expiration
   */
  handleTimeExpired(detail) {
    this.showWarning(detail.message);
    
    if (detail.type === 'exam') {
      this.endQuiz('timeout');
    } else if (detail.type === 'question') {
      this.quizRenderer?.nextQuestion();
    }
  }

  /**
   * Show timer warning
   */
  showTimerWarning(detail) {
    const timeLeft = DOMHelpers.formatTime(detail.timeRemaining);
    this.showWarning(`${detail.type} time running low: ${timeLeft} remaining`);
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(event) {
    if (!this.isQuizActive) return;
    
    switch (event.key) {
      case '1':
      case '2':
      case '3':
      case '4':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const answerIndex = parseInt(event.key) - 1;
          this.quizRenderer?.selectAnswer(answerIndex);
        }
        break;
      
      case 'ArrowLeft':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.quizRenderer?.previousQuestion();
        }
        break;
      
      case 'ArrowRight':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.quizRenderer?.nextQuestion();
        }
        break;
      
      case ' ':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.timerManager.isPaused ? this.resumeQuiz() : this.pauseQuiz();
        }
        break;
    }
  }

  /**
   * Handle before unload
   */
  handleBeforeUnload(event) {
    if (this.isQuizActive) {
      event.preventDefault();
      event.returnValue = 'You have an active quiz. Are you sure you want to leave?';
      return event.returnValue;
    }
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    if (document.hidden && this.isQuizActive && this.quizConfig.timerMode !== 'none') {
      // Auto-pause when tab becomes hidden (prevents cheating)
      this.pauseQuiz();
      this.showWarning('Quiz paused due to tab switch');
    }
  }

  /**
   * Save quiz progress
   */
  saveQuizProgress() {
    const progress = {
      currentQuestionIndex: this.questionService.currentQuestionIndex,
      userAnswers: this.questionService.getAllUserAnswers(),
      timerState: this.timerManager.getStatus(),
      config: this.quizConfig
    };
    
    this.storageService.saveQuizProgress(progress);
  }

  /**
   * Set application state
   */
  setState(newState) {
    this.currentState = newState;
    
    // Hide all containers
    DOMHelpers.toggleVisibility(this.containers.configuration, false);
    DOMHelpers.toggleVisibility(this.containers.quiz, false);
    DOMHelpers.toggleVisibility(this.containers.results, false);
    DOMHelpers.toggleVisibility(this.containers.nav, false);
    
    // Show relevant container
    switch (newState) {
      case 'configuration':
        DOMHelpers.toggleVisibility(this.containers.configuration, true);
        break;
      case 'quiz':
        DOMHelpers.toggleVisibility(this.containers.quiz, true);
        DOMHelpers.toggleVisibility(this.containers.nav, true);
        DOMHelpers.toggleVisibility(DOMHelpers.getElementById('pauseBtn'), true);
        break;
      case 'results':
        DOMHelpers.toggleVisibility(this.containers.results, true);
        DOMHelpers.toggleVisibility(DOMHelpers.getElementById('pauseBtn'), false);
        DOMHelpers.toggleVisibility(DOMHelpers.getElementById('resumeBtn'), false);
        break;
    }
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'Loading...') {
    const overlay = DOMHelpers.getElementById('loadingOverlay');
    const text = overlay?.querySelector('.loading-text');
    
    if (text) text.textContent = message;
    DOMHelpers.toggleVisibility(overlay, true);
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = DOMHelpers.getElementById('loadingOverlay');
    DOMHelpers.toggleVisibility(overlay, false);
  }

  /**
   * Show status message
   */
  showMessage(message, type = 'info') {
    const container = DOMHelpers.getElementById('statusMessages');
    if (!container) return;
    
    const messageElement = DOMHelpers.createElement('div', {
      className: `status-message ${type}`,
      innerHTML: `${message} <button class="close-btn">×</button>`
    });
    
    container.appendChild(messageElement);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
    
    // Add close button functionality
    const closeBtn = messageElement.querySelector('.close-btn');
    if (closeBtn) {
      this.eventManager.on(closeBtn, 'click', () => messageElement.remove());
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show warning message
   */
  showWarning(message) {
    this.showMessage(message, 'warning');
  }

  /**
   * Show info message
   */
  showInfo(message) {
    this.showMessage(message, 'info');
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.timerManager?.stop();
    this.eventManager.cleanup();
    this.configPanel?.destroy();
    this.quizRenderer?.destroy();
    this.resultsManager?.destroy();
  }
}
