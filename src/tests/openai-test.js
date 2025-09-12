document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('sendBtn');
  const promptInput = document.getElementById('prompt');
  const responseEl = document.getElementById('response');

  if (!sendBtn || !promptInput || !responseEl) return;

  sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value;
    responseEl.textContent = 'Loading...';
    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: prompt, userAnswerArray: [], correctAnswerArray: [] })
      });
      if (!res.ok) {
        const err = await res.text();
        responseEl.textContent = 'Error: ' + err;
        return;
      }
      const data = await res.json();
      responseEl.textContent = data.assessment || JSON.stringify(data);
    } catch (e) {
      responseEl.textContent = 'Request failed: ' + e;
    }
  });
});

export default {};
