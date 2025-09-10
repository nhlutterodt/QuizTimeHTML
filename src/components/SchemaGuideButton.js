// Schema Guide Button Component
// Small button control that opens the schema guide modal

import { EventManager } from '../utils/EventManager.js';

export class SchemaGuideButton {
  constructor(container) {
    this.container = container;
    this.eventManager = new EventManager();
    this.isRendered = false;
  }

  /**
   * Render the schema guide button
   */
  render() {
    if (this.isRendered) return;

    const buttonHTML = `
      <button type="button" id="schemaGuideBtn" class="btn btn-info schema-guide-button" 
              title="View CSV schema guide and examples">
        <span class="btn-icon">📋</span>
        <span class="btn-text">Schema Guide</span>
      </button>
    `;

    this.container.insertAdjacentHTML('beforeend', buttonHTML);
    this.attachEventListeners();
    this.isRendered = true;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const button = document.getElementById('schemaGuideBtn');
    if (button) {
      this.eventManager.on(button, 'click', () => {
        this.handleClick();
      });

      // Keyboard accessibility
      this.eventManager.on(button, 'keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.handleClick();
        }
      });
    }
  }

  /**
   * Handle button click
   */
  handleClick() {
    // Dispatch custom event to open the schema guide modal
    const event = new CustomEvent('schema-guide:open', {
      bubbles: true,
      detail: { source: 'schema-guide-button' }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Remove the button
   */
  remove() {
    const button = document.getElementById('schemaGuideBtn');
    if (button) {
      this.eventManager.removeAllListeners();
      button.remove();
      this.isRendered = false;
    }
  }

  /**
   * Show/hide the button
   */
  setVisible(visible) {
    const button = document.getElementById('schemaGuideBtn');
    if (button) {
      button.style.display = visible ? 'inline-flex' : 'none';
    }
  }
}

export default SchemaGuideButton;