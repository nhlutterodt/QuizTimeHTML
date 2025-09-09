// Enhanced User Data Storage Service for CRM Integration
export class UserDataService {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.userData = {
            profile: {},
            preferences: {},
            responses: [],
            analytics: {}
        };
        this.initialize();
    }

    // Initialize the service
    async initialize() {
        this.userId = this.generateUserId();
        await this.startSession();
        this.loadLocalData();
        this.setupBeforeUnloadHandler();
    }

    // Generate a unique user ID
    generateUserId() {
        const stored = localStorage.getItem('quiz_user_id');
        if (stored) return stored;
        
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('quiz_user_id', userId);
        return userId;
    }

    // Start a new quiz session
    async startSession(metadata = {}) {
        try {
            const response = await fetch(`${window.location.origin}/api/user-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    userId: this.userId,
                    sessionData: {
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ...metadata
                    }
                })
            });

            const result = await response.json();
            this.sessionId = result.sessionId;
            console.log('📊 User session started:', this.sessionId);
            
            return this.sessionId;
        } catch (error) {
            console.error('Failed to start session:', error);
            this.sessionId = `local_${Date.now()}`;
            return this.sessionId;
        }
    }

    // End the current session
    async endSession() {
        if (!this.sessionId) return;

        try {
            await fetch(`${window.location.origin}/api/user-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'end',
                    sessionId: this.sessionId
                })
            });

            console.log('📊 User session ended:', this.sessionId);
        } catch (error) {
            console.error('Failed to end session:', error);
        }
    }

    // Save user profile information
    updateProfile(profileData) {
        this.userData.profile = {
            ...this.userData.profile,
            ...profileData,
            lastUpdated: new Date().toISOString()
        };
        this.saveLocalData();
    }

    // Save user preferences
    updatePreferences(preferences) {
        this.userData.preferences = {
            ...this.userData.preferences,
            ...preferences,
            lastUpdated: new Date().toISOString()
        };
        this.saveLocalData();
    }

    // Record a question response
    async recordResponse(responseData) {
        const response = {
            id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            userId: this.userId,
            ...responseData
        };

        // Save locally
        this.userData.responses.push(response);
        this.saveLocalData();

        // Send to server for processing and storage
        try {
            await fetch(`${window.location.origin}/api/assess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...responseData,
                    userId: this.userId,
                    sessionId: this.sessionId
                })
            });
        } catch (error) {
            console.error('Failed to sync response to server:', error);
            // Mark for retry
            response.needsSync = true;
            this.saveLocalData();
        }

        return response;
    }

    // Update analytics data
    updateAnalytics(analyticsData) {
        this.userData.analytics = {
            ...this.userData.analytics,
            ...analyticsData,
            lastUpdated: new Date().toISOString()
        };
        this.saveLocalData();
    }

    // Load data from localStorage
    loadLocalData() {
        try {
            const stored = localStorage.getItem(`quiz_data_${this.userId}`);
            if (stored) {
                const data = JSON.parse(stored);
                this.userData = { ...this.userData, ...data };
            }
        } catch (error) {
            console.error('Failed to load local data:', error);
        }
    }

    // Save data to localStorage
    saveLocalData() {
        try {
            localStorage.setItem(`quiz_data_${this.userId}`, JSON.stringify(this.userData));
        } catch (error) {
            console.error('Failed to save local data:', error);
        }
    }

    // Get user statistics
    getStatistics() {
        const responses = this.userData.responses;
        
        return {
            totalQuestions: responses.length,
            correctAnswers: responses.filter(r => r.isCorrect).length,
            averageTime: responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / responses.length || 0,
            sessionsCompleted: new Set(responses.map(r => r.sessionId)).size,
            topicBreakdown: this.getTopicBreakdown(responses),
            timeSpentTotal: responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0),
            aiAssessmentUsage: responses.filter(r => r.aiAssessment).length
        };
    }

    // Get topic breakdown
    getTopicBreakdown(responses) {
        const topics = {};
        responses.forEach(response => {
            const topic = response.topic || 'General';
            if (!topics[topic]) {
                topics[topic] = { total: 0, correct: 0 };
            }
            topics[topic].total++;
            if (response.isCorrect) {
                topics[topic].correct++;
            }
        });
        return topics;
    }

    // Export data for CRM integration
    async exportForCRM(format = 'json') {
        try {
            const url = `/api/export-data?format=${format}&userId=${this.userId}`;
            const response = await fetch(url);
            
            if (format === 'csv') {
                const blob = await response.blob();
                return this.downloadFile(blob, 'quiz_data.csv', 'text/csv');
            } else {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Export failed:', error);
            // Fallback to local data export
            return this.exportLocalData(format);
        }
    }

    // Export local data as fallback
    exportLocalData(format = 'json') {
        if (format === 'csv') {
            const csvData = this.userData.responses.map(r => ({
                Date: r.timestamp,
                Question: r.questionText,
                UserAnswer: r.userAnswer,
                CorrectAnswer: r.correctAnswer,
                IsCorrect: r.isCorrect,
                TimeSpent: r.timeSpent,
                Topic: r.topic || 'General'
            }));

            const csvHeader = Object.keys(csvData[0] || {}).join(',');
            const csvRows = csvData.map(row => 
                Object.values(row).map(val => `"${val}"`).join(',')
            );
            const csv = [csvHeader, ...csvRows].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            return this.downloadFile(blob, 'quiz_data_local.csv', 'text/csv');
        } else {
            const data = {
                userId: this.userId,
                exportDate: new Date().toISOString(),
                statistics: this.getStatistics(),
                ...this.userData
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            return this.downloadFile(blob, 'quiz_data_local.json', 'application/json');
        }
    }

    // Helper to download files
    downloadFile(blob, filename, mimeType) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, filename, size: blob.size };
    }

    // Sync pending responses
    async syncPendingResponses() {
        const pending = this.userData.responses.filter(r => r.needsSync);
        const results = [];

        for (const response of pending) {
            try {
                await fetch(`${window.location.origin}/api/assess`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...response,
                        userId: this.userId,
                        sessionId: this.sessionId
                    })
                });

                // Remove sync flag
                response.needsSync = false;
                results.push({ id: response.id, status: 'synced' });
            } catch (error) {
                results.push({ id: response.id, status: 'failed', error: error.message });
            }
        }

        this.saveLocalData();
        return results;
    }

    // Get user dashboard data
    getDashboardData() {
        const stats = this.getStatistics();
        const recentResponses = this.userData.responses
            .slice(-10)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            userId: this.userId,
            sessionId: this.sessionId,
            profile: this.userData.profile,
            statistics: stats,
            recentActivity: recentResponses,
            preferences: this.userData.preferences,
            lastActive: new Date().toISOString()
        };
    }

    // Setup cleanup on page unload
    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            this.endSession();
            this.saveLocalData();
        });
    }

    // Create user profile collection form
    createProfileForm() {
        const form = document.createElement('div');
        form.className = 'user-profile-form';
        form.innerHTML = `
            <h3>📋 User Profile (Optional)</h3>
            <div class="form-group">
                <label for="user-name">Name:</label>
                <input type="text" id="user-name" placeholder="Your name" />
            </div>
            <div class="form-group">
                <label for="user-email">Email:</label>
                <input type="email" id="user-email" placeholder="your.email@domain.com" />
            </div>
            <div class="form-group">
                <label for="user-role">Role/Title:</label>
                <input type="text" id="user-role" placeholder="Student, Teacher, etc." />
            </div>
            <div class="form-group">
                <label for="user-organization">Organization:</label>
                <input type="text" id="user-organization" placeholder="School, Company, etc." />
            </div>
            <div class="form-actions">
                <button id="save-profile-btn" class="save-btn">Save Profile</button>
                <button id="skip-profile-btn" class="skip-btn">Skip</button>
            </div>
            <p class="privacy-note">
                ℹ️ This information helps us provide better analytics and is never shared without consent.
            </p>
        `;

        this.attachProfileFormListeners(form);
        return form;
    }

    // Attach listeners to profile form
    attachProfileFormListeners(form) {
        const saveBtn = form.querySelector('#save-profile-btn');
        const skipBtn = form.querySelector('#skip-profile-btn');

        saveBtn?.addEventListener('click', () => {
            const profile = {
                name: form.querySelector('#user-name')?.value || '',
                email: form.querySelector('#user-email')?.value || '',
                role: form.querySelector('#user-role')?.value || '',
                organization: form.querySelector('#user-organization')?.value || ''
            };
            
            this.updateProfile(profile);
            form.style.display = 'none';
        });

        skipBtn?.addEventListener('click', () => {
            form.style.display = 'none';
        });
    }

    // Clear all user data
    clearAllData() {
        if (confirm('Are you sure you want to clear all your quiz data? This cannot be undone.')) {
            localStorage.removeItem(`quiz_data_${this.userId}`);
            localStorage.removeItem('quiz_user_id');
            this.userData = {
                profile: {},
                preferences: {},
                responses: [],
                analytics: {}
            };
            location.reload(); // Restart with clean state
        }
    }

    // Get current user ID
    getUserId() {
        return this.userId;
    }

    // Get current session ID
    getSessionId() {
        return this.sessionId;
    }
}

// CSS styles for user data components
export const USER_DATA_STYLES = `
.user-profile-form {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    margin: 20px 0;
    border: 1px solid #e9ecef;
}

.user-profile-form h3 {
    margin-top: 0;
    color: #495057;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #495057;
}

.form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 5px;
    font-size: 14px;
}

.form-group input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.save-btn, .skip-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.3s;
}

.save-btn {
    background: #007bff;
    color: white;
}

.save-btn:hover {
    background: #0056b3;
}

.skip-btn {
    background: #6c757d;
    color: white;
}

.skip-btn:hover {
    background: #545b62;
}

.privacy-note {
    font-size: 12px;
    color: #6c757d;
    margin-top: 15px;
    font-style: italic;
}
`;
