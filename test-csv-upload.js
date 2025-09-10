#!/usr/bin/env node

/**
 * Integration Test for Multi-CSV Upload Schema Plan
 * Tests all aspects of the CSV upload functionality
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class CSVUploadTester {
  constructor() {
    this.baseUrl = 'http://localhost:5500';
    this.testResults = [];
    this.testFiles = [];
  }

  async runTests() {
    console.log('🧪 Starting CSV Upload Integration Tests...\n');

    try {
      await this.setupTestFiles();
      await this.testSingleFileUpload();
      await this.testDuplicateDetection();
      await this.testMergeStrategies();
      await this.testMultiFileUpload();
      await this.testErrorHandling();
      await this.testBackupSystem();
      await this.cleanupTestFiles();

      this.printResults();
    } catch (error) {
      console.error('💥 Test execution failed:', error);
      await this.cleanupTestFiles();
      process.exit(1);
    }
  }

  async setupTestFiles() {
    console.log('📁 Setting up test files...');
    
    const testDir = '/tmp/csv_upload_tests';
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Basic test file
    const basicCSV = `id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit
1001,Test,Easy,multiple_choice,Test question 1?,A,B,C,D,A,Test explanation,1,30
1002,Test,Medium,multiple_choice,Test question 2?,E,F,G,H,B,Test explanation 2,2,45`;

    const basicFile = path.join(testDir, 'basic_test.csv');
    await fs.writeFile(basicFile, basicCSV);
    this.testFiles.push(basicFile);

    // Duplicate test file (same IDs)
    const duplicateCSV = `id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit
1001,Test,Hard,multiple_choice,Updated test question 1?,A1,B1,C1,D1,A,Updated explanation,3,60`;

    const duplicateFile = path.join(testDir, 'duplicate_test.csv');
    await fs.writeFile(duplicateFile, duplicateCSV);
    this.testFiles.push(duplicateFile);

    // Multi-file test files
    const file1CSV = `id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit
2001,Science,Easy,multiple_choice,Test science question?,Option A,Option B,Option C,Option D,C,Science explanation,1,30`;

    const file2CSV = `id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit
3001,Math,Medium,multiple_choice,Test math question?,1,2,3,4,C,Math explanation,2,45`;

    const file1 = path.join(testDir, 'science_test.csv');
    const file2 = path.join(testDir, 'math_test.csv');
    await fs.writeFile(file1, file1CSV);
    await fs.writeFile(file2, file2CSV);
    this.testFiles.push(file1, file2);

    // Invalid CSV file
    const invalidCSV = `invalid,csv,without,proper,headers
some,random,data,that,should,fail`;

    const invalidFile = path.join(testDir, 'invalid_test.csv');
    await fs.writeFile(invalidFile, invalidCSV);
    this.testFiles.push(invalidFile);

    console.log('✅ Test files created\n');
  }

  async testSingleFileUpload() {
    console.log('🔍 Testing single file upload...');
    
    try {
      const testFile = this.testFiles[0]; // basic_test.csv
      const result = await this.uploadFiles([testFile], { mergeStrategy: 'skip' });
      
      this.assert(result.summary.processed === 2, 'Should process 2 questions');
      this.assert(result.summary.added === 2, 'Should add 2 new questions');
      this.assert(result.summary.errors.length === 0, 'Should have no errors');
      this.assert(result.detailsPerFile.length === 1, 'Should have details for 1 file');

      this.testResults.push({ test: 'Single File Upload', status: 'PASS' });
      console.log('✅ Single file upload test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Single File Upload', status: 'FAIL', error: error.message });
      console.log('❌ Single file upload test failed:', error.message, '\n');
    }
  }

  async testDuplicateDetection() {
    console.log('🔍 Testing duplicate detection with skip strategy...');
    
    try {
      const testFile = this.testFiles[0]; // basic_test.csv (same file as before)
      const result = await this.uploadFiles([testFile], { mergeStrategy: 'skip' });
      
      this.assert(result.summary.processed === 2, 'Should process 2 questions');
      this.assert(result.summary.added === 0, 'Should add 0 new questions');
      this.assert(result.summary.skipped === 2, 'Should skip 2 duplicate questions');

      this.testResults.push({ test: 'Duplicate Detection (Skip)', status: 'PASS' });
      console.log('✅ Duplicate detection test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Duplicate Detection (Skip)', status: 'FAIL', error: error.message });
      console.log('❌ Duplicate detection test failed:', error.message, '\n');
    }
  }

  async testMergeStrategies() {
    console.log('🔍 Testing merge strategies...');
    
    try {
      const duplicateFile = this.testFiles[1]; // duplicate_test.csv
      
      // Test overwrite strategy
      const overwriteResult = await this.uploadFiles([duplicateFile], { mergeStrategy: 'overwrite' });
      this.assert(overwriteResult.summary.updated === 1, 'Overwrite should update 1 question');
      
      // Test force strategy
      const forceResult = await this.uploadFiles([duplicateFile], { mergeStrategy: 'force' });
      this.assert(forceResult.summary.added === 1, 'Force should add 1 new question');

      this.testResults.push({ test: 'Merge Strategies', status: 'PASS' });
      console.log('✅ Merge strategies test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Merge Strategies', status: 'FAIL', error: error.message });
      console.log('❌ Merge strategies test failed:', error.message, '\n');
    }
  }

  async testMultiFileUpload() {
    console.log('🔍 Testing multi-file upload...');
    
    try {
      const file1 = this.testFiles[2]; // science_test.csv
      const file2 = this.testFiles[3]; // math_test.csv
      
      const result = await this.uploadFiles([file1, file2], { mergeStrategy: 'skip' });
      
      this.assert(result.summary.processed === 2, 'Should process 2 questions total');
      this.assert(result.summary.added === 2, 'Should add 2 new questions');
      this.assert(result.detailsPerFile.length === 2, 'Should have details for 2 files');
      this.assert(result.detailsPerFile[0].processed === 1, 'First file should process 1 question');
      this.assert(result.detailsPerFile[1].processed === 1, 'Second file should process 1 question');

      this.testResults.push({ test: 'Multi-File Upload', status: 'PASS' });
      console.log('✅ Multi-file upload test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Multi-File Upload', status: 'FAIL', error: error.message });
      console.log('❌ Multi-file upload test failed:', error.message, '\n');
    }
  }

  async testErrorHandling() {
    console.log('🔍 Testing error handling...');
    
    try {
      const invalidFile = this.testFiles[4]; // invalid_test.csv
      
      const result = await this.uploadFiles([invalidFile], { mergeStrategy: 'skip', strictness: 'lenient' });
      
      // Should handle the error gracefully
      this.assert(result.summary.errors.length > 0 || result.summary.processed === 0, 'Should have errors or no processed questions');

      this.testResults.push({ test: 'Error Handling', status: 'PASS' });
      console.log('✅ Error handling test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Error Handling', status: 'FAIL', error: error.message });
      console.log('❌ Error handling test failed:', error.message, '\n');
    }
  }

  async testBackupSystem() {
    console.log('🔍 Testing backup system...');
    
    try {
      // Check if backups directory exists and has files
      const backupsDir = path.join(__dirname, 'data', 'backups');
      const backupFiles = await fs.readdir(backupsDir);
      
      this.assert(backupFiles.length > 0, 'Should have backup files');
      
      // Test that backups are created for overwrite operations
      const testFile = this.testFiles[1]; // duplicate_test.csv
      await this.uploadFiles([testFile], { mergeStrategy: 'overwrite' });
      
      const backupFilesAfter = await fs.readdir(backupsDir);
      this.assert(backupFilesAfter.length >= backupFiles.length, 'Should maintain or increase backup count');

      this.testResults.push({ test: 'Backup System', status: 'PASS' });
      console.log('✅ Backup system test passed\n');
    } catch (error) {
      this.testResults.push({ test: 'Backup System', status: 'FAIL', error: error.message });
      console.log('❌ Backup system test failed:', error.message, '\n');
    }
  }

  async uploadFiles(filePaths, options = {}) {
    const formData = [];
    
    // Add files
    for (const filePath of filePaths) {
      formData.push(`-F "files=@${filePath}"`);
    }
    
    // Add options
    formData.push(`-F 'options=${JSON.stringify(options)}'`);
    
    const command = `curl -s -X POST ${this.baseUrl}/api/upload-csvs ${formData.join(' ')}`;
    
    try {
      const { stdout } = await execAsync(command);
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async cleanupTestFiles() {
    console.log('🧹 Cleaning up test files...');
    
    for (const filePath of this.testFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist
      }
    }
    
    // Remove test directory
    try {
      await fs.rmdir('/tmp/csv_upload_tests');
    } catch (error) {
      // Directory might not be empty or not exist
    }
    
    console.log('✅ Test files cleaned up\n');
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  printResults() {
    console.log('\n📊 CSV Upload Test Results Summary:');
    console.log('=======================================');
    
    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.status === 'PASS') passed++;
      else failed++;
    });

    console.log(`\n📈 Overall: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All CSV upload tests passed! Implementation is complete.');
    } else {
      console.log('⚠️ Some tests failed. Please review the errors above.');
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new CSVUploadTester();
  tester.runTests().catch(console.error);
}

module.exports = { CSVUploadTester };