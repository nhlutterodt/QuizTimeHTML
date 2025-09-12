async function checkStatus() {
  try {
    const response = await fetch('http://localhost:3001/diag');
    const data = await response.json();
    const statusEl = document.getElementById('serverStatus');
    statusEl.className = 'status-indicator status-running';
    statusEl.innerHTML = '🟢 Server Status: Running on port 3001';
  } catch (error) {
    const statusEl = document.getElementById('serverStatus');
    statusEl.className = 'status-indicator status-stopped';
    statusEl.innerHTML = '🔴 Server Status: Not Running';
  }
}

function startServer() {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'runTask', taskName: 'Start Quiz Server' });
  } else {
    alert('Use VS Code Command Palette (Ctrl+Shift+P) → "Tasks: Run Task" → "Start Quiz Server"');
  }
}

function startWithReload() {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'runTask', taskName: 'Start with Hot Reload' });
  } else {
    alert('Use VS Code Command Palette (Ctrl+Shift+P) → "Tasks: Run Task" → "Start with Hot Reload"');
  }
}

function stopServer() {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'runTask', taskName: 'Stop All Node Servers' });
  } else {
    alert('Use VS Code Command Palette (Ctrl+Shift+P) → "Tasks: Run Task" → "Stop All Node Servers"');
  }
}

function openQuiz() {
  window.open('http://localhost:3001/User_Acceptance.html', '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startServerBtn')?.addEventListener('click', startServer);
  document.getElementById('startWithReloadBtn')?.addEventListener('click', startWithReload);
  document.getElementById('stopServerBtn')?.addEventListener('click', stopServer);
  document.getElementById('checkStatusBtn')?.addEventListener('click', checkStatus);
  document.getElementById('openQuizBtn')?.addEventListener('click', openQuiz);

  // initial status and interval
  checkStatus();
  setInterval(checkStatus, 5000);
});

export default {};
