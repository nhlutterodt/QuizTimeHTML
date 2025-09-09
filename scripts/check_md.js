const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'docs', 'INTELLIGENT_QUESTION_SUPPLEMENTATION_PLAN.md');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.replace(/\r\n/g,'\n').split('\n');

const issues = [];
const headings = {};

for (let i=0;i<lines.length;i++){
  const line = lines[i];
  const h = line.match(/^(#{1,6})\s+(.*)$/);
  if(h){
    const level = h[1].length;
    let text = h[2].trim();
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    headings[key] = headings[key] || [];
    headings[key].push({line:i+1, level, text});

    // blank line before? (except first line)
    if(i>0){
      const prev = lines[i-1];
      if(prev.trim() !== ''){
        issues.push({line:i+1, code:'MD022', msg:'Heading not surrounded by blank line before'});
      }
    }
    // blank line after?
    if(i < lines.length-1){
      const next = lines[i+1];
      if(next.trim() !== ''){
        issues.push({line:i+1, code:'MD032', msg:'Heading not followed by blank line'});
      }
    }
    // trailing punctuation
  if(/[.!?:]$/.test(text)){
      issues.push({line:i+1, code:'MD026', msg:'Heading has trailing punctuation'});
    }
  }

  // unordered list indent check
  const ul = line.match(/^([ \t]*)([-*+])\s+/);
  if(ul){
    const indent = ul[1].replace(/\t/g,'  ').length;
    if(indent % 2 !== 0){
      issues.push({line:i+1, code:'MD007', msg:'Unordered list indentation not a multiple of 2 spaces'});
    }
  }
}

// duplicate headings
for(const k of Object.keys(headings)){
  if(headings[k].length > 1){
    issues.push({line:headings[k][0].line, code:'MD024', msg:`Duplicate heading text ("${headings[k][0].text}") found ${headings[k].length} times`} );
  }
}

if(issues.length === 0){
  console.log('OK: No issues found by lightweight checker.');
  process.exit(0);
}

console.log('Found issues:');
issues.forEach(it=>{
  console.log(`${it.code} (line ${it.line}): ${it.msg}`);
});
process.exit(2);
