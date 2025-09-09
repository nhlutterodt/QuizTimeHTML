// Question Supplement Manager - AI-powered question generation service
// Handles intelligent question supplementation when CSV questions are insufficient

export class QuestionSupplementManager {
  constructor(apiService = null) {
    this.apiService = apiService;
    this.isGenerating = false;
    this.currentRequest = null;
    
    // Configuration with defaults from the plan
    this.config = {
      maxSupplementPerRequest: 50,
      minSampleSizeForAnalysis: 3,
      maxRetries: 3,
      timeoutSeconds: 30,
      maxConcurrentRequests: 1
    };
  }

  /**
   * Analyze existing CSV questions to create a schema pattern
   * @param {Array} questions - Array of question objects from CSV
   * @returns {Object} Schema analysis for AI prompt generation
   */
  analyzeQuestionSchema(questions) {
    if (!questions || questions.length === 0) {
      throw new Error('No questions provided for schema analysis');
    }

    if (questions.length < this.config.minSampleSizeForAnalysis) {
      throw new Error(`Minimum ${this.config.minSampleSizeForAnalysis} questions required for analysis`);
    }

    const analysis = {
      totalQuestions: questions.length,
      categories: new Set(),
      difficulties: new Set(),
      sections: new Set(),
      questionTypes: new Set(),
      averageQuestionLength: 0,
      averageOptionLength: 0,
      commonPatterns: [],
      csvHeaders: ['Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer', 'Difficulty', 'Section']
    };

    let totalQuestionLength = 0;
    let totalOptionLength = 0;
    let optionCount = 0;

    questions.forEach(q => {
      // Collect metadata
      if (q.Category) analysis.categories.add(q.Category);
      if (q.Difficulty) analysis.difficulties.add(q.Difficulty);
      if (q.Section) analysis.sections.add(q.Section);
      
      // Analyze question structure
      if (q.Question) {
        totalQuestionLength += q.Question.length;
        
        // Detect question type patterns
        if (q.Question.includes('?')) analysis.questionTypes.add('interrogative');
        if (q.Question.toLowerCase().includes('which')) analysis.questionTypes.add('multiple-choice');
        if (q.Question.toLowerCase().includes('what')) analysis.questionTypes.add('factual');
      }

      // Analyze options
      ['OptionA', 'OptionB', 'OptionC', 'OptionD'].forEach(opt => {
        if (q[opt]) {
          totalOptionLength += q[opt].length;
          optionCount++;
        }
      });
    });

    analysis.averageQuestionLength = Math.round(totalQuestionLength / questions.length);
    analysis.averageOptionLength = Math.round(totalOptionLength / optionCount);
    
    // Convert Sets to Arrays for JSON serialization
    analysis.categories = Array.from(analysis.categories);
    analysis.difficulties = Array.from(analysis.difficulties);
    analysis.sections = Array.from(analysis.sections);
    analysis.questionTypes = Array.from(analysis.questionTypes);

    return analysis;
  }

  /**
   * Generate AI prompt based on schema analysis
   * @param {Object} schema - Schema analysis from analyzeQuestionSchema
   * @param {number} missingCount - Number of questions to generate
   * @returns {string} Formatted prompt for AI generation
   */
  generateSupplementPrompt(schema, missingCount) {
    if (missingCount > this.config.maxSupplementPerRequest) {
      throw new Error(`Cannot generate more than ${this.config.maxSupplementPerRequest} questions per request`);
    }

    const prompt = `Based on this question pattern analysis:

ANALYSIS SUMMARY:
- Total sample questions: ${schema.totalQuestions}
- Categories: ${schema.categories.join(', ') || 'General'}
- Difficulty levels: ${schema.difficulties.join(', ') || 'Medium'}
- Sections: ${schema.sections.join(', ') || 'General'}
- Question types: ${schema.questionTypes.join(', ') || 'multiple-choice'}
- Average question length: ${schema.averageQuestionLength} characters
- Average option length: ${schema.averageOptionLength} characters

REQUIREMENTS:
Generate exactly ${missingCount} additional questions that match this pattern and style.

OUTPUT FORMAT:
Return ONLY valid CSV data with these exact headers (no additional text):
${schema.csvHeaders.join(',')}

QUALITY STANDARDS:
1. Questions must be factually accurate and educational
2. Each question must have exactly 4 options (A, B, C, D)
3. CorrectAnswer must be exactly one of: A, B, C, D
4. Difficulty should match the pattern: ${schema.difficulties.join(', ') || 'Medium'}
5. Section should match the pattern: ${schema.sections.join(', ') || 'General'}
6. Questions should be similar in complexity and style to the sample

Generate ${missingCount} questions now:`;

    return prompt;
  }

