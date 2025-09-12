// Quiz Renderer Component - Handles question display and user interaction
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { EventManager } from '../utils/EventManager.js';

export class QuizRenderer {
  constructor(container, questionService) {
    this.container = container;
    this.questionService = questionService;
    this.eventManager = new EventManager();
    this.config = {};
    this.isPaused = false;
    this.selectedAnswer = null;
  }

  /**
   * Initialize quiz renderer with configuration
   */
  init(config) {
    this.config = config;
    this.isPaused = false;
    this.selectedAnswer = null;
    this.render();
  }

  /**
   * Render the main quiz interface
   */
  render() {
    this.container.innerHTML = `
      <div class="quiz-renderer">
        <!-- Progress Bar -->
        <div class="quiz-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-text" id="progressText">
            Question 1 of ${this.questionService.getAllQuestions().length}
          </div>
        </div>

        <!-- Question Navigation -->
        <div class="question-navigation" id="questionNav">
          <button id="prevBtn" class="nav-btn" disabled>Previous</button>
          <div class="question-indicator" id="questionIndicator"></div>
          <button id="nextBtn" class="nav-btn">Next</button>
        </div>

        <!-- Question Content -->
        <div class="question-content" id="questionContent">
          <!-- Question will be rendered here -->
        </div>

        <!-- Answer Options -->
        <div class="answer-options" id="answerOptions">
          <!-- Answer options will be rendered here -->
        </div>

        <!-- Quiz Controls -->
        <div class="quiz-controls">
          <button id="clearAnswerBtn" class="btn btn-secondary">Clear Answer</button>
          <button id="flagQuestionBtn" class="btn btn-warning">Flag for Review</button>
          <div class="control-spacer"></div>
          <button id="submitQuizBtn" class="btn btn-success">Submit Quiz</button>
        </div>

  <!-- Pause Overlay -->
  <div class="pause-overlay hidden" id="pauseOverlay">
          <div class="pause-content">
            <h2>Quiz Paused</h2>
            <p>Click Resume to continue the quiz</p>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderCurrentQuestion();
    this.updateNavigation();
    this.renderQuestionIndicator();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Navigation buttons
    const prevBtn = DOMHelpers.getElementById('prevBtn');
    const nextBtn = DOMHelpers.getElementById('nextBtn');
    
    this.eventManager.on(prevBtn, 'click', () => this.previousQuestion());
    this.eventManager.on(nextBtn, 'click', () => this.nextQuestion());

    // Control buttons
    const clearBtn = DOMHelpers.getElementById('clearAnswerBtn');
    const flagBtn = DOMHelpers.getElementById('flagQuestionBtn');
    const submitBtn = DOMHelpers.getElementById('submitQuizBtn');
    
    this.eventManager.on(clearBtn, 'click', () => this.clearAnswer());
    this.eventManager.on(flagBtn, 'click', () => this.flagQuestion());
    this.eventManager.on(submitBtn, 'click', () => this.submitQuiz());

    // Keyboard navigation
    this.eventManager.addGlobalListener(document, 'keydown', (e) => this.handleKeyboard(e));
  }

  /**
   * Render current question
   */
  renderCurrentQuestion() {
    const question = this.questionService.getCurrentQuestion();
    if (!question) {
      this.renderNoQuestions();
      return;
    }

    const questionContent = DOMHelpers.getElementById('questionContent');
    const answerOptions = DOMHelpers.getElementById('answerOptions');

    // Render question
    questionContent.innerHTML = `
      <div class="question-header">
        <span class="question-number">Question ${this.questionService.currentQuestionIndex + 1}</span>
        <span class="question-section">${question.section || 'General'}</span>
      </div>
      <div class="question-text">
        ${DOMHelpers.sanitizeHTML(question.question)}
      </div>
      ${question.explanation ? `<div class="question-hint hidden">
        <strong>Hint:</strong> ${DOMHelpers.sanitizeHTML(question.explanation)}
      </div>` : ''}
    `;

    // Render answer options
    this.renderAnswerOptions(question);

    // Update progress
    this.updateProgress();
    this.updateNavigation();

    // Restore selected answer
    this.restoreSelectedAnswer();
  }

  /**
   * Render answer options
   */
  renderAnswerOptions(question) {
    const answerOptions = DOMHelpers.getElementById('answerOptions');
    const currentAnswer = this.questionService.getUserAnswer(this.questionService.currentQuestionIndex);

    answerOptions.innerHTML = question.options.map((option, index) => `
      <div class="answer-option ${currentAnswer === index ? 'selected' : ''}" 
           data-index="${index}">
        <label class="answer-label">
          <input type="radio" 
                 name="answer" 
                 value="${index}" 
                 ${currentAnswer === index ? 'checked' : ''}
                 class="answer-input">
          <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
          <span class="answer-text">${DOMHelpers.sanitizeHTML(option)}</span>
        </label>
      </div>
    `).join('');

    // Add event listeners to answer options
    const options = answerOptions.querySelectorAll('.answer-option');
    options.forEach((option, index) => {
      this.eventManager.on(option, 'click', () => this.selectAnswer(index));
    });

    // Add event listeners to radio inputs
    const inputs = answerOptions.querySelectorAll('.answer-input');
    inputs.forEach((input, index) => {
      this.eventManager.on(input, 'change', () => this.selectAnswer(index));
    });
  }

  /**
   * Render question indicator (overview of all questions)
   */
  renderQuestionIndicator() {
    const indicator = DOMHelpers.getElementById('questionIndicator');
    const questions = this.questionService.getAllQuestions();
    const userAnswers = this.questionService.getAllUserAnswers();

    indicator.innerHTML = questions.map((question, index) => {
      const isAnswered = userAnswers[index] !== null;
      const isCurrent = index === this.questionService.currentQuestionIndex;
      const status = isAnswered ? 'answered' : 'unanswered';
      
      return `
        <span class="question-dot ${status} ${isCurrent ? 'current' : ''}" 
              data-index="${index}" 
              title="Question ${index + 1}${isAnswered ? ' (Answered)' : ''}">
          ${index + 1}
        </span>
      `;
    }).join('');

    // Add click events to question dots
    const dots = indicator.querySelectorAll('.question-dot');
    dots.forEach((dot, index) => {
      this.eventManager.on(dot, 'click', () => this.goToQuestion(index));
    });
  }

  /**
   * Select an answer
   */
  selectAnswer(answerIndex) {
    if (this.isPaused) return;

    // Remove previous selection
    const options = this.container.querySelectorAll('.answer-option');
    options.forEach(option => option.classList.remove('selected'));

    // Add selection to clicked option
    const selectedOption = this.container.querySelector(`[data-index="${answerIndex}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
      const input = selectedOption.querySelector('.answer-input');
      if (input) input.checked = true;
    }

    // Save answer
    this.questionService.saveAnswer(answerIndex);
    this.selectedAnswer = answerIndex;

    // Update question indicator
    this.renderQuestionIndicator();

    // Dispatch event
    this.container.dispatchEvent(new CustomEvent('answerSelected', {
      detail: { 
        questionIndex: this.questionService.currentQuestionIndex,
        answerIndex 
      }
    }));

    // Auto-advance if configured
    if (this.config.autoAdvance && this.questionService.hasNextQuestion()) {
      setTimeout(() => this.nextQuestion(), 1000);
    }
  }

