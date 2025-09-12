// Static Schema Guide Modal - shows required CSV schema fields and examples
import { DOMHelpers } from '../utils/DOMHelpers.js';
import EnhancedCSVManager from '../data/EnhancedCSVManager.js';
import QuestionSchema from '../models/QuestionSchema.js';

export class SchemaGuideModal {
  constructor(container = document.body) {
    this.container = container || document.body;
    this.modalId = 'schemaGuideModal';
    this._render();
  }

  _render() {
    // Avoid re-creating if already present
    if (DOMHelpers.getElementById(this.modalId)) return;

  const modal = DOMHelpers.createElement('div', {
      id: this.modalId,
      className: 'schema-guide-modal',
      innerHTML: `
    <div class="schema-guide-backdrop"></div>
    <div class="schema-guide-content" role="dialog" aria-modal="true">
          <header class="schema-guide-header">
            <h2>CSV Schema Guide</h2>
            <div style="display:flex;gap:8px;align-items:center">
              <button id="exportSchemaJsonBtn" class="btn btn-primary">Export schema JSON</button>
              <button id="schemaToggleCanonBtn" class="btn btn-secondary">Hide canonical</button>
              <button id="schemaGuideCloseBtn" class="btn btn-link">Close</button>
            </div>
          </header>
          <section class="schema-guide-body">
            <p>This guide describes the canonical CSV fields our importer understands. Fields are case-insensitive but it's recommended to use the examples below.</p>
            <h3>Core fields (recommended)</h3>
            <ul>
              <li><strong>id</strong> - optional numeric or string identifier (will be generated if missing)</li>
              <li><strong>question</strong> - required text for the question prompt</li>
              <li><strong>type</strong> - question type: <code>multiple_choice</code>, <code>true_false</code>, <code>short_answer</code></li>
              <li><strong>option_a</strong>, <strong>option_b</strong>, ... - answer choices for multiple choice</li>
              <li><strong>correct_answer</strong> - letter (A/B/C) or answer text or index (1-based)</li>
              <li><strong>category</strong> - optional category string</li>
              <li><strong>difficulty</strong> - Easy, Medium, Hard, Expert (or numeric levels)</li>
            </ul>
            <h3>Metadata & analytics (optional)</h3>
            <ul>
              <li><strong>points</strong> - numeric score value</li>
              <li><strong>time_limit</strong> - seconds allowed for the question</li>
              <li><strong>explanation</strong> - post-question explanation text</li>
              <li><strong>tags</strong> - comma-separated tags</li>
            </ul>
            <h3>Custom fields</h3>
            <p>Any additional columns not part of the core schema are preserved as <code>custom_fields</code> on each question object.</p>
            <h3>Example</h3>
            <pre>
id,question,type,option_a,option_b,option_c,option_d,correct_answer,category,difficulty,points
1,"What is 2+2?",multiple_choice,1,2,3,4,D,Math,Easy,1
            </pre>
            <p>Use <em>header mapping</em> (in advanced upload settings) to map non-standard header names to the canonical ones.</p>

            <h3>Canonical Schema (live)</h3>
            <div id="schemaCanonicalContainer">Loading canonical schema...</div>


            <hr/>
            <h3>Quick CSV Snippet Validator</h3>
            <p>Paste a small CSV snippet below to validate rows client-side (no network calls).</p>
            <textarea id="schemaValidatorSnippet" rows="8" style="width:100%" placeholder="id,question,option_a,option_b,correct_answer\n..."></textarea>
            <div style="margin-top:8px">
              <button id="schemaValidateBtn" class="btn btn-primary">Validate</button>
              <button id="schemaClearBtn" class="btn btn-link">Clear</button>
            </div>
            <div id="schemaValidationResult" style="margin-top:10px"></div>
          </section>
        </div>
      `
    });

    this.container.appendChild(modal);

    // Wire close button and validator controls
    const closeBtn = DOMHelpers.getElementById('schemaGuideCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Render canonical schema from QuestionSchema (safe single source of truth)
    try {
      const canonEl = DOMHelpers.getElementById('schemaCanonicalContainer');
      if (canonEl) {
        const core = QuestionSchema.CORE_SCHEMA;
        const mapping = QuestionSchema.CSV_FIELD_MAPPING;

        let html = '<h4>Core fields</h4><table class="schema-table" style="width:100%;border-collapse:collapse">';
        html += '<thead><tr><th style="text-align:left">Field</th><th style="text-align:left">Type</th><th style="text-align:left">Required</th><th style="text-align:left">Description</th></tr></thead><tbody>';
        Object.entries(core).forEach(([field, def]) => {
          const type = def.type || '';
          const required = def.required ? 'yes' : 'no';
          const desc = def.description ? DOMHelpers.escapeHtml(def.description) : '';
          html += `<tr><td style="padding:4px;border-top:1px solid #eee">${field}</td><td style="padding:4px;border-top:1px solid #eee">${type}</td><td style="padding:4px;border-top:1px solid #eee">${required}</td><td style="padding:4px;border-top:1px solid #eee">${desc}</td></tr>`;
        });
        html += '</tbody></table>';

        html += '<h4 style="margin-top:12px">CSV Header Mappings</h4><div class="mapping-list">';
        Object.entries(mapping).forEach(([canon, variants]) => {
          html += `<div style="margin-bottom:6px"><strong>${canon}</strong>: <code>${variants.join(', ')}</code></div>`;
        });
        html += '</div>';

        canonEl.innerHTML = html;
      }
    } catch (e) {
      console.warn('Failed to render canonical schema in modal:', e);
    }

    // Validator controls
    const validateBtn = DOMHelpers.getElementById('schemaValidateBtn');
    const clearBtn = DOMHelpers.getElementById('schemaClearBtn');
    const snippetEl = DOMHelpers.getElementById('schemaValidatorSnippet');
    const resultEl = DOMHelpers.getElementById('schemaValidationResult');

    // Export & toggle controls
    const exportBtn = DOMHelpers.getElementById('exportSchemaJsonBtn');
    const toggleCanonBtn = DOMHelpers.getElementById('schemaToggleCanonBtn');
    const canonicalContainer = DOMHelpers.getElementById('schemaCanonicalContainer');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          const payload = {
            timestamp: new Date().toISOString(),
            schema: QuestionSchema.CORE_SCHEMA,
            mapping: QuestionSchema.CSV_FIELD_MAPPING
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `question-schema-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
          console.error('Export schema failed', err);
          alert('Failed to export schema: ' + (err.message || err));
        }
      });
    }

    if (toggleCanonBtn && canonicalContainer) {
      let shown = true;
      toggleCanonBtn.addEventListener('click', () => {
        shown = !shown;
        if (!shown) {
          canonicalContainer.classList.add('canon-hidden');
          toggleCanonBtn.textContent = 'Show canonical';
        } else {
          canonicalContainer.classList.remove('canon-hidden');
          toggleCanonBtn.textContent = 'Hide canonical';
        }
      });
    }

    if (validateBtn && snippetEl && resultEl) {
      validateBtn.addEventListener('click', async () => {
        try {
          validateBtn.disabled = true;
          resultEl.innerHTML = 'Validating...';

          const csv = snippetEl.value || '';
          if (!csv.trim()) {
            resultEl.innerHTML = '<div class="warning">Please paste a CSV snippet to validate.</div>';
            return;
          }

          // Use EnhancedCSVManager client-side parser
          const mgr = new EnhancedCSVManager();
          const parse = await mgr.parseCSV(csv, { snapshotRowLimit: 20 });

          const compact = mgr.getLastParseSnapshotCompact(10);
          let html = `<div class="success">Parsed ${parse.summary.total} rows, ${parse.summary.successful} successful, ${parse.summary.errors} errors, ${parse.summary.warnings} warnings.</div>`;
          if (compact?.compactErrors?.length > 0) {
            html += '<h4>Errors (first few)</h4><ul>' + compact.compactErrors.map(e => `<li>Line ${e.line}: ${e.error}</li>`).join('') + '</ul>';
          }
          if (compact?.compactWarnings?.length > 0) {
            html += '<h4>Warnings (first few)</h4><ul>' + compact.compactWarnings.map(w => `<li>Line ${w.line}: ${w.warning}</li>`).join('') + '</ul>';
          }

          resultEl.innerHTML = html;
        } catch (err) {
          console.error('Validator failed:', err);
          resultEl.innerHTML = `<div class="error">Validation failed: ${err.message || err}</div>`;
        } finally {
          validateBtn.disabled = false;
        }
      });
    }

    if (clearBtn && snippetEl && resultEl) {
      clearBtn.addEventListener('click', () => {
        snippetEl.value = '';
        resultEl.innerHTML = '';
      });
    }
  }

  show() {
    const modal = DOMHelpers.getElementById(this.modalId);
    if (!modal) return;
  modal.classList.add('open');
  }

  hide() {
    const modal = DOMHelpers.getElementById(this.modalId);
    if (!modal) return;
  modal.classList.remove('open');
  }

  destroy() {
    const modal = DOMHelpers.getElementById(this.modalId);
  modal?.parentNode?.removeChild(modal);
  }
}

export default SchemaGuideModal;
