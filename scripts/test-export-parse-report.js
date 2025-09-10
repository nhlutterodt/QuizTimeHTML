import IntegratedQuestionManager from '../src/services/IntegratedQuestionManager.js';

(async function(){
  const csv = `id,question,option_a,option_b,option_c,option_d,correct_answer\n1,What is 2+2?,1,2,3,4,C`;
  const manager = new IntegratedQuestionManager();

  try {
    // Directly use csvManager to parse so lastImportParseSnapshot will be set when importFromCSV is called
    const res = await manager.importFromCSV(csv, { mergeStrategy: 'skip', snapshotRowLimit: 5 });
    console.log('import result summary:', res.summary);

    const exportRes = await manager.exportLastParseReport();
    console.log('export result:', exportRes);
  } catch (e) {
    console.error('test failed:', e);
  }
})();
