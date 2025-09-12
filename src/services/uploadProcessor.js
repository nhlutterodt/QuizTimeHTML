import fs from 'fs/promises';
import path from 'path';

/**
 * Apply a headersMap to rows (case-insensitive keys).
 * @param {Array<Object>} rows
 * @param {Object} headersMap
 * @returns {{ headers: string[], rows: Array<Object> }}
 */
function applyHeadersMapToRows(rows, headersMap) {
  if (!headersMap || typeof headersMap !== 'object') return { headers: Object.keys(rows[0] || {}), rows };

  const normMap = {};
  Object.keys(headersMap).forEach(k => {
    normMap[k.toLowerCase()] = headersMap[k];
  });

  const remappedRows = rows.map(row => {
    const newRow = {};
    Object.entries(row).forEach(([k, v]) => {
      const mappedKey = normMap[k.toLowerCase()] || k;
      newRow[mappedKey] = v;
    });
    return newRow;
  });

  const headers = remappedRows.length > 0 ? Object.keys(remappedRows[0]) : [];
  return { headers, rows: remappedRows };
}

/**
 * Compute required headers for a given preset.
 */
function computePresetRequiredHeaders(preset) {
  switch ((preset || '').toLowerCase()) {
    case 'multiple_choice':
      return ['option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
    case 'true_false':
      return ['correct_answer'];
    case 'short_answer':
      return ['correct_answer'];
    case 'numeric':
      return ['correct_answer'];
    default:
      return [];
  }
}

/**
 * Validate headers against required fields.
 */
function validateHeaders(headers, requiredHeaders = [], strictness = 'lenient') {
  const missing = (requiredHeaders || []).filter(h => !headers.some(H => H.toLowerCase() === h.toLowerCase() || H.toLowerCase().includes(h.toLowerCase())));
  return { ok: missing.length === 0, missing };
}

/**
 * Convert a CSV row into question format using a provided converter and validate basic fields.
 */
function convertAndValidateRow(row, convertToQuestionFormat, uploadId, rowIndex, filename) {
  const question = convertToQuestionFormat(row, uploadId, rowIndex, filename);

  if (!question.question || question.question.toString().trim() === '') {
    return { error: new Error('Empty question text') };
  }

  return { question };
}

/**
 * Process a single uploaded file: read, parseCsv (caller provides parser), apply headersMap, validate headers, iterate rows.
 * @param {Object} file - multer file object
 * @param {Object} options
 * @param {String} uploadId
 * @param {Function} parseCSVContent - function(csvText) => { headers, rows }
 * @param {Function} convertToQuestionFormat - function to convert row -> question
 */
async function processFile(file, options, uploadId, parseCSVContent, convertToQuestionFormat) {
  const fileDetail = {
    filename: file.originalname,
    size: file.size,
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    const csvContent = await fs.readFile(file.path, 'utf8');
    const parsed = parseCSVContent(csvContent);

    if (!parsed?.headers || !parsed?.rows) {
      throw new Error('Failed to parse CSV content - invalid format');
    }

    // Apply headersMap if present
    let headers = parsed.headers;
    let rows = parsed.rows;
    if (options.headersMap) {
      const remap = applyHeadersMapToRows(rows, options.headersMap);
      headers = remap.headers;
      rows = remap.rows;
    }

    // Add preset-derived required headers
    const presetRequired = computePresetRequiredHeaders(options.preset);
    const requiredHeaders = ['question', ...presetRequired];

    const hdrCheck = validateHeaders(headers, requiredHeaders, options.strictness);
    if (!hdrCheck.ok) {
      const error = `Missing required headers: ${hdrCheck.missing.join(', ')}`;
      fileDetail.errors.push(error);
      if (options.strictness === 'strict') return fileDetail;
    }

    // Process rows and collect converted question objects
    const parsedQuestions = [];
    for (const [rowIndex, row] of rows.entries()) {
      fileDetail.processed++;

      try {
        const rowResult = convertAndValidateRow(row, convertToQuestionFormat, uploadId, rowIndex, file.originalname);
        if (rowResult.error) {
          throw rowResult.error;
        }

        // collect the converted question object for caller to merge/persist
        parsedQuestions.push(rowResult.question);

      } catch (rowError) {
        const e = `Row ${rowIndex + 1}: ${rowError.message}`;
        fileDetail.errors.push(e);
        if (options.strictness === 'strict') {
          throw new Error(`Strict mode: ${e}`);
        }
      }
    }

    return { fileDetail, parsedQuestions };

  } finally {
    // cleanup temporary upload file
    try {
      await fs.unlink(file.path);
    } catch (e) {
      // Log and continue — do not throw from cleanup
      console.warn('Warning: Failed to clean up uploaded file:', e.message || e);
    }
  }
}

/**
 * Orchestrate upload across multiple files: calls processFile, applies mergeStrategy, persists question bank.
 * The persistence/merge logic is intentionally left to the caller so this module stays focused and testable.
 */
async function orchestrateUpload(files, options, context) {
  // context must provide: parseCSVContent, convertToQuestionFormat, questionBank (mutable), saveQuestionBank, createBackup
  const { parseCSVContent, convertToQuestionFormat, questionBank, saveQuestionBank, createBackup } = context;

  const uploadId = (options.uploadId) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  if (options.mergeStrategy === 'overwrite') {
    if (typeof createBackup === 'function') await createBackup();
  }

  const uploadSummary = { processed: 0, added: 0, updated: 0, skipped: 0, errors: [] };
  const detailsPerFile = [];

  // helper: process parsed questions for a single file and update questionBank and fileDetail
  function handleQuestion(newQuestion, fileDetail) {
    // Auto-generate ID if missing
    if (!newQuestion.id) {
      const maxId = Math.max(0, ...questionBank.questions.map(q => q.id || 0));
      newQuestion.id = maxId + 1;
    }

    const duplicate = (typeof context.findDuplicate === 'function') ? context.findDuplicate(newQuestion, questionBank.questions) : null;

    if (!duplicate) {
      questionBank.questions.push(newQuestion);
      fileDetail.added++;
      return;
    }

    const result = (typeof context.applyMergeStrategy === 'function') ? context.applyMergeStrategy(newQuestion, duplicate.question, options.mergeStrategy) : null;

    if (result === null) {
      fileDetail.skipped++;
      return;
    }

    if (options.mergeStrategy === 'force') {
      questionBank.questions.push(result);
      fileDetail.added++;
      return;
    }

    // Update existing
    const existingIndex = questionBank.questions.findIndex(q => q.id === duplicate.question.id);
    questionBank.questions[existingIndex] = result;
    fileDetail.updated++;
  }

  function processParsedQuestions(parsedQuestions, fileDetail) {
    for (const newQuestion of parsedQuestions) {
      handleQuestion(newQuestion, fileDetail);
    }
  }

  for (const file of files) {
    const { fileDetail, parsedQuestions } = await processFile(file, options, uploadId, parseCSVContent, convertToQuestionFormat);

    processParsedQuestions(parsedQuestions, fileDetail);

    // Merge file-level counts
    uploadSummary.processed += fileDetail.processed;
    uploadSummary.added += fileDetail.added;
    uploadSummary.updated += fileDetail.updated;
    uploadSummary.skipped += fileDetail.skipped;
    uploadSummary.errors.push(...fileDetail.errors);
    detailsPerFile.push(fileDetail);
  }

  // Persist an upload record attached to questionBank if provided
  if (questionBank && Array.isArray(questionBank.uploads)) {
    questionBank.uploads.push({ uploadId, timestamp: new Date().toISOString(), options, summary: uploadSummary, detailsPerFile });
  }

  if (typeof saveQuestionBank === 'function') {
    await saveQuestionBank();
  }

  return { uploadId, summary: uploadSummary, detailsPerFile };
}

// Provide mapParsedResult helper
function mapParsedResult(parseResult, options = {}) {
  if (!parseResult) return { headers: [], rows: [], presetRequired: [] };

  let { headers = [], rows = [] } = parseResult;

  // Apply headersMap if present
  if (options.headersMap && typeof options.headersMap === 'object') {
    const mapped = applyHeadersMapToRows(rows, options.headersMap);
    rows = mapped.rows;
    headers = mapped.headers;
  }

  const presetRequired = computePresetRequiredHeaders(options.preset || null);

  return { headers, rows, presetRequired };
}

export {
  applyHeadersMapToRows,
  computePresetRequiredHeaders,
  validateHeaders,
  convertAndValidateRow,
  processFile,
  orchestrateUpload,
  mapParsedResult
};
