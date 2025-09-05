// Question Service - Manages question data and operations
import { ValidationHelpers } from '../utils/ValidationHelpers.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { CSVQuestionManager } from '../data/csv-manager.js';

export class QuestionService {
  constructor() {
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.sectionQuestions = {};
    this.currentSection = null;
    this.csvManager = new CSVQuestionManager();
  }

  /**
   * Load questions from CSV data
   */
  async loadQuestionsFromCSV(csvData) {
    try {
      // Validate CSV data
      const validation = ValidationHelpers.validateCSVData(csvData);
      if (!validation.isValid) {
        throw new Error(`CSV validation failed: ${validation.errors.join(', ')}`);
      }

      // Use CSV manager to parse and convert data
      this.questions = csvData.map((row, index) => {
        const options = [
          row['Option A'],
          row['Option B'], 
          row['Option C'],
          row['Option D']
        ].filter(option => option && option.trim() !== '');

        const correctLetter = row['Correct Answer'].toUpperCase();
        const correctAnswer = ['A', 'B', 'C', 'D'].indexOf(correctLetter);

        return {
          id: index + 1,
          question: row.Question,
          options: options,
          answer: correctAnswer,
          section: row.Section || 'General',
          difficulty: row.Difficulty || 'Medium',
          explanation: row.Explanation || '',
          tags: row.Tags ? row.Tags.split(',').map(tag => tag.trim()) : []
        };
      });

      // Group questions by section
      this.groupQuestionsBySection();
      
      console.log(`Loaded ${this.questions.length} questions from CSV`);
      return this.questions;
    } catch (error) {
      console.error('Error loading questions from CSV:', error);
      throw error;
    }
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
