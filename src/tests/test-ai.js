async function testAI() {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = 'Testing AI assessment...';
  try {
    const response = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText: 'What is 2 + 2?', userAnswerArray: ['4'], correctAnswerArray: ['4'] })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    resultDiv.innerHTML = `<h3>AI Response:</h3><p>${data.assessment || 'No assessment received'}</p>`;
  } catch (error) {
    resultDiv.innerHTML = `<h3>Error:</h3><p style="color: red;">${error.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('button[data-test-ai]');
  if (btn) btn.addEventListener('click', testAI);
});

export default {};
