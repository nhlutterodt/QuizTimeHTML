// Enhanced API Key Management and AI Status Component
export class APIKeyManager {
    constructor() {
        this.apiKey = null;
        this.selectedProvider = null;
        this.aiStatus = {
            available: false,
            enabled: false, // AI must be explicitly enabled
            checking: false,
            error: null,
            lastChecked: null,
            provider: null
        };
        this.statusCheckInterval = null;
        this.callbacks = [];
        
        // Supported AI providers
        this.providers = {
            openai: {
                name: 'OpenAI (ChatGPT)',
                keyFormat: 'sk-...',
                keyPattern: /^sk-[A-Za-z0-9]{48,}$/,
                description: 'GPT-3.5 and GPT-4 models for intelligent assessment'
            },
            gemini: {
                name: 'Google Gemini',
                keyFormat: 'AI...',
                keyPattern: /^AI[A-Za-z0-9]{38}$/,
                description: 'Google\'s Gemini Pro for comprehensive analysis'
            }
        };
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
        // Inject styles into the page
        this.injectStyles();
        
        // Don't automatically check AI status - user must enable first
        this.createKeyManagementUI();
        console.log('AI Assessment Manager initialized - disabled by default');
    }

    // Inject CSS styles into the page
    injectStyles() {
        // Check if styles are already injected
        if (document.getElementById('api-key-manager-styles')) {
            return;
        }

        const styleElement = document.createElement('style');
        styleElement.id = 'api-key-manager-styles';
        styleElement.textContent = API_KEY_MANAGER_STYLES;
        document.head.appendChild(styleElement);
        console.log('🎨 API Key Manager styles injected');
    }

