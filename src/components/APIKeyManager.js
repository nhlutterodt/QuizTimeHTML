// Enhanced API Key Management and AI Status Component
export class APIKeyManager {
    constructor() {
        this.apiKey = null;
        this.aiStatus = {
            available: false,
            checking: false,
            error: null,
            lastChecked: null
        };
        this.statusCheckInterval = null;
        this.callbacks = [];
    }

    // Subscribe to AI status changes
    onStatusChange(callback) {
        this.callbacks.push(callback);
    }

    // Notify all subscribers of status changes
    notifyStatusChange() {
        this.callbacks.forEach(callback => callback(this.aiStatus));
    }

    // Initialize the API key manager
    async initialize() {
        await this.checkAIStatus();
        this.startStatusPolling();
        this.createKeyManagementUI();
    }

    // Create the API key management interface
    createKeyManagementUI() {
        const container = document.getElementById('ai-config-container') || this.createConfigContainer();
        
        container.innerHTML = `
            <div class="api-key-manager">
                <div class="ai-status-indicator" id="ai-status-indicator">
                    <span class="status-dot" id="status-dot"></span>
                    <span class="status-text" id="status-text">AI Status Unknown</span>
                    <button class="status-refresh" id="status-refresh" title="Refresh AI Status">🔄</button>
                </div>
                
                <div class="api-key-section" id="api-key-section" style="display: none;">
                    <h3>🔑 Configure OpenAI API Key</h3>
                    <div class="key-input-group">
                        <input 
                            type="password" 
                            id="api-key-input" 
                            placeholder="sk-..." 
                            class="api-key-input"
                            autocomplete="off"
                        />
                        <button id="validate-key-btn" class="validate-btn">Validate Key</button>
                        <button id="clear-key-btn" class="clear-btn">Clear</button>
                    </div>
                    <div class="key-info">
                        <p>
                            <span class="info-icon">ℹ️</span>
                            Your API key is encrypted and never stored permanently. 
                            Get your key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>
                        </p>
                    </div>
                    <div id="key-validation-result" class="validation-result"></div>
                </div>
                
                <div class="toggle-section">
                    <label class="ai-toggle">
                        <input type="checkbox" id="ai-enabled-toggle" />
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Enable AI Assessment</span>
                    </label>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.updateUI();
    }

    // Create the configuration container if it doesn't exist
    createConfigContainer() {
        const container = document.createElement('div');
        container.id = 'ai-config-container';
        container.className = 'ai-config-container';
        
        // Insert at the top of the configuration panel
        const configPanel = document.querySelector('.configuration-panel, .quiz-container');
        if (configPanel) {
            configPanel.insertBefore(container, configPanel.firstChild);
        } else {
            document.body.insertBefore(container, document.body.firstChild);
        }
        
        return container;
    }

    // Attach event listeners to UI elements
    attachEventListeners() {
        const statusRefresh = document.getElementById('status-refresh');
        const validateBtn = document.getElementById('validate-key-btn');
        const clearBtn = document.getElementById('clear-key-btn');
        const keyInput = document.getElementById('api-key-input');
        const aiToggle = document.getElementById('ai-enabled-toggle');

        if (statusRefresh) {
            statusRefresh.addEventListener('click', () => this.checkAIStatus(true));
        }

        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateAPIKey());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAPIKey());
        }

        if (keyInput) {
            keyInput.addEventListener('input', () => this.onKeyInputChange());
            keyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.validateAPIKey();
            });
        }

        if (aiToggle) {
            aiToggle.addEventListener('change', (e) => this.toggleAI(e.target.checked));
        }
    }

    // Handle API key input changes
    onKeyInputChange() {
        const keyInput = document.getElementById('api-key-input');
        const validateBtn = document.getElementById('validate-key-btn');
        
        if (keyInput && validateBtn) {
            validateBtn.disabled = !keyInput.value.trim();
            validateBtn.textContent = keyInput.value.trim() ? 'Validate Key' : 'Enter Key';
        }
    }

    // Check AI status from server
    async checkAIStatus(forceRefresh = false) {
        if (this.aiStatus.checking && !forceRefresh) return;

        this.aiStatus.checking = true;
        this.updateUI();

        try {
            const response = await fetch('/api/ai-status');
            const status = await response.json();
            
            this.aiStatus = {
                ...status,
                checking: false
            };

            this.notifyStatusChange();
        } catch (error) {
            console.error('Failed to check AI status:', error);
            this.aiStatus = {
                available: false,
                checking: false,
                error: 'Connection failed',
                lastChecked: new Date().toISOString()
            };
        }

        this.updateUI();
    }

    // Validate the entered API key
    async validateAPIKey() {
        const keyInput = document.getElementById('api-key-input');
        const validateBtn = document.getElementById('validate-key-btn');
        const resultDiv = document.getElementById('key-validation-result');

        if (!keyInput || !keyInput.value.trim()) {
            this.showValidationResult('Please enter an API key', 'error');
            return;
        }

        const apiKey = keyInput.value.trim();
        validateBtn.disabled = true;
        validateBtn.textContent = 'Validating...';
        
        try {
            const response = await fetch('/api/configure-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, action: 'validate' })
            });

            const result = await response.json();

            if (result.valid) {
                this.apiKey = apiKey;
                this.aiStatus = result.aiStatus;
                this.showValidationResult('✅ API key validated successfully!', 'success');
                keyInput.value = ''; // Clear for security
                document.getElementById('ai-enabled-toggle').checked = true;
            } else {
                this.showValidationResult(`❌ Validation failed: ${result.error}`, 'error');
            }

        } catch (error) {
            console.error('Validation error:', error);
            this.showValidationResult('❌ Network error during validation', 'error');
        }

        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate Key';
        this.updateUI();
    }

    // Clear the API key
    clearAPIKey() {
        this.apiKey = null;
        this.aiStatus = {
            available: false,
            checking: false,
            error: null,
            lastChecked: null
        };
        
        document.getElementById('api-key-input').value = '';
        document.getElementById('ai-enabled-toggle').checked = false;
        document.getElementById('key-validation-result').innerHTML = '';
        
        this.updateUI();
        this.notifyStatusChange();
    }

    // Toggle AI functionality
    toggleAI(enabled) {
        if (enabled && !this.aiStatus.available) {
            // Show API key section if trying to enable but no valid key
            document.getElementById('api-key-section').style.display = 'block';
            document.getElementById('ai-enabled-toggle').checked = false;
            this.showValidationResult('Please configure a valid API key first', 'warning');
        } else {
            // Update AI status
            this.aiStatus.available = enabled && this.apiKey;
            this.notifyStatusChange();
        }
        this.updateUI();
    }

    // Show validation result message
    showValidationResult(message, type) {
        const resultDiv = document.getElementById('key-validation-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="validation-message ${type}">${message}</div>`;
            setTimeout(() => {
                if (type !== 'success') {
                    resultDiv.innerHTML = '';
                }
            }, 5000);
        }
    }

    // Update the UI based on current status
    updateUI() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const statusRefresh = document.getElementById('status-refresh');
        const apiKeySection = document.getElementById('api-key-section');
        const aiToggle = document.getElementById('ai-enabled-toggle');

        if (!statusDot || !statusText) return;

        // Update status indicator
        statusDot.className = 'status-dot';
        statusRefresh.disabled = this.aiStatus.checking;

        if (this.aiStatus.checking) {
            statusDot.classList.add('checking');
            statusText.textContent = 'Checking AI Status...';
        } else if (this.aiStatus.available) {
            statusDot.classList.add('available');
            statusText.textContent = `AI Available (${new Date(this.aiStatus.lastChecked).toLocaleTimeString()})`;
        } else if (this.aiStatus.error) {
            statusDot.classList.add('error');
            statusText.textContent = `AI Unavailable: ${this.aiStatus.error}`;
        } else {
            statusDot.classList.add('disabled');
            statusText.textContent = 'AI Disabled - Configure API Key';
        }

        // Show/hide API key section
        if (apiKeySection) {
            const shouldShow = !this.aiStatus.available || this.aiStatus.error;
            apiKeySection.style.display = shouldShow ? 'block' : 'none';
        }

        // Update toggle state
        if (aiToggle) {
            aiToggle.checked = this.aiStatus.available;
        }
    }

    // Start periodic status checking
    startStatusPolling() {
        // Check every 2 minutes
        this.statusCheckInterval = setInterval(() => {
            this.checkAIStatus();
        }, 2 * 60 * 1000);
    }

    // Stop status polling
    stopStatusPolling() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    // Get current AI status
    getStatus() {
        return { ...this.aiStatus };
    }

    // Check if AI is available for use
    isAvailable() {
        return this.aiStatus.available && this.apiKey;
    }

    // Get secure API key for requests (don't expose the actual key)
    getAPIKeyStatus() {
        return {
            hasKey: !!this.apiKey,
            available: this.aiStatus.available,
            lastValidated: this.aiStatus.lastChecked
        };
    }

    // Cleanup
    destroy() {
        this.stopStatusPolling();
        this.callbacks = [];
    }
}

