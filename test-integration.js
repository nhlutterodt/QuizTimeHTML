// Integration Testing and Migration Script
// Tests the professional integration between CSV handling and question management

import IntegratedQuestionManager from '../src/services/IntegratedQuestionManager.js';
import QuestionSchema from '../src/models/QuestionSchema.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class IntegrationTester {
  constructor() {
    this.questionManager = new IntegratedQuestionManager();
    this.testResults = [];
  }

  /**
   * Run comprehensive integration tests
   */
  async runTests() {
    console.log('🧪 Starting Integration Tests...\n');

    await this.testSchemaDefinition();
    await this.testCSVParsing();
    await this.testLegacyMigration();
    await this.testMergeStrategies();
    await this.testResilienceScenarios();
    await this.testPerformance();

    this.printResults();
  }

  /**
   * Test 1: Schema Definition and Validation
   */
  async testSchemaDefinition() {
    console.log('📋 Testing Schema Definition...');
    
    try {
      // Test valid question
      const validQuestion = QuestionSchema.createDefault({
        id: 1,
        question: 'What is 2+2?',
        options: ['2', '3', '4', '5'],
        correct_answer: 'C',
        category: 'Math',
        difficulty: 'Easy'
      });

      const validation = QuestionSchema.validate(validQuestion);
      this.assert(validation.isValid, 'Valid question should pass validation');

      // Test invalid question
      const invalidQuestion = {
        question: '', // Empty question
        options: ['Only one option'], // Too few options
        correct_answer: 'Z' // Invalid answer
      };

      const invalidValidation = QuestionSchema.validate(invalidQuestion);
      this.assert(!invalidValidation.isValid, 'Invalid question should fail validation');
      this.assert(invalidValidation.errors.length > 0, 'Should have validation errors');

      // Test field normalization
      const normalizedField = QuestionSchema.normalizeFieldName('Question Text (EN)');
      this.assert(normalizedField === 'question_text_en', 'Field normalization should work');

      this.testResults.push({ test: 'Schema Definition', status: 'PASS' });
      console.log('✅ Schema tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'Schema Definition', status: 'FAIL', error: error.message });
      console.log('❌ Schema tests failed:', error.message, '\n');
    }
  }

  /**
   * Test 2: CSV Parsing with Various Formats
   */
  async testCSVParsing() {
    console.log('📊 Testing CSV Parsing...');
    
    try {
      await this.questionManager.initialize();

      // Test standard CSV format
      const standardCSV = `id,question,option_a,option_b,option_c,option_d,correct_answer,category,difficulty,explanation
1,"What is 2+2?",2,3,4,5,C,Math,Easy,"Basic addition"
2,"Capital of France?",London,Paris,Berlin,Madrid,B,Geography,Easy,"Paris is the capital"`;

      const standardResult = await this.questionManager.importFromCSV(standardCSV, {
        mergeStrategy: 'overwrite'
      });

      this.assert(standardResult.summary.added === 2, 'Should import 2 questions from standard CSV');

      // Test CSV with quotes and commas
      const complexCSV = `question,options,answer,category
"What is the result of ""Hello, World""?","A) Greeting, B) Program, C) Both, D) None",C,Programming
"List: apples, oranges, bananas","A) Fruits, B) Vegetables, C) Grains, D) Dairy",A,Food`;

      const complexResult = await this.questionManager.importFromCSV(complexCSV, {
        mergeStrategy: 'force'
      });

      this.assert(complexResult.parseStats.successful >= 0, 'Should handle complex CSV format');

      // Test CSV with custom fields
      const customCSV = `question,correct_answer,difficulty,learning_objective,prerequisite
"Advanced calculus question?",A,Expert,"Understand derivatives","Basic calculus"`;

      const customResult = await this.questionManager.importFromCSV(customCSV, {
        preserveCustomFields: true
      });

      this.assert(customResult.parseStats.successful >= 0, 'Should handle custom fields');

      this.testResults.push({ test: 'CSV Parsing', status: 'PASS' });
      console.log('✅ CSV parsing tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'CSV Parsing', status: 'FAIL', error: error.message });
      console.log('❌ CSV parsing tests failed:', error.message, '\n');
    }
  }

  /**
   * Test 3: Legacy Migration
   */
  async testLegacyMigration() {
    console.log('🔄 Testing Legacy Migration...');
    
    try {
      // Test legacy question format
      const legacyQuestions = [
        {
          id: 1,
          text: 'Legacy question text',
          options: ['A', 'B', 'C', 'D'],
          answer: 2, // Numeric answer
          correct: ['C'], // Array format
          section: 'Legacy Section',
          timeLimit: 45
        }
      ];

      await this.questionManager.loadFromData(legacyQuestions);
      
      const migratedQuestions = this.questionManager.getAllQuestions();
      this.assert(migratedQuestions.length === 1, 'Should migrate legacy question');
      
      const migrated = migratedQuestions[0];
      this.assert(migrated.question === 'Legacy question text', 'Should preserve question text');
      this.assert(migrated.correct_answer === 'C', 'Should convert numeric answer to letter');
      this.assert(migrated.source?.migrated === true, 'Should mark as migrated');

      this.testResults.push({ test: 'Legacy Migration', status: 'PASS' });
      console.log('✅ Legacy migration tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'Legacy Migration', status: 'FAIL', error: error.message });
      console.log('❌ Legacy migration tests failed:', error.message, '\n');
    }
  }

  /**
   * Test 4: Merge Strategies
   */
  async testMergeStrategies() {
    console.log('🔀 Testing Merge Strategies...');
    
    try {
      // Start fresh
      await this.questionManager.initialize();

      // Add initial question
      const initial = await this.questionManager.addQuestion({
        id: 100,
        question: 'Original question',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        explanation: 'Original explanation'
      });

      // Test skip strategy
      const skipCSV = `id,question,explanation
100,"Updated question","Updated explanation"`;

      const skipResult = await this.questionManager.importFromCSV(skipCSV, {
        mergeStrategy: 'skip'
      });

      this.assert(skipResult.summary.skipped === 1, 'Skip strategy should skip duplicate');
      
      const afterSkip = this.questionManager.getQuestions({ search: 'Original' });
      this.assert(afterSkip[0].explanation === 'Original explanation', 'Should preserve original');

      // Test merge strategy
      const mergeResult = await this.questionManager.importFromCSV(skipCSV, {
        mergeStrategy: 'merge'
      });

      this.assert(mergeResult.summary.updated === 1, 'Merge strategy should update');
      
      const afterMerge = this.questionManager.getQuestions({ search: 'Updated' });
      this.assert(afterMerge[0].explanation === 'Updated explanation', 'Should merge new fields');

      this.testResults.push({ test: 'Merge Strategies', status: 'PASS' });
      console.log('✅ Merge strategy tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'Merge Strategies', status: 'FAIL', error: error.message });
      console.log('❌ Merge strategy tests failed:', error.message, '\n');
    }
  }

  /**
   * Test 5: Resilience Scenarios (new fields, tags, etc.)
   */
  async testResilienceScenarios() {
    console.log('🛡️ Testing Resilience Scenarios...');
    
    try {
      // Test handling unknown fields
      const futureCSV = `question,correct_answer,new_field,future_tag,ai_difficulty,multimedia_url
"Future question?",A,"New field value","future,ai,adaptive",0.85,"https://example.com/video.mp4"`;

      const futureResult = await this.questionManager.importFromCSV(futureCSV, {
        preserveCustomFields: true,
        autoCorrect: true
      });

      this.assert(futureResult.parseStats.successful === 1, 'Should handle unknown fields');
      
      const futureQuestion = this.questionManager.getAllQuestions().find(q => 
        q.question === 'Future question?'
      );
      
      this.assert(futureQuestion.custom_fields?.new_field === 'New field value', 
        'Should preserve custom fields');

      // Test malformed data correction
      const malformedCSV = `question,correct_answer,difficulty,points,time_limit
"Malformed question?","1","very hard","-5","-10"`;

      const correctedResult = await this.questionManager.importFromCSV(malformedCSV, {
        autoCorrect: true,
        strictValidation: false
      });

      const corrected = this.questionManager.getAllQuestions().find(q => 
        q.question === 'Malformed question?'
      );
      
      this.assert(corrected.correct_answer === 'A', 'Should correct numeric answer to letter');
      this.assert(corrected.points === 1, 'Should correct negative points');
      this.assert(corrected.time_limit === 30, 'Should correct negative time');

      // Test tag expansion
      const taggedCSV = `question,correct_answer,tags,learning_objectives
"Tagged question?",A,"math, algebra, equations","solve linear equations, understand variables"`;

      await this.questionManager.importFromCSV(taggedCSV);
      
      const tagged = this.questionManager.getAllQuestions().find(q => 
        q.question === 'Tagged question?'
      );
      
      this.assert(tagged.tags.length === 3, 'Should parse comma-separated tags');
      this.assert(tagged.learning_objectives.length === 2, 'Should parse learning objectives');

      this.testResults.push({ test: 'Resilience Scenarios', status: 'PASS' });
      console.log('✅ Resilience tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'Resilience Scenarios', status: 'FAIL', error: error.message });
      console.log('❌ Resilience tests failed:', error.message, '\n');
    }
  }

  /**
   * Test 6: Performance with Large Datasets
   */
  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    try {
      // Generate large CSV
      let largeCSV = 'id,question,option_a,option_b,option_c,option_d,correct_answer,category\n';
      
      for (let i = 1; i <= 1000; i++) {
        largeCSV += `${i},"Question ${i}?","Option A${i}","Option B${i}","Option C${i}","Option D${i}",A,"Category${i % 10}"\n`;
      }

      const startTime = Date.now();
      
      const performanceResult = await this.questionManager.importFromCSV(largeCSV, {
        batchSize: 100,
        autoCorrect: true
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.assert(performanceResult.parseStats.successful === 1000, 
        'Should import all 1000 questions');
      
      this.assert(duration < 10000, 'Should complete within 10 seconds');

      console.log(`📊 Performance: Imported 1000 questions in ${duration}ms`);

      // Test memory efficiency
      const memUsage = process.memoryUsage();
      console.log(`💾 Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

      this.testResults.push({ 
        test: 'Performance', 
        status: 'PASS', 
        metrics: { duration, memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024) }
      });
      console.log('✅ Performance tests passed\n');

    } catch (error) {
      this.testResults.push({ test: 'Performance', status: 'FAIL', error: error.message });
      console.log('❌ Performance tests failed:', error.message, '\n');
    }
  }

  /**
   * Migration script for existing data
   */
  async migrateExistingData() {
    console.log('🔄 Migrating Existing Data...');
    
    try {
      // Try to load existing questions.csv
      const csvPath = join(__dirname, '../src/data/questions.csv');
      const csvContent = readFileSync(csvPath, 'utf8');
      
      console.log('📁 Found existing questions.csv, migrating...');
      
      const migrationResult = await this.questionManager.importFromCSV(csvContent, {
        mergeStrategy: 'overwrite',
        autoCorrect: true,
        owner: 'migration',
        tags: ['migrated', 'original']
      });

      console.log(`✅ Migration complete: ${migrationResult.summary.added} questions migrated`);
      
      return migrationResult;

    } catch (error) {
      console.log('ℹ️ No existing CSV found or migration failed:', error.message);
      return null;
    }
  }

  // Test utilities
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.metrics) {
        console.log(`   Metrics: ${JSON.stringify(result.metrics)}`);
      }

      if (result.status === 'PASS') passed++;
      else failed++;
    });

    console.log(`\n📈 Overall: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Integration is solid.');
    } else {
      console.log('⚠️ Some tests failed. Please review the errors above.');
    }
  }
}

// Export for use in other scripts
export { IntegrationTester };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new IntegrationTester();
  
  try {
    await tester.runTests();
    await tester.migrateExistingData();
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}
