// Results Manager Component - Handles quiz results display and analysis
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { EventManager } from '../utils/EventManager.js';

export class ResultsManager {
  constructor(container, storageService) {
    this.container = container;
    this.storageService = storageService;
    this.eventManager = new EventManager();
    this.results = null;
    this.config = {};
  }

  /**
   * Initialize results manager with quiz results
   */
  init(results) {
    this.results = results;
    this.config = results.quizConfig || {};
  }

  /**
   * Render the results interface
   */
  render() {
    if (!this.results) {
      this.renderNoResults();
      return;
    }

    this.container.innerHTML = `
      <div class="results-container">
        <!-- Results Header -->
        <div class="results-header">
          <h1>Quiz Results</h1>
          <div class="completion-info">
            <span class="completion-time">${this.formatCompletionTime()}</span>
            <span class="completion-reason">${this.formatCompletionReason()}</span>
          </div>
        </div>

        <!-- Score Summary -->
        <div class="score-summary">
          <div class="score-main">
            <div class="score-circle ${this.getScoreClass()}">
              <span class="score-percentage">${this.results.percentage}%</span>
              <span class="score-label">Score</span>
            </div>
            <div class="score-details">
              <div class="score-item">
                <span class="score-value">${this.results.correct}</span>
                <span class="score-label">Correct</span>
              </div>
              <div class="score-item">
                <span class="score-value">${this.results.total - this.results.correct}</span>
                <span class="score-label">Incorrect</span>
              </div>
              <div class="score-item">
                <span class="score-value">${this.results.total}</span>
                <span class="score-label">Total</span>
              </div>
            </div>
          </div>
          <div class="passing-status ${this.getPassingClass()}">
            ${this.getPassingMessage()}
          </div>
        </div>

        <!-- Section Results -->
        ${this.renderSectionResults()}

        <!-- AI Assessment -->
        ${this.renderAIAssessment()}

        <!-- Detailed Results -->
        <div class="detailed-results">
          <div class="results-tabs">
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="questions">Question Review</button>
            <button class="tab-btn" data-tab="analytics">Analytics</button>
            <button class="tab-btn" data-tab="export">Export</button>
          </div>
          
          <div class="tab-content">
            <div class="tab-panel active" id="overview-panel">
              ${this.renderOverview()}
            </div>
            <div class="tab-panel" id="questions-panel">
              ${this.renderQuestionReview()}
            </div>
            <div class="tab-panel" id="analytics-panel">
              ${this.renderAnalytics()}
            </div>
            <div class="tab-panel" id="export-panel">
              ${this.renderExport()}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="results-actions">
          <button id="restartQuizBtn" class="btn btn-secondary">Retake Quiz</button>
          <button id="newQuizBtn" class="btn btn-primary">New Quiz</button>
          <button id="saveResultsBtn" class="btn btn-success">Save Results</button>
          <button id="shareResultsBtn" class="btn btn-info">Share Results</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderCharts();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Tab navigation
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      this.eventManager.on(btn, 'click', () => this.switchTab(btn.dataset.tab));
    });

    // Action buttons
    const restartBtn = DOMHelpers.getElementById('restartQuizBtn');
    const newQuizBtn = DOMHelpers.getElementById('newQuizBtn');
    const saveBtn = DOMHelpers.getElementById('saveResultsBtn');
    const shareBtn = DOMHelpers.getElementById('shareResultsBtn');

    if (restartBtn) {
      this.eventManager.on(restartBtn, 'click', () => this.restartQuiz());
    }

    if (newQuizBtn) {
      this.eventManager.on(newQuizBtn, 'click', () => this.newQuiz());
    }

    if (saveBtn) {
      this.eventManager.on(saveBtn, 'click', () => this.saveResults());
    }

    if (shareBtn) {
      this.eventManager.on(shareBtn, 'click', () => this.shareResults());
    }

    // Export buttons
    const exportPDFBtn = this.container.querySelector('#exportPDFBtn');
    const exportCSVBtn = this.container.querySelector('#exportCSVBtn');
    const exportJSONBtn = this.container.querySelector('#exportJSONBtn');

    if (exportPDFBtn) {
      this.eventManager.on(exportPDFBtn, 'click', () => this.exportToPDF());
    }

    if (exportCSVBtn) {
      this.eventManager.on(exportCSVBtn, 'click', () => this.exportToCSV());
    }

    if (exportJSONBtn) {
      this.eventManager.on(exportJSONBtn, 'click', () => this.exportToJSON());
    }
  }

  /**
   * Render section results if available
   */
  renderSectionResults() {
    if (!this.results.sectionResults || Object.keys(this.results.sectionResults).length <= 1) {
      return '';
    }

    const sections = Object.entries(this.results.sectionResults).map(([section, result]) => {
      const percentage = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
      return `
        <div class="section-result">
          <div class="section-name">${section}</div>
          <div class="section-score">
            <span class="section-percentage">${percentage}%</span>
            <span class="section-details">(${result.correct}/${result.total})</span>
          </div>
          <div class="section-bar">
            <div class="section-progress" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section-results">
        <h3>Results by Section</h3>
        <div class="sections-grid">
          ${sections}
        </div>
      </div>
    `;
  }

  /**
   * Render AI assessment if available
   */
  renderAIAssessment() {
    if (!this.results.aiAssessment || !this.results.aiAssessment.success) {
      if (this.results.aiAssessmentError) {
        return `
          <div class="ai-assessment error">
            <h3>AI Assessment</h3>
            <div class="ai-error">
              <i class="icon-warning"></i>
              <span>${this.results.aiAssessmentError}</span>
            </div>
          </div>
        `;
      }
      return '';
    }

    const assessment = this.results.aiAssessment;
    const summary = assessment.summary || {};

    return `
      <div class="ai-assessment">
        <h3>AI-Powered Assessment</h3>
        <div class="ai-content">
          <div class="performance-summary">
            <div class="performance-category ${summary.overallPerformance?.color || 'primary'}">
              <span class="category-name">${summary.overallPerformance?.category || 'Assessment Complete'}</span>
              <span class="category-description">${summary.overallPerformance?.description || ''}</span>
            </div>
          </div>
          
          ${assessment.assessment ? `
            <div class="ai-section">
              <h4>Overall Assessment</h4>
              <p>${assessment.assessment}</p>
            </div>
          ` : ''}
          
          ${summary.strongAreas?.length ? `
            <div class="ai-section strengths">
              <h4>Your Strengths</h4>
              <ul>
                ${summary.strongAreas.map(strength => `<li>${strength}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${summary.improvementAreas?.length ? `
            <div class="ai-section improvements">
              <h4>Areas for Improvement</h4>
              <ul>
                ${summary.improvementAreas.map(area => `<li>${area}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${summary.actionItems?.length ? `
            <div class="ai-section recommendations">
              <h4>Recommended Actions</h4>
              <ul>
                ${summary.actionItems.map(action => `<li>${action}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render overview tab content
   */
  renderOverview() {
    const timeTaken = this.calculateTimeTaken();
    const accuracy = this.results.total > 0 ? (this.results.correct / this.results.total * 100).toFixed(1) : 0;

    return `
      <div class="overview-content">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${this.results.percentage}%</div>
            <div class="stat-label">Overall Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${accuracy}%</div>
            <div class="stat-label">Accuracy</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${timeTaken}</div>
            <div class="stat-label">Time Taken</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.results.total}</div>
            <div class="stat-label">Questions</div>
          </div>
        </div>
        
        <div class="performance-chart">
          <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>
      </div>
    `;
  }

  /**
   * Render question review tab content
   */
  renderQuestionReview() {
    if (!this.results.questions || this.results.questions.length === 0) {
      return '<p>No question details available.</p>';
    }

    const questions = this.results.questions.map((q, index) => {
      const isCorrect = q.isCorrect;
      const userAnswerText = q.options?.[q.userAnswer] || 'No answer';
      const correctAnswerText = q.options?.[q.correctAnswer] || 'Unknown';

      return `
        <div class="question-review ${isCorrect ? 'correct' : 'incorrect'}">
          <div class="question-header">
            <span class="question-number">Question ${index + 1}</span>
            <span class="question-status ${isCorrect ? 'correct' : 'incorrect'}">
              ${isCorrect ? 'Correct' : 'Incorrect'}
            </span>
          </div>
          <div class="question-text">${q.question}</div>
          <div class="answer-review">
            <div class="user-answer">
              <strong>Your Answer:</strong> ${userAnswerText}
            </div>
            ${!isCorrect ? `
              <div class="correct-answer">
                <strong>Correct Answer:</strong> ${correctAnswerText}
              </div>
            ` : ''}
            ${q.explanation ? `
              <div class="explanation">
                <strong>Explanation:</strong> ${q.explanation}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="question-review-content">
        <div class="review-summary">
          <span class="correct-count">${this.results.correct} Correct</span>
          <span class="incorrect-count">${this.results.total - this.results.correct} Incorrect</span>
        </div>
        <div class="questions-list">
          ${questions}
        </div>
      </div>
    `;
  }

  /**
   * Render analytics tab content
   */
  renderAnalytics() {
    return `
      <div class="analytics-content">
        <div class="analytics-grid">
          <div class="chart-container">
            <h4>Score Distribution</h4>
            <canvas id="scoreChart" width="300" height="200"></canvas>
          </div>
          <div class="chart-container">
            <h4>Section Performance</h4>
            <canvas id="sectionChart" width="300" height="200"></canvas>
          </div>
        </div>
        
        <div class="performance-insights">
          <h4>Performance Insights</h4>
          <div class="insights-list">
            ${this.generateInsights().map(insight => `
              <div class="insight-item">
                <i class="insight-icon ${insight.type}"></i>
                <span class="insight-text">${insight.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render export tab content
   */
  renderExport() {
    return `
      <div class="export-content">
        <h4>Export Your Results</h4>
        <div class="export-options">
          <div class="export-option">
            <button id="exportPDFBtn" class="btn btn-primary export-btn">
              <i class="icon-pdf"></i>
              Export as PDF
            </button>
            <p>Download a formatted PDF report with your complete results and analysis.</p>
          </div>
          
          <div class="export-option">
            <button id="exportCSVBtn" class="btn btn-secondary export-btn">
              <i class="icon-csv"></i>
              Export as CSV
            </button>
            <p>Download raw data in CSV format for further analysis in spreadsheet applications.</p>
          </div>
          
          <div class="export-option">
            <button id="exportJSONBtn" class="btn btn-info export-btn">
              <i class="icon-json"></i>
              Export as JSON
            </button>
            <p>Download complete data in JSON format for technical analysis or integration.</p>
          </div>
        </div>
        
        <div class="share-section">
          <h4>Share Results</h4>
          <div class="share-options">
            <button class="btn btn-social email">Share via Email</button>
            <button class="btn btn-social link">Copy Share Link</button>
            <button class="btn btn-social print">Print Results</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    const tabPanels = this.container.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });

    // Render charts for analytics tab
    if (tabName === 'analytics') {
      setTimeout(() => this.renderAnalyticsCharts(), 100);
    }
  }

  /**
   * Render charts
   */
  renderCharts() {
    // This would integrate with a charting library like Chart.js
    // For now, we'll create simple representations
    setTimeout(() => {
      this.renderPerformanceChart();
    }, 100);
  }

  /**
   * Render performance chart
   */
  renderPerformanceChart() {
    const canvas = this.container.querySelector('#performanceChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Simple bar chart representation
    const percentage = this.results.percentage;
    const barWidth = width * 0.6;
    const barHeight = height * 0.6;
    const x = (width - barWidth) / 2;
    const y = (height - barHeight) / 2;

    // Background bar
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress bar
    const progressWidth = (barWidth * percentage) / 100;
    ctx.fillStyle = this.getScoreColor();
    ctx.fillRect(x, y, progressWidth, barHeight);

    // Text
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${percentage}%`, width / 2, y + barHeight + 30);
  }

  /**
   * Render analytics charts
   */
  renderAnalyticsCharts() {
    // This would render more detailed charts
    // Implementation would depend on chosen charting library
  }

  /**
   * Generate performance insights
   */
  generateInsights() {
    const insights = [];
    const percentage = this.results.percentage;

    if (percentage >= 90) {
      insights.push({
        type: 'success',
        text: 'Excellent performance! You demonstrated strong mastery of the material.'
      });
    } else if (percentage >= 80) {
      insights.push({
        type: 'info',
        text: 'Good performance with solid understanding shown.'
      });
    } else if (percentage >= 70) {
      insights.push({
        type: 'warning',
        text: 'Satisfactory performance. Consider reviewing areas of weakness.'
      });
    } else {
      insights.push({
        type: 'error',
        text: 'Additional study recommended to improve understanding.'
      });
    }

    // Section-specific insights
    if (this.results.sectionResults) {
      const sections = Object.entries(this.results.sectionResults);
      const bestSection = sections.reduce((best, [name, result]) => {
        const percentage = result.total > 0 ? (result.correct / result.total) * 100 : 0;
        const bestPercentage = best.result.total > 0 ? (best.result.correct / best.result.total) * 100 : 0;
        return percentage > bestPercentage ? { name, result } : best;
      });

      if (bestSection && bestSection.result.total > 0) {
        const bestPercentage = Math.round((bestSection.result.correct / bestSection.result.total) * 100);
        insights.push({
          type: 'success',
          text: `Strongest performance in ${bestSection.name} section (${bestPercentage}%)`
        });
      }
    }

    return insights;
  }

  /**
   * Get score class for styling
   */
  getScoreClass() {
    const percentage = this.results.percentage;
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'satisfactory';
    if (percentage >= 60) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get score color
   */
  getScoreColor() {
    const percentage = this.results.percentage;
    if (percentage >= 90) return '#28a745';
    if (percentage >= 80) return '#17a2b8';
    if (percentage >= 70) return '#ffc107';
    if (percentage >= 60) return '#fd7e14';
    return '#dc3545';
  }

  /**
   * Get passing class
   */
  getPassingClass() {
    const passingScore = this.config.passingScore || 70;
    return this.results.percentage >= passingScore ? 'passed' : 'failed';
  }

  /**
   * Get passing message
   */
  getPassingMessage() {
    const passingScore = this.config.passingScore || 70;
    const passed = this.results.percentage >= passingScore;
    
    if (passed) {
      return `🎉 Congratulations! You passed with ${this.results.percentage}% (Required: ${passingScore}%)`;
    } else {
      return `You need ${passingScore}% to pass. You scored ${this.results.percentage}%. Keep studying!`;
    }
  }

  /**
   * Format completion time
   */
  formatCompletionTime() {
    if (this.results.completedAt) {
      return new Date(this.results.completedAt).toLocaleString();
    }
    return 'Recently completed';
  }

  /**
   * Format completion reason
   */
  formatCompletionReason() {
    switch (this.results.completionReason) {
      case 'completed':
        return 'Quiz completed normally';
      case 'timeout':
        return 'Time limit reached';
      case 'submitted':
        return 'Manually submitted';
      default:
        return 'Quiz completed';
    }
  }

  /**
   * Calculate time taken
   */
  calculateTimeTaken() {
    // This would calculate based on start/end times
    // For now, return a placeholder
    return 'N/A';
  }

  /**
   * Restart quiz
   */
  restartQuiz() {
    this.container.dispatchEvent(new CustomEvent('restartQuiz'));
  }

  /**
   * Start new quiz
   */
  newQuiz() {
    this.container.dispatchEvent(new CustomEvent('newQuiz'));
  }

  /**
   * Save results
   */
  async saveResults() {
    try {
      this.storageService.saveQuizResults(this.results);
      this.showMessage('Results saved successfully!', 'success');
    } catch (error) {
      this.showMessage('Failed to save results', 'error');
    }
  }

  /**
   * Share results
   */
  shareResults() {
    if (navigator.share) {
      navigator.share({
        title: 'Quiz Results',
        text: `I scored ${this.results.percentage}% on the quiz!`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      const text = `Quiz Results: ${this.results.percentage}% (${this.results.correct}/${this.results.total})`;
      navigator.clipboard.writeText(text).then(() => {
        this.showMessage('Results copied to clipboard!', 'success');
      });
    }
  }

  /**
   * Export to PDF
   */
  exportToPDF() {
    // This would integrate with a PDF library like jsPDF
    this.showMessage('PDF export feature coming soon!', 'info');
  }

  /**
   * Export to CSV
   */
  exportToCSV() {
    const csvData = this.generateCSVData();
    this.downloadFile(csvData, 'quiz-results.csv', 'text/csv');
  }

  /**
   * Export to JSON
   */
  exportToJSON() {
    const jsonData = JSON.stringify(this.results, null, 2);
    this.downloadFile(jsonData, 'quiz-results.json', 'application/json');
  }

  /**
   * Generate CSV data
   */
  generateCSVData() {
    const headers = ['Question', 'Your Answer', 'Correct Answer', 'Result'];
    const rows = this.results.questions.map((q, index) => [
      `"Question ${index + 1}"`,
      `"${q.options?.[q.userAnswer] || 'No answer'}"`,
      `"${q.options?.[q.correctAnswer] || 'Unknown'}"`,
      q.isCorrect ? 'Correct' : 'Incorrect'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Show message
   */
  showMessage(message, type = 'info') {
    // This would integrate with the app's message system
    console.log(`${type.toUpperCase()}: ${message}`);
  }

  /**
   * Render no results state
   */
  renderNoResults() {
    this.container.innerHTML = `
      <div class="no-results">
        <h2>No Results Available</h2>
        <p>No quiz results to display.</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Return to Configuration</button>
      </div>
    `;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.eventManager.cleanup();
  }
}
