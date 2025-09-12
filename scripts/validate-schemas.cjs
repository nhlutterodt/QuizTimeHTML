// Lightweight schema validation script
// Validates example request/response JSON files in docs/schemas/examples

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, strict: false });

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

(async function main(){
  try {
    const root = path.join(__dirname, '..', 'docs', 'schemas');
    const reqSchemaPath = path.join(root, 'upload-request.json');
    const resSchemaPath = path.join(root, 'upload-response.json');

    const reqSchema = loadJSON(reqSchemaPath);
    const resSchema = loadJSON(resSchemaPath);

    ajv.addSchema(reqSchema, 'upload-request');
    ajv.addSchema(resSchema, 'upload-response');

    const examplesDir = path.join(root, 'examples');
    const examples = fs.readdirSync(examplesDir).filter(f => f.endsWith('.json'));

    let failed = false;

    for (const ex of examples) {
      const p = path.join(examplesDir, ex);
      const data = loadJSON(p);

      if (ex.startsWith('request')) {
        const valid = ajv.validate('upload-request', data);
        if (!valid) {
          console.error(`Example ${ex} failed validation:`, ajv.errors);
          failed = true;
        } else {
          console.log(`Example ${ex} OK`);
        }
      } else if (ex.startsWith('response')) {
        const valid = ajv.validate('upload-response', data);
        if (!valid) {
          console.error(`Example ${ex} failed validation:`, ajv.errors);
          failed = true;
        } else {
          console.log(`Example ${ex} OK`);
        }
      } else {
        console.warn('Skipping unknown example:', ex);
      }
    }

    process.exit(failed ? 2 : 0);
  } catch (err) {
    console.error('Schema validation failed with error:', err);
    process.exit(3);
  }
})();
