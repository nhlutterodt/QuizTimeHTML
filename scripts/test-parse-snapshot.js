import EnhancedCSVManager from '../src/data/EnhancedCSVManager.js';

(async function(){
  const csv = `Q,OptA,OptB,OptC,OptD,Ans\n"What is 1+1?",1,2,3,4,B`;
  const manager = new EnhancedCSVManager();
  try {
    const res = await manager.parseCSV(csv, { autoCorrect: true, snapshotRowLimit: 5 });
    console.log('summary:', res.summary);
    console.log('compact snapshot (via manager.getLastParseSnapshotCompact()):', manager.getLastParseSnapshotCompact(3));
    console.log('lastParseSnapshot:', res.lastParseSnapshot ? res.lastParseSnapshot.compactErrors : null);
    console.log('full JSON export (first 200 chars):', manager.exportLastParseSnapshotJSON()?.slice(0,200));
  } catch (e) {
    console.error('error during parse test:', e);
  }
})();
