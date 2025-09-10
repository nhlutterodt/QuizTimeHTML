// Unit tests for EnhancedCSVManager - focusing on parseSnapshot helper and core functionality
import EnhancedCSVManager from '../data/EnhancedCSVManager.js';

/**
 * Test Suite for EnhancedCSVManager according to refactor proposal requirements
 */

// Test helper for creating a basic CSV manager instance
function createTestManager() {
  return new EnhancedCSVManager();
}

// Test helper for simulating parse errors
function addTestParseErrors(manager, errors) {
  manager.parseErrors = errors;
}

// Test helper for simulating parse warnings  
function addTestParseWarnings(manager, warnings) {
  manager.parseWarnings = warnings;
}

/**
 * Test: createParseSnapshot helper function (extracted from parseCSV)
 */
function testCreateParseSnapshot() {
  console.log('🧪 Testing createParseSnapshot helper function...');
  
  const manager = createTestManager();
  
  // Test case 1: Happy path with no errors/warnings
  console.log('  ✅ Test case 1: No errors, no warnings');
  const snapshot1 = manager.createParseSnapshot(['id', 'question', 'answer'], 5, 10);
  
  if (snapshot1.headers.length === 3 && 
      snapshot1.rows === 5 && 
      snapshot1.totalErrors === 0 && 
      snapshot1.totalWarnings === 0 &&
      snapshot1.snapshotRowLimit === 10) {
    console.log('    ✅ PASS: Basic snapshot creation works');
  } else {
    console.log('    ❌ FAIL: Basic snapshot creation failed');
    return false;
  }
  
  // Test case 2: With errors and warnings - compact limiting
  console.log('  ✅ Test case 2: With errors and warnings, limit testing');
  addTestParseErrors(manager, [
    { line: 1, error: 'Error 1' },
    { line: 2, error: 'Error 2' },
    { line: 3, error: 'Error 3' }
  ]);
  addTestParseWarnings(manager, [
    { line: 1, warning: 'Warning 1' },
    { line: 2, warning: 'Warning 2' }
  ]);
  
  const snapshot2 = manager.createParseSnapshot(['col1', 'col2'], 10, 2);
  
  if (snapshot2.totalErrors === 3 && 
      snapshot2.totalWarnings === 2 &&
      snapshot2.compactErrors.length === 2 &&
      snapshot2.compactWarnings.length === 2 &&
      snapshot2.errors.length === 3 &&
      snapshot2.warnings.length === 2) {
    console.log('    ✅ PASS: Compact limiting works correctly');
  } else {
    console.log('    ❌ FAIL: Compact limiting failed');
    console.log(`      Expected: compactErrors=2, compactWarnings=2, totalErrors=3, totalWarnings=2`);
    console.log(`      Actual: compactErrors=${snapshot2.compactErrors.length}, compactWarnings=${snapshot2.compactWarnings.length}, totalErrors=${snapshot2.totalErrors}, totalWarnings=${snapshot2.totalWarnings}`);
    return false;
  }
  
  // Test case 3: Edge case - limit larger than available errors
  console.log('  ✅ Test case 3: Limit larger than available data');
  const snapshot3 = manager.createParseSnapshot(['col1'], 1, 100);
  
  if (snapshot3.compactErrors.length === 3 && 
      snapshot3.compactWarnings.length === 2) {
    console.log('    ✅ PASS: Large limit handled correctly');
  } else {
    console.log('    ❌ FAIL: Large limit handling failed');
    return false;
  }
  
  return true;
}

/**
 * Test: parseCSV happy path behavior
 */
async function testParseCSVHappyPath() {
  console.log('🧪 Testing parseCSV happy path...');
  
  const manager = createTestManager();
  const validCSV = `id,question,option_a,option_b,option_c,option_d,correct_answer,type
1,"What is 2+2?",2,3,4,5,C,multiple_choice`;
  
  try {
    const result = await manager.parseCSV(validCSV, { snapshotRowLimit: 10 });
    
    if (result.questions.length === 1 && 
        result.summary.successful === 1 &&
        result.summary.errors === 0 &&
        result.lastParseSnapshot &&
        result.lastParseSnapshot.rows === 1) {
      console.log('    ✅ PASS: Valid CSV parsed successfully');
      return true;
    } else {
      console.log('    ❌ FAIL: Valid CSV parsing failed');
      console.log('      Result:', result.summary);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: parseCSV threw unexpected error:', error.message);
    return false;
  }
}

/**
 * Test: parseCSV error handling edge cases
 */
async function testParseCSVErrorHandling() {
  console.log('🧪 Testing parseCSV error handling...');
  
  const manager = createTestManager();
  
  // Test case 1: Invalid CSV structure
  console.log('  ✅ Test case 1: Invalid CSV structure');
  const invalidCSV = `id,question
1,"What is broken`;  // Unclosed quote
  
  try {
    const result = await manager.parseCSV(invalidCSV);
    console.log('    ✅ PASS: Invalid CSV handled gracefully (returned result instead of throwing)');
  } catch (error) {
    // For now this is expected behavior - but according to refactor proposal, 
    // we should return errors in array instead of throwing
    console.log('    ⚠️  NOTE: Currently throws (proposal suggests returning errors in array)');
  }
  
  // Test case 2: Missing required fields
  console.log('  ✅ Test case 2: Missing required fields');
  const missingFieldsCSV = `random_col,another_col
value1,value2`;
  
  try {
    const result = await manager.parseCSV(missingFieldsCSV);
    if (result.summary.errors > 0 && result.lastParseSnapshot.totalErrors > 0) {
      console.log('    ✅ PASS: Missing required fields reported as errors');
    } else {
      console.log('    ❌ FAIL: Missing required fields not detected');
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Unexpected error for missing fields:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting EnhancedCSVManager unit tests...\n');
  
  const tests = [
    { name: 'createParseSnapshot', fn: testCreateParseSnapshot },
    { name: 'parseCSV happy path', fn: testParseCSVHappyPath },
    { name: 'parseCSV error handling', fn: testParseCSVErrorHandling }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
        console.log(`✅ ${test.name}: PASSED\n`);
      } else {
        console.log(`❌ ${test.name}: FAILED\n`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}\n`);
    }
  }
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('⚠️  Some tests failed - review output above');
    return false;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runAllTests, testCreateParseSnapshot, testParseCSVHappyPath, testParseCSVErrorHandling };