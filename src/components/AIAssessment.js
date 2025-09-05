// AI Assessment Component
import { APIService } from '../services/APIService.js';

export class AIAssessment {
  constructor(apiService = null) {
    this.apiService = apiService || new APIService();
    this.isAvailable = false;
    this.lastAssessment = null;
  }

  /**
   * Check if AI assessment is available
   */
  async checkAvailability() {
    try {
      const result = await this.apiService.checkAIAvailability();
      this.isAvailable = result.available;
      return result;
    } catch (error) {
      console.error('Failed to check AI availability:', error);
      this.isAvailable = false;
      return {
        available: false,
        message: 'Unable to verify AI availability'
      };
    }
  }

  /**
   * Get AI assessment for quiz results
   */
  async getAssessment(quizData) {
    try {
      if (!this.isAvailable) {
        const availability = await this.checkAvailability();
        if (!availability.available) {
          return {
            success: false,
            error: availability.message || 'AI assessment not available',
            type: 'unavailable',
            retryable: false
          };
        }
      }

      // Prepare assessment data
      const assessmentData = this.prepareAssessmentData(quizData);
      
      // Submit for assessment
      const result = await this.apiService.submitForAIAssessment(assessmentData);
      
      if (result.success) {
        this.lastAssessment = result;
        return {
          success: true,
          assessment: result.assessment,
          recommendations: result.recommendations || [],
          strengths: result.strengths || [],
          improvements: result.improvements || [],
          summary: this.generateAssessmentSummary(result)
        };
      } else {
        return {
          success: false,
          error: result.error,
          type: result.type,
          retryable: result.retryable
        };
      }
    } catch (error) {
      console.error('AI assessment failed:', error);
      return {
        success: false,
        error: 'Failed to get AI assessment',
        type: 'error',
        retryable: true
      };
    }
  }

