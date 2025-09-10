// Unit tests for CSVImportFacade - centralized CSV import functionality
import CSVImportFacade from '../services/CSVImportFacade.js';

/**
 * Test Suite for CSVImportFacade according to refactor proposal requirements
 */

/**
 * Test: CSV import facade basic functionality
 */
async function testCSVImportFacadeBasics() {
  console.log('🧪 Testing CSVImportFacade basic functionality...');
  
  const facade = new CSVImportFacade();
  
  // Test case 1: Valid CSV import
  console.log('  ✅ Test case 1: Valid CSV import');
  const validCSV = `id,question,option_a,option_b,option_c,option_d,correct_answer,type
1,"What is 2+2?",2,3,4,5,C,multiple_choice
2,"What is 3+3?",4,5,6,7,C,multiple_choice`;
  
  try {
    const result = await facade.importCSV(validCSV, {
      mergeStrategy: 'skip',
      uploadId: 'test-123',
      filename: 'test.csv'
    });
    
    if (result.success && 
        result.summary.added >= 1 && 
        result.uploadMetadata &&
        result.uploadMetadata.uploadId === 'test-123') {
      console.log('    ✅ PASS: Valid CSV imported successfully with metadata');
    } else {
      console.log('    ❌ FAIL: Valid CSV import failed');
      console.log('      Result:', result);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Unexpected error during valid CSV import:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Test: CSV validation functionality
 */
async function testCSVValidation() {
  console.log('🧪 Testing CSV validation functionality...');
  
  const facade = new CSVImportFacade();
  
  // Test case 1: Valid CSV validation
  console.log('  ✅ Test case 1: Valid CSV validation');
  const validCSV = `id,question,option_a,option_b,option_c,option_d,correct_answer,type
1,"What is 2+2?",2,3,4,5,C,multiple_choice`;
  
  try {
    const result = await facade.validateCSV(validCSV);
    
    if (result.summary.total >= 1 && result.parseSnapshot) {
      console.log('    ✅ PASS: Valid CSV validated successfully');
    } else {
      console.log('    ❌ FAIL: Valid CSV validation failed');
      console.log('      Result:', result);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Unexpected error during CSV validation:', error.message);
    return false;
  }
  
  // Test case 2: Invalid CSV validation  
  console.log('  ✅ Test case 2: Invalid CSV validation');
  const invalidCSV = `bad_header,another_bad
value1,value2`;
  
  try {
    const result = await facade.validateCSV(invalidCSV);
    
    if (!result.isValid && result.errors.length > 0) {
      console.log('    ✅ PASS: Invalid CSV properly detected');
    } else {
      console.log('    ❌ FAIL: Invalid CSV not detected');
      console.log('      Result:', result);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Unexpected error during invalid CSV validation:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Test: Error handling - facade should return errors not throw them
 */
async function testErrorHandling() {
  console.log('🧪 Testing error handling (should return errors, not throw)...');
  
  const facade = new CSVImportFacade();
  
  // Test case 1: Malformed CSV content
  console.log('  ✅ Test case 1: Malformed CSV content');
  const malformedCSV = null; // This should cause an error
  
  try {
    const result = await facade.importCSV(malformedCSV);
    
    if (!result.success && result.errors.length > 0) {
      console.log('    ✅ PASS: Malformed CSV returned error result instead of throwing');
    } else {
      console.log('    ❌ FAIL: Malformed CSV did not return proper error result');
      console.log('      Result:', result);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Facade threw error instead of returning error result:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Test: Legacy compatibility methods
 */
function testLegacyCompatibility() {
  console.log('🧪 Testing legacy compatibility methods...');
  
  const facade = new CSVImportFacade();
  
  // Test case 1: Legacy CSV parsing
  console.log('  ✅ Test case 1: Legacy parseCSVContentLegacy');
  const csvText = `id,question,answer\n1,"What is test?",Yes`;
  
  try {
    const result = facade.parseCSVContentLegacy(csvText);
    
    if (result.headers.length === 3 && 
        result.rows.length === 1 &&
        result.rows[0].id === '1') {
      console.log('    ✅ PASS: Legacy CSV parsing works');
    } else {
      console.log('    ❌ FAIL: Legacy CSV parsing failed');
      console.log('      Result:', result);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Legacy CSV parsing threw error:', error.message);
    return false;
  }
  
  // Test case 2: Manager instances accessible
  console.log('  ✅ Test case 2: Manager instances accessible');
  const questionManager = facade.getQuestionManager();
  const csvManager = facade.getCSVManager();
  
  if (questionManager && csvManager) {
    console.log('    ✅ PASS: Manager instances accessible');
  } else {
    console.log('    ❌ FAIL: Manager instances not accessible');
    return false;
  }
  
  return true;
}

/**
 * Test: Export parse report functionality
 */
async function testExportParseReport() {
  console.log('🧪 Testing export parse report functionality...');
  
  const facade = new CSVImportFacade();
  
  // First import something to have data to export
  const csvData = `id,question,option_a,option_b,option_c,option_d,correct_answer,type
1,"Test question?",A,B,C,D,A,multiple_choice`;
  
  try {
    await facade.importCSV(csvData);
    
    const exportResult = await facade.exportLastParseReport();
    
    if (exportResult && 
        (exportResult.type === 'server' || exportResult.type === 'browser') &&
        exportResult.filename) {
      console.log('    ✅ PASS: Export parse report works');
      return true;
    } else {
      console.log('    ❌ FAIL: Export parse report failed');
      console.log('      Result:', exportResult);
      return false;
    }
  } catch (error) {
    console.log('    ❌ FAIL: Export parse report error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting CSVImportFacade unit tests...\n');
  
  const tests = [
    { name: 'CSV import facade basics', fn: testCSVImportFacadeBasics },
    { name: 'CSV validation', fn: testCSVValidation },
    { name: 'Error handling', fn: testErrorHandling },
    { name: 'Legacy compatibility', fn: testLegacyCompatibility },
    { name: 'Export parse report', fn: testExportParseReport }
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

export { runAllTests };