  /**
   * Clear current answer
   */
  clearAnswer() {
    if (this.isPaused) return;

    // Clear selection in UI
    const options = this.container.querySelectorAll('.answer-option');
    options.forEach(option => {
      option.classList.remove('selected');
      const input = option.querySelector('.answer-input');
      if (input) input.checked = false;
    });

    // Clear answer in service
    this.questionService.saveAnswer(null);
    this.selectedAnswer = null;

    // Update question indicator
    this.renderQuestionIndicator();
  }

  /**
   * Flag question for review
   */
  flagQuestion() {
    // This would be implemented with a more complex state management
    const flagBtn = DOMHelpers.getElementById('flagQuestionBtn');
    flagBtn.classList.toggle('flagged');
    
    const isFlagged = flagBtn.classList.contains('flagged');
    flagBtn.textContent = isFlagged ? 'Unflag Question' : 'Flag for Review';
  }

  /**
   * Navigate to next question
   */
  nextQuestion() {
    if (this.isPaused) return;

    if (this.questionService.hasNextQuestion()) {
      this.questionService.nextQuestion();
      this.renderCurrentQuestion();
      
      this.container.dispatchEvent(new CustomEvent('questionChanged', {
        detail: { 
          questionIndex: this.questionService.currentQuestionIndex,
          direction: 'next'
        }
      }));
    } else {
      // Last question - show completion options
      this.showCompletionPrompt();
    }
  }

  /**
   * Navigate to previous question
   */
  previousQuestion() {
    if (this.isPaused) return;

    if (this.questionService.hasPreviousQuestion()) {
      this.questionService.previousQuestion();
      this.renderCurrentQuestion();
      
      this.container.dispatchEvent(new CustomEvent('questionChanged', {
        detail: { 
          questionIndex: this.questionService.currentQuestionIndex,
          direction: 'previous'
        }
      }));
    }
  }

  /**
   * Go to specific question
   */
  goToQuestion(questionIndex) {
    if (this.isPaused) return;

    const question = this.questionService.goToQuestion(questionIndex);
    if (question) {
      this.renderCurrentQuestion();
      
      this.container.dispatchEvent(new CustomEvent('questionChanged', {
        detail: { 
          questionIndex: this.questionService.currentQuestionIndex,
          direction: 'direct'
        }
      }));
    }
  }

