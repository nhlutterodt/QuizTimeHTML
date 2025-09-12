;(async function run(){
  console.log('Running headersMap normalization unit test...');

  const mod = await import('../src/data/EnhancedCSVManager.js');
  const EnhancedCSVManager = mod.default || mod;

  const mgr = new EnhancedCSVManager();

  // CSV header uses irregular spacing and casing
  const csv = '  Q  , OPTION_A \n"Normalized header test",Choice1\n';

  // headersMap uses different casing/whitespace than CSV header
  const headersMap = { ' q ': 'question', 'option_a': 'option_a' };

  try {
    const result = await mgr.parseCSV(csv, { headersMap, snapshotRowLimit: 5 });

    if (!result || !Array.isArray(result.questions) || result.questions.length !== 1) {
      console.error('Expected 1 parsed question, got:', result?.questions?.length);
      process.exit(1);
    }

    const q = result.questions[0];
    if (q.question !== 'Normalized header test') {
      console.error('Header mapping failed - question text mismatch:', q.question);
      process.exit(1);
    }

    console.log('headersMap normalization unit test passed');
    process.exit(0);
  } catch (err) {
  console.error('headersMap normalization unit test failed:', err?.message ?? err);
    process.exit(1);
  }
})();
