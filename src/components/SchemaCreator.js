import { DOMHelpers } from '../utils/DOMHelpers.js';
import QuestionSchema from '../models/QuestionSchema.js';
import EnhancedCSVManager from '../data/EnhancedCSVManager.js';

export class SchemaCreator {
  constructor(container = document.body) {
    this.container = container || document.body;
    this.id = 'schemaCreatorModal';
    this._render();
  }

  _render() {
    if (DOMHelpers.getElementById(this.id)) return;

  const el = DOMHelpers.createElement('div', {
      id: this.id,
      className: 'schema-guide-modal schema-creator open',
      innerHTML: `
        <div class="schema-guide-backdrop"></div>
        <div class="schema-guide-content" role="dialog" aria-modal="true">
          <header class="schema-header header-row">
            <h3>Create CSV Schema</h3>
            <div style="margin-left:auto;display:flex;gap:8px">
              <select id="schemaPresetSelect" class="small">
                <option value="auto">Auto</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
                <option value="true_false">True/False</option>
                <option value="numeric">Numeric</option>
              </select>
              <button id="schemaCreatorClose" class="btn btn-link">Close</button>
            </div>
          </header>
          <section class="schema-guide-body">
            <p class="small">Paste a CSV header row or a small CSV sample. The tool will extract headers and let you map them to canonical fields.</p>
            <textarea id="schemaSampleInput" rows="6" style="width:100%" placeholder="id,question,option_a,option_b,correct_answer\n1,What is 2+2?,1,2,D"></textarea>

            <div class="mapping-actions">
              <button id="schemaExtractHeadersBtn" class="btn btn-primary">Extract headers</button>
              <button id="schemaValidateWithMapBtn" class="btn btn-secondary">Validate sample</button>
              <button id="schemaExportMapBtn" class="btn btn-outline">Export headersMap</button>
            </div>

            <div id="schemaMappingContainer" style="margin-top:10px"></div>

            <div id="schemaCreatorResult" style="margin-top:12px"></div>
          </section>
        </div>
      `
    });

    this.container.appendChild(el);

    // wire buttons
    const extractBtn = DOMHelpers.getElementById('schemaExtractHeadersBtn');
    const validateBtn = DOMHelpers.getElementById('schemaValidateWithMapBtn');
    const exportBtn = DOMHelpers.getElementById('schemaExportMapBtn');
    const closeBtn = DOMHelpers.getElementById('schemaCreatorClose');

    extractBtn?.addEventListener('click', () => this._extractHeaders());
    validateBtn?.addEventListener('click', () => this._validateWithMap());
    exportBtn?.addEventListener('click', () => this._exportMap());
    closeBtn?.addEventListener('click', () => this.hide());
  }

  _extractHeaders() {
    const txt = DOMHelpers.getElementById('schemaSampleInput').value || '';
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Please paste a CSV header row or sample first.');
      return;
    }

    const headerLine = lines[0];
    // simple split respecting quotes is handled by EnhancedCSVManager parseCSVLine but avoid dependency here
  const headers = headerLine.split(',').map(h => h.replace(/(^")|("$)/g, '').trim());

    this._renderMappingTable(headers);
  }

  _renderMappingTable(headers) {
    const mappingContainer = DOMHelpers.getElementById('schemaMappingContainer');
    const canonFields = Object.keys(QuestionSchema.CORE_SCHEMA);

    let html = '<table class="mapping-table"><thead><tr><th>CSV Header</th><th>Map to field</th></tr></thead><tbody>';
    headers.forEach((h, idx) => {
      html += `<tr><td>${DOMHelpers.escapeHtml(h)}</td><td>`;
      html += `<select data-header-index="${idx}">`;
      html += `<option value="__ignore__">-- ignore --</option>`;
      html += `<option value="__custom__">-- custom (keep as-is) --</option>`;
      canonFields.forEach(cf => {
        html += `<option value="${cf}">${cf}</option>`;
      });
      html += `</select>`;
      html += '</td></tr>';
    });
    html += '</tbody></table>';

    mappingContainer.innerHTML = html;
  }

  _buildHeadersMap() {
    const selects = Array.from(this.container.querySelectorAll(`#${this.id} select[data-header-index]`));
    const map = {};
    selects.forEach(s => {
      const headerText = s.parentElement.parentElement.querySelector('td').textContent.trim();
      const val = s.value;
      if (val === '__ignore__') return;
      if (val === '__custom__') {
        map[headerText] = headerText;
      } else {
        map[headerText] = val;
      }
    });
    return map;
  }

  async _validateWithMap() {
    const txt = DOMHelpers.getElementById('schemaSampleInput').value || '';
    if (!txt.trim()) { alert('Paste a CSV sample first.'); return; }
    const headersMap = this._buildHeadersMap();
    const preset = DOMHelpers.getElementById('schemaPresetSelect')?.value || 'auto';

    try {
      const mgr = new EnhancedCSVManager();
      const parse = await mgr.parseCSV(txt, { headersMap, preset, snapshotRowLimit: 20 });
      const compact = mgr.getLastParseSnapshotCompact(10);
      const resultEl = DOMHelpers.getElementById('schemaCreatorResult');
      let html = `<div class="validator-result ok">Parsed ${parse.summary.total} rows, ${parse.summary.successful} successful, ${parse.summary.errors} errors, ${parse.summary.warnings} warnings.</div>`;
      if (compact?.compactErrors?.length) {
        html += '<h4>Errors</h4><ul>' + compact.compactErrors.map(e => `<li>Line ${e.line}: ${DOMHelpers.escapeHtml(e.error)}</li>`).join('') + '</ul>';
      }
      if (compact?.compactWarnings?.length) {
        html += '<h4>Warnings</h4><ul>' + compact.compactWarnings.map(w => `<li>Line ${w.line}: ${DOMHelpers.escapeHtml(w.warning)}</li>`).join('') + '</ul>';
      }
      resultEl.innerHTML = html;
    } catch (err) {
      DOMHelpers.getElementById('schemaCreatorResult').innerHTML = `<div class="validator-result err">Validation failed: ${DOMHelpers.escapeHtml(err.message || err)}</div>`;
    }
  }

  _exportMap() {
    const map = this._buildHeadersMap();
    if (!map || Object.keys(map).length === 0) { alert('No mappings defined. Extract headers and set mapping first.'); return; }
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `headers-map-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  show() {
    const modal = DOMHelpers.getElementById(this.id);
    if (!modal) return;
    modal.classList.add('open');
  }

  hide() {
    const modal = DOMHelpers.getElementById(this.id);
    if (!modal) return;
    modal.classList.remove('open');
    // remove from DOM
    setTimeout(() => this.destroy(), 220);
  }

  destroy() {
    const modal = DOMHelpers.getElementById(this.id);
  modal?.parentNode?.removeChild(modal);
  }
}

export default SchemaCreator;
