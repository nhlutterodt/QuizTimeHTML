// Question Service - Enhanced with Professional Integration
import QuestionSchema from '../models/QuestionSchema.js';
import IntegratedQuestionManager from './IntegratedQuestionManager.js';
import { ValidationHelpers } from '../utils/ValidationHelpers.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class QuestionService {
  constructor(storageService = null) {
    this.questionManager = new IntegratedQuestionManager(storageService);
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.activeQuestions = [];
    this.sectionQuestions = {};
    this.currentSection = null;
    
    // Initialize manager
    this.initializeManager();
  }

  /**
   * Initialize the integrated question manager
   */
  async initializeManager() {
    try {
      await this.questionManager.initialize();
      
      // Listen for changes
      this.questionManager.onChange((action, data) => {
        console.log(`📢 Question bank ${action}:`, data);
        // Update active questions when bank changes
        if (['imported', 'added', 'updated', 'deleted'].includes(action)) {
          this.refreshActiveQuestions();
        }
      });
      
      // Load initial questions into active set
      this.refreshActiveQuestions();
      
    } catch (error) {
      console.warn('Failed to initialize question manager:', error);
    }
  }

  /**
   * Refresh active questions from the manager
   */
  refreshActiveQuestions() {
    this.activeQuestions = this.questionManager.getAllQuestions();
    this.groupQuestionsBySection();
    console.log(`🔄 Refreshed ${this.activeQuestions.length} active questions`);
  }

  /**
   * Load questions from CSV data with enhanced integration
   */
  async loadQuestionsFromCSV(csvData, options = {}) {
    try {
      // If csvData is string, treat as CSV content
      if (typeof csvData === 'string') {
        const result = await this.questionManager.importFromCSV(csvData, {
          mergeStrategy: 'overwrite', // Replace existing for direct loads
          autoCorrect: true,
          strictValidation: false,
          ...options
        });
        
        this.activeQuestions = this.questionManager.getAllQuestions();
        console.log(`✅ Loaded ${this.activeQuestions.length} questions from CSV content`);
        
        return result;
      }

      // Legacy support: handle array of objects
      const questions = csvData.map((row, index) => {
        const options = [
          row['Option A'],
          row['Option B'], 
          row['Option C'],
          row['Option D']
        ].filter(option => option && option.trim() !== '');

        const correctLetter = row['Correct Answer']?.toUpperCase();
        const correctAnswer = ['A', 'B', 'C', 'D'].indexOf(correctLetter);

        // Convert to current schema format
        return QuestionSchema.createDefault({
          id: index + 1,
          question: row.Question,
          options: options,
          correct_answer: correctLetter,
          category: row.Section || row.Category || 'General',
          difficulty: row.Difficulty || 'Medium',
          explanation: row.Explanation || '',
          tags: row.Tags ? row.Tags.split(',').map(tag => tag.trim()) : [],
          type: 'multiple_choice',
          source: {
            format: 'legacy_csv',
            created: new Date().toISOString()
          }
        });
      });

      // Load into manager
      await this.questionManager.loadFromData(questions);
      this.activeQuestions = this.questionManager.getAllQuestions();
      
      // Group questions by section for compatibility
      this.groupQuestionsBySection();
      
      console.log(`✅ Loaded ${this.activeQuestions.length} questions from legacy CSV format`);
      return { questions: this.activeQuestions };
      
    } catch (error) {
      console.error('Error loading questions from CSV:', error);
      throw error;
    }
  }

  /**
   * Import questions from multiple CSV sources
   */
  async importMultipleCSVs(csvFiles, options = {}) {
    const results = [];
    
    for (const file of csvFiles) {
      try {
        const result = await this.questionManager.importFromCSV(file.content, {
          ...options,
          uploadId: file.uploadId,
          owner: file.owner || 'user'
        });
        
        results.push({
          filename: file.filename,
          ...result
        });
        
      } catch (error) {
        results.push({
          filename: file.filename,
          error: error.message
        });
      }
    }
    
    // Update active questions
    this.activeQuestions = this.questionManager.getAllQuestions();
    this.groupQuestionsBySection();
    
    return results;
  }

  /**
   * Group questions by section
   */
  groupQuestionsBySection() {
    this.sectionQuestions = {};
    this.questions.forEach(question => {
      const section = question.section || 'General';
      if (!this.sectionQuestions[section]) {
        this.sectionQuestions[section] = [];
      }
      this.sectionQuestions[section].push(question);
    });
  }

  /**
   * Get questions for quiz with filtering and shuffling
   */
  getQuizQuestions(config) {
    let selectedQuestions = [...this.questions];

    // Filter by section if specified
    if (config.section && config.section !== 'all') {
      selectedQuestions = this.sectionQuestions[config.section] || [];
    }

    // Filter by difficulty if specified
    if (config.difficulty && config.difficulty !== 'all') {
      selectedQuestions = selectedQuestions.filter(q => 
        q.difficulty && q.difficulty.toLowerCase() === config.difficulty.toLowerCase()
      );
    }

    // Filter by tags if specified
    if (config.tags && config.tags.length > 0) {
      selectedQuestions = selectedQuestions.filter(q =>
        q.tags && q.tags.some(tag => config.tags.includes(tag))
      );
    }

    // Shuffle if randomization is enabled
    if (config.randomize) {
      selectedQuestions = DOMHelpers.shuffle([...selectedQuestions]);
    }

    // Limit number of questions
    if (config.numQuestions && config.numQuestions > 0) {
      selectedQuestions = selectedQuestions.slice(0, config.numQuestions);
    }

    return selectedQuestions;
  }

  /**
   * Set questions for current quiz
   */
  setQuestions(questions) {
    this.questions = questions;
    this.currentQuestionIndex = 0;
    this.userAnswers = new Array(questions.length).fill(null);
  }

  /**
   * Get current question
   */
  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex];
  }

  /**
   * Get question by index
   */
  getQuestion(index) {
    return this.questions[index];
  }

  /**
   * Get all questions
   */
  getAllQuestions() {
    return this.questions;
  }

  /**
   * Move to next question
   */
  nextQuestion() {
    if (this.hasNextQuestion()) {
      this.currentQuestionIndex++;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * Move to previous question
   */
  previousQuestion() {
    if (this.hasPreviousQuestion()) {
      this.currentQuestionIndex--;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * Go to specific question
   */
  goToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * Check if there's a next question
   */
  hasNextQuestion() {
    return this.currentQuestionIndex < this.questions.length - 1;
  }

  /**
   * Check if there's a previous question
   */
  hasPreviousQuestion() {
    return this.currentQuestionIndex > 0;
  }

  /**
   * Save user answer for current question
   */
  saveAnswer(answerIndex) {
    this.userAnswers[this.currentQuestionIndex] = answerIndex;
  }

  /**
   * Get user answer for specific question
   */
  getUserAnswer(questionIndex) {
    return this.userAnswers[questionIndex];
  }

  /**
   * Get all user answers
   */
  getAllUserAnswers() {
    return this.userAnswers;
  }

  /**
   * Calculate quiz results
   */
  calculateResults() {
    let correct = 0;
    let total = this.questions.length;
    let sectionResults = {};

    this.questions.forEach((question, index) => {
      const userAnswer = this.userAnswers[index];
      const isCorrect = userAnswer === question.answer;
      
      if (isCorrect) {
        correct++;
      }

      // Track section results
      const section = question.section || 'General';
      if (!sectionResults[section]) {
        sectionResults[section] = { correct: 0, total: 0 };
      }
      sectionResults[section].total++;
      if (isCorrect) {
        sectionResults[section].correct++;
      }
    });

    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      correct,
      total,
      percentage,
      sectionResults,
      questions: this.questions.map((question, index) => ({
        question: question.question,
        userAnswer: this.userAnswers[index],
        correctAnswer: question.answer,
        isCorrect: this.userAnswers[index] === question.answer,
        explanation: question.explanation
      }))
    };
  }

  /**
   * Get quiz progress
   */
  getProgress() {
    const answered = this.userAnswers.filter(answer => answer !== null).length;
    return {
      current: this.currentQuestionIndex + 1,
      total: this.questions.length,
      answered,
      percentage: this.questions.length > 0 ? Math.round((answered / this.questions.length) * 100) : 0
    };
  }

  /**
   * Get available sections
   */
  getAvailableSections() {
    return Object.keys(this.sectionQuestions);
  }

  /**
   * Get questions by section
   */
  getQuestionsBySection(sectionName) {
    return this.sectionQuestions[sectionName] || [];
  }

  /**
   * Reset quiz state
   */
  reset() {
    this.currentQuestionIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
  }

  /**
   * Export results for AI assessment
   */
  exportForAIAssessment() {
    return {
      questions: this.questions.map((question, index) => ({
        id: question.id,
        question: question.question,
        options: question.options,
        userAnswer: this.userAnswers[index],
        correctAnswer: question.answer,
        section: question.section
      })),
      results: this.calculateResults()
    };
  }
}
