// Script for question-bank-test.html - extracted from inline script
async function migrateExisting() {
  const resultDiv = document.getElementById('migrationResult');
  resultDiv.textContent = 'Migrating...';
  try {
    const response = await fetch('/api/migrate-existing-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    resultDiv.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  }
}

async function getStats() {
  const resultDiv = document.getElementById('statsResult');
  resultDiv.textContent = 'Loading...';
  try {
    const response = await fetch('/api/question-bank/stats');
    const result = await response.json();
    resultDiv.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  }
}

async function uploadCSVs() {
  const resultDiv = document.getElementById('uploadResult');
  const fileInput = document.getElementById('csvFiles');
  const mergeStrategy = document.getElementById('mergeStrategy').value;
  if (!fileInput.files.length) { resultDiv.textContent = 'Please select CSV files to upload'; return; }
  resultDiv.textContent = 'Uploading...';
  try {
    const formData = new FormData();
    for (const file of fileInput.files) formData.append('files', file);
    formData.append('options', JSON.stringify({ mergeStrategy: mergeStrategy, strictness: 'lenient', owner: 'test-user' }));
    const response = await fetch('/api/upload-csvs', { method: 'POST', body: formData });
    const result = await response.json();
    resultDiv.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  }
}

async function exportJSON() {
  const resultDiv = document.getElementById('exportResult');
  resultDiv.textContent = 'Exporting...';
  try {
    const response = await fetch('/api/question-bank/export?format=json');
    const result = await response.json();
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_bank.json';
    a.click();
    URL.revokeObjectURL(url);
    resultDiv.textContent = 'JSON export downloaded!';
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  }
}

async function exportCSV() {
  const resultDiv = document.getElementById('exportResult');
  resultDiv.textContent = 'Exporting...';
  try {
    const response = await fetch('/api/question-bank/export?format=csv');
    const csvData = await response.text();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_bank.csv';
    a.click();
    URL.revokeObjectURL(url);
    resultDiv.textContent = 'CSV export downloaded!';
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  }
}

// Wire buttons on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const migrateBtn = document.getElementById('migrateBtn');
  const statsBtn = document.getElementById('statsBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  if (migrateBtn) migrateBtn.addEventListener('click', migrateExisting);
  if (statsBtn) statsBtn.addEventListener('click', getStats);
  if (uploadBtn) uploadBtn.addEventListener('click', uploadCSVs);
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
});

export default {};