    // Create the API key management interface
    createKeyManagementUI() {
        const container = document.getElementById('ai-config-container') || this.createConfigContainer();
        
        container.innerHTML = `
            <div class="api-key-manager">
                <div class="ai-header">
                    <h2>🤖 AI-Powered Assessment</h2>
                    <div class="ai-toggle-section">
                        <label class="ai-toggle">
                            <input type="checkbox" id="ai-enabled-toggle" />
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">Enable AI Assessment</span>
                        </label>
                    </div>
                </div>
                
                <div class="ai-status-indicator" id="ai-status-indicator">
                    <span class="status-dot" id="status-dot"></span>
                    <span class="status-text" id="status-text">AI Assessment Disabled</span>
                    <button class="status-refresh" id="status-refresh" title="Refresh AI Status" style="display: none;">🔄</button>
                </div>
                
                <!-- AI Configuration section - hidden by default with CSS -->
                <div class="ai-configuration" id="ai-configuration">
                    <div class="provider-selection" id="provider-selection">
                        <h3>1. Choose AI Provider</h3>
                        <div class="provider-options">
                            ${Object.entries(this.providers).map(([key, provider]) => `
                                <label class="provider-option">
                                    <input type="radio" name="ai-provider" value="${key}" id="provider-${key}">
                                    <div class="provider-card">
                                        <div class="provider-name">${provider.name}</div>
                                        <div class="provider-description">${provider.description}</div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- API Key section - hidden by default with CSS -->
                    <div class="api-key-section" id="api-key-section">
                        <h3>2. Configure API Key</h3>
                        <div class="provider-info" id="provider-info"></div>
                        <div class="key-input-group">
                            <input 
                                type="password" 
                                id="api-key-input" 
                                placeholder="Enter your API key..." 
                                class="api-key-input"
                                autocomplete="off"
                            />
                            <button id="validate-key-btn" class="validate-btn" disabled>Validate Key</button>
                            <button id="clear-key-btn" class="clear-btn">Clear</button>
                        </div>
                        <div class="key-security-info">
                            <span class="security-icon">🔒</span>
                            <p>Your API key is encrypted and stored securely for this session only. It will never be saved permanently or shared.</p>
                        </div>
                        <div id="key-validation-result" class="validation-result"></div>
                    </div>
                    
                    <div class="ai-features-info">
                        <h3>📊 What AI Assessment Provides:</h3>
                        <ul class="features-list">
                            <li>✨ Personalized feedback for each answer</li>
                            <li>📈 Detailed performance analysis</li>
                            <li>🎯 Study recommendations based on your weaknesses</li>
                            <li>💡 Explanations for correct and incorrect answers</li>
                            <li>📝 Overall quiz assessment with insights</li>
                        </ul>
                    </div>
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
        const configPanel = document.querySelector('.configuration-container, .quiz-container, #configurationContainer');
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

        // AI Toggle
        if (aiToggle) {
            aiToggle.addEventListener('change', (e) => this.toggleAI(e.target.checked));
        }

        // Provider selection
        const providerRadios = document.querySelectorAll('input[name="ai-provider"]');
        providerRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectProvider(e.target.value);
                }
            });
        });

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
    }

    // Handle provider selection
    selectProvider(providerId) {
        this.selectedProvider = providerId;
        const provider = this.providers[providerId];
        
        if (!provider) {
            console.error('Invalid provider selected:', providerId);
            return;
        }

        // Show API key section using CSS class
        const apiKeySection = document.getElementById('api-key-section');
        apiKeySection.classList.add('visible');

        // Update provider info
        const providerInfo = document.getElementById('provider-info');
        providerInfo.innerHTML = `
            <div class="selected-provider-info">
                <strong>${provider.name}</strong> selected
                <p>Enter your API key in the format: <code>${provider.keyFormat}</code></p>
                <p class="get-key-link">
                    ${this.getProviderKeyLink(providerId)}
                </p>
            </div>
        `;

        // Update input placeholder
        const keyInput = document.getElementById('api-key-input');
        keyInput.placeholder = provider.keyFormat;
        keyInput.value = ''; // Clear any existing value

        // Update validation button
        this.onKeyInputChange();
        
        console.log(`AI Provider selected: ${provider.name}`);
    }

    // Get provider-specific link for obtaining API keys
    getProviderKeyLink(providerId) {
        const links = {
            openai: 'Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a>',
            gemini: 'Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>'
        };
        return links[providerId] || 'Check your provider\'s documentation for API key information';
    }

    // Handle API key input changes with provider validation
    onKeyInputChange() {
        const keyInput = document.getElementById('api-key-input');
        const validateBtn = document.getElementById('validate-key-btn');
        
        if (keyInput && validateBtn) {
            const hasKey = keyInput.value.trim();
            const isValidFormat = this.selectedProvider && hasKey && 
                this.providers[this.selectedProvider]?.keyPattern.test(hasKey);
            
            validateBtn.disabled = !hasKey;
            
            if (hasKey && !isValidFormat && this.selectedProvider) {
                validateBtn.textContent = 'Invalid Format';
                validateBtn.disabled = true;
            } else if (hasKey) {
                validateBtn.textContent = 'Validate Key';
                validateBtn.disabled = false;
            } else {
                validateBtn.textContent = 'Enter Key';
                validateBtn.disabled = true;
            }
        }
    }

    // Validate the entered API key
    async validateAPIKey() {
        const keyInput = document.getElementById('api-key-input');
        const validateBtn = document.getElementById('validate-key-btn');

        if (!keyInput?.value.trim()) {
            this.showValidationResult('Please enter an API key', 'error');
            return;
        }

        if (!this.selectedProvider) {
            this.showValidationResult('Please select an AI provider first', 'error');
            return;
        }

        const apiKey = keyInput.value.trim();
        const provider = this.providers[this.selectedProvider];
        
        // Validate format first
        if (!provider.keyPattern.test(apiKey)) {
            this.showValidationResult(`Invalid ${provider.name} API key format. Expected format: ${provider.keyFormat}`, 'error');
            return;
        }

        validateBtn.disabled = true;
        validateBtn.textContent = 'Validating...';
        
        try {
            const response = await fetch('/api/configure-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey, 
                    provider: this.selectedProvider,
                    action: 'validate' 
                })
            });

            const result = await response.json();

            if (result.valid) {
                this.apiKey = apiKey;
                this.aiStatus.available = true;
                this.aiStatus.provider = this.selectedProvider;
                this.aiStatus.error = null;
                this.aiStatus.lastChecked = new Date().toISOString();
                
                this.showValidationResult(`✅ ${provider.name} API key validated successfully!`, 'success');
                keyInput.value = ''; // Clear for security
                
                // Show refresh button now that AI is available
                document.getElementById('status-refresh').style.display = 'inline-block';
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
        this.notifyStatusChange();
    }

    // Clear the API key
    clearAPIKey() {
        this.apiKey = null;
        this.selectedProvider = null;
        this.aiStatus = {
            available: false,
            enabled: false,
            checking: false,
            error: null,
            lastChecked: null,
            provider: null
        };
        
        // Reset UI
        document.getElementById('api-key-input').value = '';
        document.getElementById('ai-enabled-toggle').checked = false;
        document.getElementById('key-validation-result').innerHTML = '';
        
        // Clear provider selection
        const providerRadios = document.querySelectorAll('input[name="ai-provider"]');
        providerRadios.forEach(radio => radio.checked = false);
        
        // Hide sections using CSS classes
        document.getElementById('api-key-section').classList.remove('visible');
        document.getElementById('ai-configuration').classList.remove('enabled');
        document.getElementById('status-refresh').style.display = 'none';
        
        this.updateUI();
        this.notifyStatusChange();
    }

    // Toggle AI functionality
    toggleAI(enabled) {
        this.aiStatus.enabled = enabled;
        
        const configSection = document.getElementById('ai-configuration');
        
        if (enabled) {
            // Show configuration when enabling using CSS class
            configSection.classList.add('enabled');
            
            // If no provider selected, don't mark as available yet
            if (!this.selectedProvider) {
                this.aiStatus.available = false;
                this.showValidationResult('Please select an AI provider and configure your API key', 'info');
            } else if (!this.apiKey) {
                this.aiStatus.available = false;
                this.showValidationResult('Please enter and validate your API key', 'warning');
            } else {
                this.aiStatus.available = true;
            }
        } else {
            // Hide configuration when disabling using CSS class
            configSection.classList.remove('enabled');
            this.aiStatus.available = false;
        }
        
        this.updateUI();
        this.notifyStatusChange();
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
        const aiToggle = document.getElementById('ai-enabled-toggle');

        if (!statusDot || !statusText) return;

        // Update status indicator
        statusDot.className = 'status-dot';
        if (statusRefresh) statusRefresh.disabled = this.aiStatus.checking;

        if (!this.aiStatus.enabled) {
            statusDot.classList.add('disabled');
            statusText.textContent = 'AI Assessment Disabled';
        } else if (this.aiStatus.checking) {
            statusDot.classList.add('checking');
            statusText.textContent = 'Checking AI Status...';
        } else if (this.aiStatus.available && this.aiStatus.provider) {
            statusDot.classList.add('available');
            const providerName = this.providers[this.aiStatus.provider]?.name || this.aiStatus.provider;
            statusText.textContent = `AI Available (${providerName}) - Last checked: ${new Date(this.aiStatus.lastChecked).toLocaleTimeString()}`;
        } else if (this.aiStatus.error) {
            statusDot.classList.add('error');
            statusText.textContent = `AI Error: ${this.aiStatus.error}`;
        } else if (this.aiStatus.enabled) {
            statusDot.classList.add('warning');
            statusText.textContent = 'AI Enabled - Awaiting Configuration';
        }

        // Update toggle state
        if (aiToggle) {
            aiToggle.checked = this.aiStatus.enabled;
        }
    }

    // Check AI status from server (only when enabled and configured)
    async checkAIStatus(forceRefresh = false) {
        if (!this.aiStatus.enabled || !this.selectedProvider || !this.apiKey) {
            return;
        }

        if (this.aiStatus.checking && !forceRefresh) return;

        this.aiStatus.checking = true;
        this.updateUI();

        try {
            const response = await fetch('/api/ai-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: this.selectedProvider })
            });
            const status = await response.json();
            
            this.aiStatus = {
                ...this.aiStatus,
                available: status.available,
                error: status.error,
                lastChecked: new Date().toISOString(),
                checking: false
            };

            this.notifyStatusChange();
        } catch (error) {
            console.error('Failed to check AI status:', error);
            this.aiStatus = {
                ...this.aiStatus,
                available: false,
                checking: false,
                error: 'Connection failed',
                lastChecked: new Date().toISOString()
            };
        }

        this.updateUI();
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

.ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
}

.ai-header h2 {
    margin: 0;
    font-size: 1.4rem;
}

.ai-toggle-section {
    display: flex;
    align-items: center;
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
.status-dot.disabled { background: #9e9e9e; animation: none; }
.status-dot.warning { background: #ff9800; }
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
    font-size: 0.9rem;
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

/* AI Configuration - Hidden by default, shown when enabled */
.ai-configuration {
    display: none;
    margin-top: 15px;
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
}

.ai-configuration.enabled {
    display: block;
    opacity: 1;
    max-height: 2000px; /* Large enough for content */
    overflow: visible;
}

/* Fallback for browsers without JavaScript */
.no-js .ai-configuration {
    display: block;
    opacity: 1;
    max-height: none;
    overflow: visible;
}

.provider-selection h3,
.api-key-section h3 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    color: #FFE082;
}

.provider-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
}

.provider-option {
    cursor: pointer;
    display: block;
}

.provider-option input[type="radio"] {
    display: none;
}

.provider-card {
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 15px;
    transition: all 0.3s ease;
    text-align: center;
}

.provider-option input[type="radio"]:checked + .provider-card {
    background: rgba(255,255,255,0.2);
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
}

.provider-card:hover {
    background: rgba(255,255,255,0.15);
    transform: translateY(-2px);
}

.provider-name {
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 5px;
}

.provider-description {
    font-size: 0.8rem;
    opacity: 0.8;
    line-height: 1.3;
}

/* API Key section - Hidden by default, shown when provider selected */
.api-key-section {
    display: none;
    background: rgba(255,255,255,0.1);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
}

.api-key-section.visible {
    display: block;
    opacity: 1;
    max-height: 1000px; /* Large enough for content */
    overflow: visible;
}

/* Fallback for browsers without JavaScript */
.no-js .api-key-section {
    display: block;
    opacity: 1;
    max-height: none;
    overflow: visible;
}

.selected-provider-info {
    background: rgba(76, 175, 80, 0.2);
    padding: 10px;
    border-radius: 6px;
    margin-bottom: 15px;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.selected-provider-info strong {
    display: block;
    margin-bottom: 5px;
}

.selected-provider-info p {
    margin: 5px 0;
    font-size: 0.85rem;
}

.selected-provider-info code {
    background: rgba(255,255,255,0.2);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
}

.get-key-link a {
    color: #FFE082;
    text-decoration: none;
}

.get-key-link a:hover {
    text-decoration: underline;
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
    white-space: nowrap;
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

.key-security-info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.8rem;
    opacity: 0.8;
    margin-top: 10px;
    padding: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 4px;
}

.security-icon {
    font-size: 1rem;
    margin-top: 2px;
}

.key-security-info p {
    margin: 0;
    line-height: 1.4;
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

.validation-message.info {
    background: rgba(33, 150, 243, 0.2);
    border: 1px solid #2196F3;
}

.ai-features-info {
    background: rgba(255,255,255,0.05);
    padding: 15px;
    border-radius: 8px;
    margin-top: 20px;
}

.ai-features-info h3 {
    margin: 0 0 10px 0;
    font-size: 1rem;
    color: #FFE082;
}

.features-list {
    margin: 0;
    padding-left: 20px;
    line-height: 1.6;
}

.features-list li {
    margin-bottom: 5px;
    font-size: 0.9rem;
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
    font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 768px) {
    .provider-options {
        grid-template-columns: 1fr;
    }
    
    .ai-header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
    
    .key-input-group {
        flex-direction: column;
    }
    
    .validate-btn, .clear-btn {
        width: 100%;
    }
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
    .ai-configuration,
    .api-key-section {
        transition: none;
    }
    
    .status-dot {
        animation: none;
    }
    
    .provider-card {
        transition: none;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .provider-card {
        border-width: 3px;
    }
    
    .validation-message {
        border-width: 2px;
    }
}
`;
