# Developer Guide - Multi-Provider AI Assessment System

## 🏗️ Architecture Overview

### System Design Principles

The application follows a **modular, component-based architecture** with clear separation of concerns:

- **Components**: UI elements with their own logic and styling
- **Services**: Business logic and external API communication  
- **Utils**: Shared utilities and helper functions
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Security-First**: API keys encrypted, session-only storage

### Tech Stack

- **Frontend**: Vanilla JavaScript ES6+ modules
- **Backend**: Node.js with Express.js
- **Styling**: CSS3 with custom properties and animations
- **Security**: Crypto module for encryption, session-based key storage
- **Data**: CSV support with client-side parsing

## 🔧 Development Setup

### Prerequisites

```bash
# Required software
Node.js 18+ 
npm 8+
Modern browser (Chrome 80+, Firefox 75+, Safari 13+)
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd QuizTimeHTML

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your API keys (optional for development)

# Start development server
npm run dev
```

### Development Workflow

```bash
# Start server with hot reload
npm run dev

# Start production server
npm start

# Stop all Node processes
npm run stop

# Run tests (when implemented)
npm test
```

## 📁 Project Structure Deep Dive

```
src/
├── components/           # UI Components (ES6 Classes)
│   ├── QuizApp.js           # Main orchestrator
│   ├── APIKeyManager.js     # AI provider management  
│   ├── ConfigurationPanel.js # Quiz settings
│   ├── QuizRenderer.js      # Question display
│   ├── TimerManager.js      # Timer functionality
│   ├── AIAssessment.js      # AI integration
│   └── ResultsManager.js    # Results display
│
├── services/            # Business Logic
│   ├── QuestionService.js   # Question data management
│   ├── APIService.js        # Server communication
│   ├── StorageService.js    # Local storage operations
│   └── UserDataService.js   # User data management
│
├── utils/               # Shared Utilities
│   ├── DOMHelpers.js        # DOM manipulation
│   ├── EventManager.js      # Event handling
│   └── ValidationHelpers.js # Input validation
│
├── data/                # Data Management
│   ├── csv-manager.js       # CSV parsing/processing
│   └── questions.csv        # Sample data
│
└── style/               # Stylesheets
    └── quiz-style.css       # Main application styles
```

## 🧩 Component Architecture

### Component Base Pattern

All components follow this pattern:

```javascript
export class ComponentName {
  constructor(dependencies) {
    // Initialize properties
    this.dependency = dependency;
    this.eventManager = new EventManager();
    this.state = {};
  }

  // Lifecycle methods
  async init() { /* Setup */ }
  render() { /* Create DOM */ }
  attachEventListeners() { /* Bind events */ }
  updateState(newState) { /* State management */ }
  destroy() { /* Cleanup */ }
}
```

### Key Components Explained

#### APIKeyManager
**Purpose**: Manage AI provider selection and API key validation

```javascript
export class APIKeyManager {
  constructor() {
    this.providers = {
      openai: { /* config */ },
      gemini: { /* config */ }
    };
    this.aiStatus = { /* status tracking */ };
  }

  // Key methods
  async validateAPIKey() { /* Server validation */ }
  toggleAI(enabled) { /* Enable/disable AI */ }
  selectProvider(providerId) { /* Provider selection */ }
}
```

**Extension Points**:
- Add new providers to `this.providers` object
- Implement provider-specific validation in `validateAPIKey()`
- Add provider-specific UI in `createKeyManagementUI()`

#### QuizApp (Main Orchestrator)
**Purpose**: Coordinate all components and manage application state

```javascript
export class QuizApp {
  constructor() {
    // Initialize all components
    this.apiKeyManager = new APIKeyManager();
    this.configPanel = new ConfigurationPanel();
    // ... other components
  }

  async init() {
    // Setup sequence
    this.initializeContainers();
    await this.initializeServices();
    this.initializeComponents();
    this.setupEventListeners();
  }
}
```

**Extension Points**:
- Add new components in constructor
- Extend initialization sequence in `init()`
- Add global event handlers in `setupEventListeners()`

## 🔌 API Integration

### Server Endpoints

#### Multi-Provider AI Assessment
```javascript
POST /api/assess
{
  "provider": "openai|gemini",
  "questionText": "string",
  "userAnswerArray": ["string"],
  "correctAnswerArray": ["string"],
  "userId": "string",
  "sessionId": "string"
}

Response:
{
  "assessment": "string",
  "sessionId": "string"
}
```

#### API Key Management
```javascript
POST /api/configure-key
{
  "apiKey": "string",
  "provider": "openai|gemini", 
  "action": "validate|store|clear"
}

Response:
{
  "valid": boolean,
  "encrypted": "string",
  "error": "string"
}
```

### Adding New AI Providers

1. **Update Provider Configuration**:
```javascript
// In APIKeyManager.js
this.providers.newProvider = {
  name: 'New Provider Name',
  keyFormat: 'expected-format',
  keyPattern: /^pattern-regex$/,
  description: 'Provider description'
};
```

2. **Implement Server Handler**:
```javascript
// In server.js
async function callNewProvider(questionText, userAnswer, correctAnswer, apiKey) {
  const response = await fetch('https://api.newprovider.com/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Provider-specific request format
    })
  });
  
  return response; // Provider-specific response handling
}
```

3. **Add to Assessment Switch**:
```javascript
// In server.js /api/assess endpoint
case 'newProvider':
  assessment = await callNewProvider(questionText, userAnswerArray, correctAnswerArray, apiKey);
  break;
```

## 🔒 Security Implementation

### API Key Encryption

