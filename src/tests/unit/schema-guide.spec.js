// Unit tests for Schema Guide components
// Simple test framework to verify component rendering and basic functionality

import { SchemaGuideButton } from '../../components/SchemaGuideButton.js';
import { SchemaGuideModal } from '../../components/SchemaGuideModal.js';
import QuestionSchema from '../../models/QuestionSchema.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description, testFn) {
    this.tests.push({ description, testFn });
  }

  async run() {
    console.log('🧪 Running Schema Guide Tests...\n');

    for (const { description, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${description}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${description}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
}

// Setup DOM environment for testing
function setupTestDOM() {
  // Create a container for testing
  if (!document.getElementById('testContainer')) {
    const container = document.createElement('div');
    container.id = 'testContainer';
    container.style.display = 'none'; // Hidden during tests
    document.body.appendChild(container);
  }
}

function cleanupTestDOM() {
  const container = document.getElementById('testContainer');
  if (container) {
    container.innerHTML = '';
  }
  
  // Remove any modals
  const modals = document.querySelectorAll('[id*="schemaGuideModal"]');
  modals.forEach(modal => modal.remove());
}

// Test suite
const runner = new TestRunner();

// Test QuestionSchema helper methods
runner.test('QuestionSchema.getBaseFields returns required fields', () => {
  const baseFields = QuestionSchema.getBaseFields();
  runner.assert(Array.isArray(baseFields), 'Should return an array');
  runner.assert(baseFields.length > 0, 'Should have at least one field');
  
  const requiredFieldNames = ['id', 'question', 'type', 'correct_answer'];
  requiredFieldNames.forEach(fieldName => {
    const field = baseFields.find(f => f.name === fieldName);
    runner.assert(field, `Should include ${fieldName} field`);
    runner.assert(field.required === true, `${fieldName} should be required`);
  });
});

runner.test('QuestionSchema.getPresetFields returns preset-specific fields', () => {
  const mcFields = QuestionSchema.getPresetFields('multiple-choice');
  runner.assert(mcFields.required, 'Should have required fields');
  runner.assert(mcFields.optional, 'Should have optional fields');
  
  // Check for option fields in multiple choice
  const optionA = mcFields.required.find(f => f.name === 'option_a');
  runner.assert(optionA, 'Multiple choice should require option_a');
});

runner.test('QuestionSchema.getExampleCSVRow returns valid examples', () => {
  const mcExample = QuestionSchema.getExampleCSVRow('multiple-choice');
  runner.assert(mcExample.headers, 'Should have headers');
  runner.assert(mcExample.row, 'Should have row data');
  runner.assert(mcExample.headers.length === mcExample.row.length, 'Headers and row should match length');
});

runner.test('QuestionSchema.getExampleJSON returns valid JSON examples', () => {
  const mcExample = QuestionSchema.getExampleJSON('multiple-choice');
  runner.assert(typeof mcExample === 'object', 'Should return an object');
  runner.assert(mcExample.id, 'Should have id field');
  runner.assert(mcExample.question, 'Should have question field');
  runner.assert(mcExample.type === 'multiple_choice', 'Should have correct type');
});

// Test SchemaGuideButton component
runner.test('SchemaGuideButton renders correctly', () => {
  setupTestDOM();
  const container = document.getElementById('testContainer');
  
  const button = new SchemaGuideButton(container);
  button.render();
  
  const buttonElement = document.getElementById('schemaGuideBtn');
  runner.assert(buttonElement, 'Button should be rendered');
  runner.assert(buttonElement.classList.contains('schema-guide-button'), 'Should have correct CSS class');
  runner.assert(buttonElement.textContent.includes('Schema Guide'), 'Should have correct text');
  
  cleanupTestDOM();
});

runner.test('SchemaGuideButton dispatches event on click', (done) => {
  setupTestDOM();
  const container = document.getElementById('testContainer');
  
  // Listen for the custom event
  const eventListener = (event) => {
    runner.assert(event.type === 'schema-guide:open', 'Should dispatch correct event type');
    runner.assert(event.detail.source === 'schema-guide-button', 'Should include correct source');
    document.removeEventListener('schema-guide:open', eventListener);
    cleanupTestDOM();
    done();
  };
  
  document.addEventListener('schema-guide:open', eventListener);
  
  const button = new SchemaGuideButton(container);
  button.render();
  
  const buttonElement = document.getElementById('schemaGuideBtn');
  buttonElement.click();
  
  // If event doesn't fire in 100ms, fail the test
  setTimeout(() => {
    document.removeEventListener('schema-guide:open', eventListener);
    cleanupTestDOM();
    throw new Error('Event was not dispatched');
  }, 100);
});

// Test SchemaGuideModal component
runner.test('SchemaGuideModal renders correctly', () => {
  setupTestDOM();
  
  const modal = new SchemaGuideModal();
  modal.init();
  modal.show();
  
  const modalElement = document.getElementById('schemaGuideModal');
  runner.assert(modalElement, 'Modal should be rendered');
  runner.assert(modalElement.classList.contains('modal-overlay'), 'Should have correct CSS class');
  
  // Check for key sections
  const title = document.getElementById('schemaGuideTitle');
  runner.assert(title, 'Should have title element');
  runner.assert(title.textContent.includes('CSV Schema Guide'), 'Should have correct title');
  
  const presetSelector = document.querySelector('.preset-selector');
  runner.assert(presetSelector, 'Should have preset selector');
  
  const requiredFields = document.getElementById('requiredFields');
  runner.assert(requiredFields, 'Should have required fields section');
  
  modal.hide();
  cleanupTestDOM();
});

runner.test('SchemaGuideModal updates content when preset changes', () => {
  setupTestDOM();
  
  const modal = new SchemaGuideModal();
  modal.init();
  modal.show();
  
  // Select multiple choice preset
  const mcRadio = document.querySelector('input[name="preset"][value="multiple-choice"]');
  runner.assert(mcRadio, 'Should have multiple choice radio button');
  
  mcRadio.checked = true;
  mcRadio.dispatchEvent(new Event('change'));
  
  // Check that content updated
  const requiredFields = document.getElementById('requiredFields');
  runner.assert(requiredFields.innerHTML.includes('option_a'), 'Should show option_a field for multiple choice');
  
  modal.hide();
  cleanupTestDOM();
});

runner.test('SchemaGuideModal handles copy functionality', async () => {
  setupTestDOM();
  
  const modal = new SchemaGuideModal();
  modal.init();
  modal.show();
  
  const csvExample = document.getElementById('csvExample');
  runner.assert(csvExample, 'Should have CSV example element');
  runner.assert(csvExample.textContent.length > 0, 'CSV example should have content');
  
  const jsonExample = document.getElementById('jsonExample');
  runner.assert(jsonExample, 'Should have JSON example element');
  runner.assert(jsonExample.textContent.length > 0, 'JSON example should have content');
  
  modal.hide();
  cleanupTestDOM();
});

// Export test runner for use in browser console or other test environments
if (typeof window !== 'undefined') {
  window.SchemaGuideTests = {
    run: () => runner.run(),
    runner: runner
  };
}

export { runner as default };