  /**
   * Show completion prompt
   */
  showCompletionPrompt() {
    const progress = this.questionService.getProgress();
    const unanswered = progress.total - progress.answered;
    
    let message = 'You have reached the end of the quiz.';
    if (unanswered > 0) {
      message += ` You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}.`;
    }
    message += ' Do you want to submit your quiz?';

    if (confirm(message)) {
      this.submitQuiz();
    }
  }

  /**
   * Submit quiz
   */
  submitQuiz() {
    const progress = this.questionService.getProgress();
    const unanswered = progress.total - progress.answered;
    
    let message = 'Are you sure you want to submit your quiz?';
    if (unanswered > 0) {
      message = `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Are you sure you want to submit?`;
    }

    if (confirm(message)) {
      this.container.dispatchEvent(new CustomEvent('quizCompleted', {
        detail: { reason: 'submitted' }
      }));
    }
  }

  /**
   * Update progress bar and text
   */
  updateProgress() {
    const progress = this.questionService.getProgress();
    const progressFill = DOMHelpers.getElementById('progressFill');
    const progressText = DOMHelpers.getElementById('progressText');

    if (progressFill) {
      const percentage = (progress.current / progress.total) * 100;
      progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `Question ${progress.current} of ${progress.total} (${progress.answered} answered)`;
    }
  }

  /**
   * Update navigation buttons
   */
  updateNavigation() {
    const prevBtn = DOMHelpers.getElementById('prevBtn');
    const nextBtn = DOMHelpers.getElementById('nextBtn');

    if (prevBtn) {
      prevBtn.disabled = !this.questionService.hasPreviousQuestion() || this.isPaused;
    }

    if (nextBtn) {
      const isLastQuestion = !this.questionService.hasNextQuestion();
      nextBtn.textContent = isLastQuestion ? 'Review' : 'Next';
      nextBtn.disabled = this.isPaused;
    }
  }

  /**
   * Restore selected answer for current question
   */
  restoreSelectedAnswer() {
    const currentAnswer = this.questionService.getUserAnswer(this.questionService.currentQuestionIndex);
    if (currentAnswer !== null) {
      this.selectedAnswer = currentAnswer;
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboard(event) {
    const quizContainer = this.container.closest('.quiz-container');
    const containerHidden = quizContainer ? quizContainer.classList.contains('hidden') : false;
    if (this.isPaused || containerHidden) {
      return;
    }

    switch (event.key) {
      case '1':
      case '2':
      case '3':
      case '4':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          const answerIndex = parseInt(event.key) - 1;
          const question = this.questionService.getCurrentQuestion();
          if (question && answerIndex < question.options.length) {
            this.selectAnswer(answerIndex);
          }
        }
        break;
      
      case 'ArrowLeft':
        event.preventDefault();
        this.previousQuestion();
        break;
      
      case 'ArrowRight':
      case ' ':
        event.preventDefault();
        this.nextQuestion();
        break;
      
      case 'Enter':
        if (event.ctrlKey) {
          event.preventDefault();
          this.submitQuiz();
        }
        break;
      
      case 'Delete':
      case 'Backspace':
        if (!event.target.matches('input, textarea')) {
          event.preventDefault();
          this.clearAnswer();
        }
        break;
    }
  }

  /**
   * Render no questions state
   */
  renderNoQuestions() {
    this.container.innerHTML = `
      <div class="no-questions">
        <h2>No Questions Available</h2>
        <p>No questions match your criteria or no CSV file has been uploaded.</p>
        <button id="noQuestionsReturnBtn" class="btn btn-primary">Return to Configuration</button>
      </div>
    `;

    const returnBtn = DOMHelpers.getElementById('noQuestionsReturnBtn');
    if (returnBtn) this.eventManager.on(returnBtn, 'click', () => window.location.reload());
  }

  /**
   * Pause quiz renderer
   */
  pause() {
    this.isPaused = true;
    const overlay = DOMHelpers.getElementById('pauseOverlay');
    DOMHelpers.toggleVisibility(overlay, true);
    this.updateNavigation();
  }

  /**
   * Resume quiz renderer
   */
  resume() {
    this.isPaused = false;
    const overlay = DOMHelpers.getElementById('pauseOverlay');
    DOMHelpers.toggleVisibility(overlay, false);
    this.updateNavigation();
  }

  /**
   * Get current state
   */
  getState() {
    return {
      currentQuestionIndex: this.questionService.currentQuestionIndex,
      selectedAnswer: this.selectedAnswer,
      isPaused: this.isPaused
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.eventManager.cleanup();
  }
}