// Enhanced CSS styles for the API key manager
export const API_KEY_MANAGER_STYLES = `
.api-key-manager {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.ai-status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    padding: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #888;
    animation: pulse 2s infinite;
}

.status-dot.available { background: #4CAF50; }
.status-dot.error { background: #f44336; }
.status-dot.disabled { background: #ff9800; }
.status-dot.checking { 
    background: #2196F3; 
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
}

.status-text {
    flex: 1;
    font-weight: 500;
}

.status-refresh {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s;
}

.status-refresh:hover:not(:disabled) {
    background: rgba(255,255,255,0.3);
}

.status-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.api-key-section {
    background: rgba(255,255,255,0.1);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
}

.api-key-section h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
}

.key-input-group {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
}

.api-key-input {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
}

.validate-btn, .clear-btn {
    padding: 10px 15px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.3s;
}

.validate-btn {
    background: #4CAF50;
    color: white;
}

.validate-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.clear-btn {
    background: #f44336;
    color: white;
}

.key-info {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 10px;
}

.key-info a {
    color: #FFE082;
}

.validation-result {
    margin-top: 10px;
}

.validation-message {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
}

.validation-message.success {
    background: rgba(76, 175, 80, 0.2);
    border: 1px solid #4CAF50;
}

.validation-message.error {
    background: rgba(244, 67, 54, 0.2);
    border: 1px solid #f44336;
}

.validation-message.warning {
    background: rgba(255, 152, 0, 0.2);
    border: 1px solid #ff9800;
}

.toggle-section {
    display: flex;
    align-items: center;
    justify-content: center;
}

.ai-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
}

.ai-toggle input[type="checkbox"] {
    display: none;
}

.toggle-slider {
    width: 50px;
    height: 24px;
    background: rgba(255,255,255,0.3);
    border-radius: 12px;
    position: relative;
    transition: background 0.3s;
}

.toggle-slider::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.3s;
}

.ai-toggle input:checked + .toggle-slider {
    background: #4CAF50;
}

.ai-toggle input:checked + .toggle-slider::before {
    transform: translateX(26px);
}

.toggle-label {
    font-weight: 500;
}
`;