```javascript
// Encryption (server-side)
function encryptApiKey(text) {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Decryption (server-side)  
function decryptApiKey(text) {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(text, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Session Management

```javascript
// Session-only storage pattern
class SessionStorage {
  constructor() {
    this.session = new Map(); // Cleared on server restart
  }
  
  store(sessionId, data) {
    this.session.set(sessionId, {
      ...data,
      timestamp: Date.now()
    });
  }
  
  retrieve(sessionId) {
    return this.session.get(sessionId);
  }
  
  clear(sessionId) {
    this.session.delete(sessionId);
  }
}
```

### Input Validation

```javascript
// Provider-specific validation
function validateProvider(provider) {
  const allowedProviders = ['openai', 'gemini'];
  return allowedProviders.includes(provider);
}

function validateApiKey(provider, key) {
  const patterns = {
    openai: /^sk-[A-Za-z0-9]{48,}$/,
    gemini: /^AI[A-Za-z0-9]{38}$/
  };
  
  return patterns[provider]?.test(key) || false;
}
```

## 🎨 Styling Architecture

### CSS Custom Properties

```css
:root {
  /* Color palette */
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  
  /* Component spacing */
  --border-radius: 8px;
  --box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  --transition: all 0.3s ease;
}
```

### Component-Specific Styles

Each component can inject its own styles:

```javascript
// Pattern for component styling
export const COMPONENT_STYLES = `
.component-name {
  /* Component styles */
}

/* Responsive design */
@media (max-width: 768px) {
  .component-name {
    /* Mobile styles */
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .component-name {
    transition: none;
  }
}
`;

// Injection method
injectStyles() {
  if (document.getElementById('component-name-styles')) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'component-name-styles';
  styleElement.textContent = COMPONENT_STYLES;
  document.head.appendChild(styleElement);
}
```

## 🧪 Testing Strategy

### Test Structure (Planned)

```
src/tests/
├── unit/                # Unit tests
│   ├── components/         # Component tests
│   ├── services/          # Service tests
│   └── utils/             # Utility tests
│
├── integration/         # Integration tests
│   ├── api/               # API endpoint tests
│   └── ui/                # UI interaction tests
│
└── e2e/                 # End-to-end tests
    ├── user-flows/        # Complete user journeys
    └── cross-browser/     # Browser compatibility
```

### Testing Patterns

```javascript
// Component testing pattern
describe('APIKeyManager', () => {
  let apiKeyManager;
  
  beforeEach(() => {
    apiKeyManager = new APIKeyManager();
    document.body.innerHTML = '<div id="test-container"></div>';
  });
  
  afterEach(() => {
    apiKeyManager.destroy();
    document.body.innerHTML = '';
  });
  
  it('should initialize with AI disabled', () => {
    expect(apiKeyManager.aiStatus.enabled).toBe(false);
  });
  
  it('should validate OpenAI key format', () => {
    const validKey = 'sk-proj-' + 'a'.repeat(48);
    expect(apiKeyManager.validateKeyFormat('openai', validKey)).toBe(true);
  });
});
```

## 📊 Performance Optimization

### Lazy Loading Pattern

```javascript
// Dynamic component loading
async function loadComponent(componentName) {
  const { [componentName]: Component } = await import(`./components/${componentName}.js`);
  return new Component();
}

// Usage
const quizRenderer = await loadComponent('QuizRenderer');
```

### Event Delegation

```javascript
// Efficient event handling
class EventManager {
  constructor() {
    this.delegates = new Map();
  }
  
  delegate(container, selector, event, handler) {
    const delegateHandler = (e) => {
      if (e.target.matches(selector)) {
        handler(e);
      }
    };
    
    container.addEventListener(event, delegateHandler);
    this.delegates.set(`${selector}-${event}`, delegateHandler);
  }
  
  cleanup() {
    // Remove all delegated events
    this.delegates.clear();
  }
}
```

### Memory Management

```javascript
// Component cleanup pattern
class Component {
  destroy() {
    // Remove event listeners
    this.eventManager.cleanup();
    
    // Clear references
    this.element = null;
    this.callbacks = [];
    
    // Remove from DOM
    if (this.container) {
      this.container.remove();
    }
  }
}
```

## 🚀 Deployment

### Production Build (Future)

```javascript
// Planned build configuration
const buildConfig = {
  entry: './index.html',
  output: './dist/',
  optimization: {
    minify: true,
    bundleComponents: true,
    compressAssets: true
  },
  features: {
    serviceWorker: true,
    manifest: true,
    offlineMode: true
  }
};
```

### Environment Configuration

```javascript
// Environment-specific settings
const config = {
  development: {
    debug: true,
    apiTimeout: 10000,
    enableMocking: true
  },
  production: {
    debug: false,
    apiTimeout: 5000,
    enableMocking: false
  }
};
```

## 🔮 Future Enhancements

### Planned Features

1. **TypeScript Migration**
   - Type safety for better development experience
   - Better IDE support and refactoring

2. **Build Pipeline**
   - Webpack/Vite for bundling
   - CSS/JS minification
   - Asset optimization

3. **Testing Framework**
   - Jest for unit testing
   - Cypress for E2E testing
   - GitHub Actions CI/CD

4. **PWA Features**
   - Service Worker for offline mode
   - App manifest for installability
   - Background sync for data

5. **Advanced AI Features**
   - Custom prompt templates
   - Response caching
   - Usage analytics
   - A/B testing framework

### Extension Points

The architecture is designed for easy extension:

- **New Components**: Follow the component pattern
- **New Services**: Implement the service interface  
- **New Providers**: Add to provider configuration
- **New Features**: Use the event system for loose coupling

---

**🎯 This architecture provides a solid foundation for scalable, maintainable quiz application development!** The modular design makes it easy to add features, fix bugs, and adapt to changing requirements.