  /**
   * Prepare data for AI assessment
   */
  prepareAssessmentData(quizData) {
    const { questions, results } = quizData;
    
    return {
      quiz: {
        totalQuestions: questions.length,
        correctAnswers: results.correct,
        incorrectAnswers: results.total - results.correct,
        percentage: results.percentage,
        sectionResults: results.sectionResults
      },
      questions: questions.map((q, index) => ({
        id: q.id || index + 1,
        question: q.question,
        section: q.section || 'General',
        userAnswer: q.userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: q.userAnswer === q.correctAnswer,
        options: q.options
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        quizType: 'multiple-choice',
        version: '1.0'
      }
    };
  }

  /**
   * Generate assessment summary
   */
  generateAssessmentSummary(assessmentResult) {
    const { assessment, recommendations, strengths, improvements } = assessmentResult;
    
    return {
      overallPerformance: this.categorizePerformance(assessmentResult),
      keyInsights: this.extractKeyInsights(assessment),
      actionItems: recommendations.slice(0, 3), // Top 3 recommendations
      strongAreas: strengths.slice(0, 3), // Top 3 strengths
      improvementAreas: improvements.slice(0, 3) // Top 3 improvement areas
    };
  }

  /**
   * Categorize overall performance
   */
  categorizePerformance(assessmentResult) {
    // This would be enhanced based on the actual AI response structure
    const score = assessmentResult.quiz?.percentage || 0;
    
    if (score >= 90) {
      return {
        category: 'Excellent',
        description: 'Outstanding performance with strong mastery of the subject matter',
        color: 'success'
      };
    } else if (score >= 80) {
      return {
        category: 'Good',
        description: 'Solid understanding with room for minor improvements',
        color: 'primary'
      };
    } else if (score >= 70) {
      return {
        category: 'Satisfactory',
        description: 'Basic understanding achieved, focus on key improvement areas',
        color: 'warning'
      };
    } else if (score >= 60) {
      return {
        category: 'Needs Improvement',
        description: 'Additional study and practice recommended',
        color: 'danger'
      };
    } else {
      return {
        category: 'Requires Attention',
        description: 'Significant gaps identified, comprehensive review needed',
        color: 'danger'
      };
    }
  }

  /**
   * Extract key insights from assessment
   */
  extractKeyInsights(assessment) {
    // This would be enhanced to parse actual AI insights
    const insights = [];
    
    if (typeof assessment === 'string') {
      // Simple text parsing for key phrases
      const sentences = assessment.split('.').filter(s => s.trim().length > 10);
      insights.push(...sentences.slice(0, 3).map(s => s.trim()));
    } else if (assessment && typeof assessment === 'object') {
      // Structured assessment object
      if (assessment.insights) {
        insights.push(...assessment.insights);
      }
      if (assessment.observations) {
        insights.push(...assessment.observations);
      }
    }
    
    return insights.length > 0 ? insights : ['Assessment completed successfully'];
  }

  /**
   * Format assessment for display
   */
  formatAssessmentForDisplay(assessmentResult) {
    if (!assessmentResult.success) {
      return {
        type: 'error',
        title: 'AI Assessment Unavailable',
        content: assessmentResult.error,
        retryable: assessmentResult.retryable
      };
    }

    const { assessment, summary } = assessmentResult;
    
    return {
      type: 'success',
      title: 'AI-Powered Assessment',
      performance: summary.overallPerformance,
      sections: [
        {
          title: 'Overall Assessment',
          content: typeof assessment === 'string' ? assessment : 'Assessment completed',
          type: 'text'
        },
        {
          title: 'Key Insights',
          content: summary.keyInsights,
          type: 'list'
        },
        {
          title: 'Your Strengths',
          content: summary.strongAreas,
          type: 'list',
          variant: 'success'
        },
        {
          title: 'Areas for Improvement',
          content: summary.improvementAreas,
          type: 'list',
          variant: 'warning'
        },
        {
          title: 'Recommended Actions',
          content: summary.actionItems,
          type: 'list',
          variant: 'info'
        }
      ]
    };
  }

  /**
   * Generate study plan based on assessment
   */
  generateStudyPlan(assessmentResult) {
    if (!assessmentResult.success) {
      return null;
    }

    const { improvements, recommendations } = assessmentResult;
    
    return {
      title: 'Personalized Study Plan',
      timeline: '2-4 weeks',
      phases: [
        {
          name: 'Foundation Review',
          duration: '1 week',
          focus: improvements.slice(0, 2),
          activities: [
            'Review core concepts',
            'Practice basic problems',
            'Create summary notes'
          ]
        },
        {
          name: 'Skill Building',
          duration: '1-2 weeks',
          focus: recommendations.slice(0, 3),
          activities: [
            'Targeted practice exercises',
            'Work through examples',
            'Seek additional resources'
          ]
        },
        {
          name: 'Assessment & Refinement',
          duration: '3-5 days',
          focus: ['Practice testing', 'Knowledge consolidation'],
          activities: [
            'Take practice quizzes',
            'Review weak areas',
            'Final preparation'
          ]
        }
      ]
    };
  }

  /**
   * Get assessment history
   */
  getAssessmentHistory() {
    // This would integrate with storage service to retrieve past assessments
    return [this.lastAssessment].filter(Boolean);
  }

  /**
   * Compare with previous assessments
   */
  compareWithPrevious(currentAssessment, previousAssessments = []) {
    if (!currentAssessment.success || previousAssessments.length === 0) {
      return null;
    }

    const current = currentAssessment.quiz?.percentage || 0;
    const previous = previousAssessments[0]?.quiz?.percentage || 0;
    const improvement = current - previous;

    return {
      hasImproved: improvement > 0,
      improvement: Math.abs(improvement),
      trend: improvement > 5 ? 'significant_improvement' : 
             improvement > 0 ? 'slight_improvement' :
             improvement < -5 ? 'significant_decline' :
             improvement < 0 ? 'slight_decline' : 'stable',
      message: this.generateComparisonMessage(improvement)
    };
  }

  /**
   * Generate comparison message
   */
  generateComparisonMessage(improvement) {
    if (improvement > 10) {
      return 'Excellent progress! You\'ve shown significant improvement.';
    } else if (improvement > 5) {
      return 'Good improvement! Keep up the great work.';
    } else if (improvement > 0) {
      return 'You\'re making progress. Continue your current study approach.';
    } else if (improvement === 0) {
      return 'Performance remained consistent. Consider new study strategies.';
    } else if (improvement > -5) {
      return 'Slight dip in performance. Review recent study materials.';
    } else {
      return 'Consider revisiting fundamental concepts and adjusting study methods.';
    }
  }

  /**
   * Get last assessment
   */
  getLastAssessment() {
    return this.lastAssessment;
  }

  /**
   * Clear assessment cache
   */
  clearCache() {
    this.lastAssessment = null;
  }
}
