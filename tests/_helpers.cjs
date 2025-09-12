// Shared helpers for uploadProcessor tests
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

function parseCSVContent(text){
  const lines = String(text).split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return { headers:[], rows:[] };
  const headers = lines[0].split(',').map(h=>h.trim().replace(/(^"+|"+$)/g,''));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',').map(c=>c.replace(/(^"+|"+$)/g,''));
    if(cols.length===headers.length){ const obj={}; headers.forEach((h,idx)=>obj[h]=cols[idx]); rows.push(obj); }
    else { rows.push({ __malformed: true, raw: lines[i] }); }
  }
  return { headers, rows };
}

function convertToQuestionFormat(row, uploadId, rowIndex, filename){
  return { id:null, question: row.question || row.q || row.Question || '', option_a: row.option_a||row.OptA||'', correct_answer: row.correct_answer||'', source:{ uploadId, filename, rowIndex } };
}

// Test filesystem helpers
async function ensureUploadsDir(){
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  try { await fsp.mkdir(uploadsDir, { recursive: true }); } catch(e){ /* ignore */ }
  return uploadsDir;
}

async function writeTempCSV(filename, content){
  const uploadsDir = await ensureUploadsDir();
  const tmpPath = path.join(uploadsDir, filename);
  await fsp.writeFile(tmpPath, content, 'utf8');
  return tmpPath;
}

async function cleanupTemp(...paths){
  for(const p of paths){
    if(!p) continue;
    try { await fsp.unlink(p); } catch(e) { /* ignore */ }
  }
}

function makeFileObject(filePath, originalname, content){
  const size = typeof content === 'string' ? Buffer.byteLength(content) : (content?.length || 0);
  return { originalname: originalname || path.basename(filePath), path: filePath, size };
}

module.exports = { parseCSVContent, convertToQuestionFormat, ensureUploadsDir, writeTempCSV, cleanupTemp, makeFileObject };