  /**
   * Request question supplementation from AI service
   * @param {Array} existingQuestions - Current questions from CSV
   * @param {number} missingCount - Number of questions needed
   * @param {Object} options - Additional options for generation
   * @returns {Promise<Object>} Generation result with questions and metadata
   */
  async supplementQuestions(existingQuestions, missingCount, options = {}) {
    if (this.isGenerating && this.config.maxConcurrentRequests <= 1) {
      throw new Error('Question generation already in progress');
    }

    if (!this.apiService) {
      throw new Error('API service not configured');
    }

    try {
      this.isGenerating = true;
      
      // Analyze existing questions
      const schema = this.analyzeQuestionSchema(existingQuestions);
      
      // Generate AI prompt
      const prompt = this.generateSupplementPrompt(schema, missingCount);
      
      // Prepare request options
      const requestOptions = {
        prompt,
        missingCount,
        schema,
        provider: options.provider || 'openai',
        persist: options.persist !== false, // Default to true
        maxRetries: options.maxRetries || this.config.maxRetries,
        timeout: (options.timeout || this.config.timeoutSeconds) * 1000
      };

      // Make API request
      this.currentRequest = this.apiService.supplementQuestions(requestOptions);
      const result = await this.currentRequest;

      return {
        success: true,
        questions: result.questions || [],
        metadata: {
          requested: missingCount,
          generated: result.questions?.length || 0,
          valid: result.metadata?.valid || 0,
          duplicates: result.metadata?.duplicates || 0,
          schema: schema
        }
      };

    } catch (error) {
      console.error('Question supplementation failed:', error);
      return {
        success: false,
        error: error.message,
        metadata: {
          requested: missingCount,
          generated: 0,
          valid: 0
        }
      };
    } finally {
      this.isGenerating = false;
      this.currentRequest = null;
    }
  }

  /**
   * Validate AI-generated questions
   * @param {Array} questions - Questions to validate
   * @param {Object} schema - Original schema for comparison
   * @returns {Object} Validation result with valid questions and errors
   */
  validateGeneratedQuestions(questions, schema) {
    const validation = {
      valid: [],
      invalid: [],
      errors: [],
      duplicates: 0
    };

    if (!Array.isArray(questions)) {
      validation.errors.push('Generated content is not a valid question array');
      return validation;
    }

    const requiredFields = ['Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer'];
    const validAnswers = ['A', 'B', 'C', 'D'];

    questions.forEach((question, index) => {
      const errors = [];

      // Check required fields
      requiredFields.forEach(field => {
        if (!question[field] || question[field].trim() === '') {
          errors.push(`Missing or empty ${field}`);
        }
      });

      // Validate correct answer
      if (question.CorrectAnswer && !validAnswers.includes(question.CorrectAnswer.toUpperCase())) {
        errors.push('CorrectAnswer must be A, B, C, or D');
      }

      // Check for reasonable length
      if (question.Question && question.Question.length < 10) {
        errors.push('Question too short');
      }

      if (errors.length === 0) {
        // Add unique ID if not present
        if (!question.id) {
          question.id = `supp_${Date.now()}_${index}`;
        }
        validation.valid.push(question);
      } else {
        validation.invalid.push({
          question,
          errors,
          index
        });
      }
    });

    return validation;
  }

  /**
   * Get current supplementation status
   * @returns {Object} Current status and configuration
   */
  getStatus() {
    return {
      isGenerating: this.isGenerating,
      hasActiveRequest: !!this.currentRequest,
      config: { ...this.config }
    };
  }

  /**
   * Cancel current generation request
   */
  cancelGeneration() {
    if (this.currentRequest) {
      // Note: Actual cancellation depends on API service implementation
      this.currentRequest = null;
    }
    this.isGenerating = false;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default QuestionSupplementManager;