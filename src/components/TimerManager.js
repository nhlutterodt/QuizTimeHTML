// Timer Manager - Handles all timer functionality
import { EventManager } from '../utils/EventManager.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class TimerManager extends EventTarget {
  constructor() {
    super();
    this.timers = {
      exam: null,
      section: null,
      question: null
    };
    this.timeRemaining = {
      exam: 0,
      section: 0,
      question: 0
    };
    this.intervals = {
      exam: null,
      section: null,
      question: null
    };
    this.config = {
      examTime: 3600, // seconds
      sectionTime: 900, // seconds
      questionTime: 120, // seconds
      timerMode: 'none'
    };
    this.isActive = false;
    this.isPaused = false;
    this.currentSection = 0;
    this.currentQuestion = 0;
  }

  /**
   * Initialize timers with configuration
   */
  init(config) {
    this.config = { ...this.config, ...config };
    this.reset();
  }

  /**
   * Start the appropriate timer based on mode
   */
  start() {
    if (this.isPaused) {
      this.resume();
      return;
    }

    this.isActive = true;
    this.isPaused = false;

    switch (this.config.timerMode) {
      case 'exam':
        this.startExamTimer();
        break;
      case 'section':
        this.startSectionTimer();
        break;
      case 'question':
        this.startQuestionTimer();
        break;
      default:
        // No timer mode
        break;
    }

    this.dispatchEvent(new CustomEvent('timerStarted', {
      detail: { mode: this.config.timerMode }
    }));
  }

  /**
   * Pause all active timers
   */
  pause() {
    if (!this.isActive || this.isPaused) return;

    this.isPaused = true;
    this.clearAllIntervals();

    this.dispatchEvent(new CustomEvent('timerPaused', {
      detail: { timeRemaining: this.timeRemaining }
    }));
  }

  /**
   * Resume paused timers
   */
  resume() {
    if (!this.isActive || !this.isPaused) return;

    this.isPaused = false;
    this.start();

    this.dispatchEvent(new CustomEvent('timerResumed', {
      detail: { timeRemaining: this.timeRemaining }
    }));
  }

  /**
   * Stop all timers
   */
  stop() {
    this.isActive = false;
    this.isPaused = false;
    this.clearAllIntervals();

    this.dispatchEvent(new CustomEvent('timerStopped', {
      detail: { timeRemaining: this.timeRemaining }
    }));
  }

  /**
   * Reset all timers to initial values
   */
  reset() {
    this.stop();
    this.timeRemaining = {
      exam: this.config.examTime,
      section: this.config.sectionTime,
      question: this.config.questionTime
    };
    this.currentSection = 0;
    this.currentQuestion = 0;

    this.dispatchEvent(new CustomEvent('timerReset', {
      detail: { timeRemaining: this.timeRemaining }
    }));
  }

  /**
   * Start exam timer
   */
  startExamTimer() {
    if (this.timeRemaining.exam <= 0) {
      this.timeExpired('exam');
      return;
    }

    this.intervals.exam = setInterval(() => {
      this.timeRemaining.exam--;
      
      this.dispatchEvent(new CustomEvent('examTimerUpdate', {
        detail: { 
          timeRemaining: this.timeRemaining.exam,
          formattedTime: DOMHelpers.formatTime(this.timeRemaining.exam)
        }
      }));

      if (this.timeRemaining.exam <= 0) {
        this.timeExpired('exam');
      } else if (this.timeRemaining.exam <= 300) { // 5 minutes warning
        this.dispatchEvent(new CustomEvent('timerWarning', {
          detail: { 
            type: 'exam',
            timeRemaining: this.timeRemaining.exam
          }
        }));
      }
    }, 1000);
  }

  /**
   * Start section timer
   */
  startSectionTimer() {
    if (this.timeRemaining.section <= 0) {
      this.nextSection();
      return;
    }

    this.intervals.section = setInterval(() => {
      this.timeRemaining.section--;
      
      this.dispatchEvent(new CustomEvent('sectionTimerUpdate', {
        detail: { 
          timeRemaining: this.timeRemaining.section,
          formattedTime: DOMHelpers.formatTime(this.timeRemaining.section),
          section: this.currentSection
        }
      }));

      if (this.timeRemaining.section <= 0) {
        this.nextSection();
      } else if (this.timeRemaining.section <= 60) { // 1 minute warning
        this.dispatchEvent(new CustomEvent('timerWarning', {
          detail: { 
            type: 'section',
            timeRemaining: this.timeRemaining.section
          }
        }));
      }
    }, 1000);
  }

  /**
   * Start question timer
   */
  startQuestionTimer() {
    if (this.timeRemaining.question <= 0) {
      this.nextQuestion();
      return;
    }

    this.intervals.question = setInterval(() => {
      this.timeRemaining.question--;
      
      this.dispatchEvent(new CustomEvent('questionTimerUpdate', {
        detail: { 
          timeRemaining: this.timeRemaining.question,
          formattedTime: DOMHelpers.formatTime(this.timeRemaining.question),
          question: this.currentQuestion
        }
      }));

      if (this.timeRemaining.question <= 0) {
        this.nextQuestion();
      } else if (this.timeRemaining.question <= 30) { // 30 seconds warning
        this.dispatchEvent(new CustomEvent('timerWarning', {
          detail: { 
            type: 'question',
            timeRemaining: this.timeRemaining.question
          }
        }));
      }
    }, 1000);
  }

  /**
   * Handle time expiration
   */
  timeExpired(timerType) {
    this.clearInterval(timerType);

    this.dispatchEvent(new CustomEvent('timeExpired', {
      detail: { 
        type: timerType,
        message: this.getExpirationMessage(timerType)
      }
    }));

    if (timerType === 'exam') {
      this.stop();
      this.dispatchEvent(new CustomEvent('examEnded', {
        detail: { reason: 'timeout' }
      }));
    }
  }

  /**
   * Move to next section (for section timer)
   */
  nextSection() {
    this.clearInterval('section');
    this.currentSection++;
    this.timeRemaining.section = this.config.sectionTime;

    this.dispatchEvent(new CustomEvent('sectionEnded', {
      detail: { 
        section: this.currentSection - 1,
        reason: 'timeout'
      }
    }));

    // Don't auto-start next section timer - let the quiz manager handle it
  }

  /**
   * Move to next question (for question timer)
   */
  nextQuestion() {
    this.clearInterval('question');
    this.currentQuestion++;
    this.timeRemaining.question = this.config.questionTime;

    this.dispatchEvent(new CustomEvent('questionEnded', {
      detail: { 
        question: this.currentQuestion - 1,
        reason: 'timeout'
      }
    }));

    // Don't auto-start next question timer - let the quiz manager handle it
  }

  /**
   * Reset question timer (when moving to new question)
   */
  resetQuestionTimer() {
    this.clearInterval('question');
    this.timeRemaining.question = this.config.questionTime;
    
    if (this.config.timerMode === 'question' && this.isActive && !this.isPaused) {
      this.startQuestionTimer();
    }
  }

  /**
   * Reset section timer (when moving to new section)
   */
  resetSectionTimer() {
    this.clearInterval('section');
    this.timeRemaining.section = this.config.sectionTime;
    
    if (this.config.timerMode === 'section' && this.isActive && !this.isPaused) {
      this.startSectionTimer();
    }
  }

  /**
   * Clear specific interval
   */
  clearInterval(timerType) {
    if (this.intervals[timerType]) {
      clearInterval(this.intervals[timerType]);
      this.intervals[timerType] = null;
    }
  }

  /**
   * Clear all intervals
   */
  clearAllIntervals() {
    Object.keys(this.intervals).forEach(type => {
      this.clearInterval(type);
    });
  }

  /**
   * Get expiration message for timer type
   */
  getExpirationMessage(timerType) {
    switch (timerType) {
      case 'exam':
        return 'Exam time has expired!';
      case 'section':
        return 'Section time has expired! Moving to next section.';
      case 'question':
        return 'Question time has expired! Moving to next question.';
      default:
        return 'Time has expired!';
    }
  }

  /**
   * Get current timer status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      mode: this.config.timerMode,
      timeRemaining: this.timeRemaining,
      formattedTimes: {
        exam: DOMHelpers.formatTime(this.timeRemaining.exam),
        section: DOMHelpers.formatTime(this.timeRemaining.section),
        question: DOMHelpers.formatTime(this.timeRemaining.question)
      },
      currentSection: this.currentSection,
      currentQuestion: this.currentQuestion
    };
  }

  /**
   * Get time remaining for specific timer
   */
  getTimeRemaining(timerType) {
    return this.timeRemaining[timerType] || 0;
  }

  /**
   * Set time remaining for specific timer
   */
  setTimeRemaining(timerType, seconds) {
    if (this.timeRemaining.hasOwnProperty(timerType)) {
      this.timeRemaining[timerType] = Math.max(0, seconds);
    }
  }

  /**
   * Add time to specific timer
   */
  addTime(timerType, seconds) {
    if (this.timeRemaining.hasOwnProperty(timerType)) {
      this.timeRemaining[timerType] += seconds;
    }
  }

  /**
   * Check if timer is running low
   */
  isTimeRunningLow(timerType, threshold = 300) {
    return this.timeRemaining[timerType] <= threshold;
  }

  /**
   * Get time elapsed for timer
   */
  getTimeElapsed(timerType) {
    const totalTime = this.config[`${timerType}Time`];
    return totalTime - this.timeRemaining[timerType];
  }

  /**
   * Get timer progress percentage
   */
  getProgress(timerType) {
    const totalTime = this.config[`${timerType}Time`];
    const elapsed = this.getTimeElapsed(timerType);
    return totalTime > 0 ? Math.round((elapsed / totalTime) * 100) : 0;
  }
}
