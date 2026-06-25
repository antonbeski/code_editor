/* ============================================================
   Run01 — app.js
   Monaco editor + Pyodide Python execution, fully client-side
   ============================================================ */

// ── Starter code ──────────────────────────────────────────
const STARTER_CODE = `# Welcome to Run01
# Pure client-side Python sandbox running via Pyodide + WebAssembly
# Press Run or Cmd/Ctrl + Enter to execute

import sys

def fibonacci(n):
    """Generate Fibonacci sequence up to n terms."""
    a, b = 0, 1
    sequence = []
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence

# Run it
terms = 12
fib = fibonacci(terms)

print(f"Fibonacci sequence ({terms} terms):")
print(" -> ".join(str(x) for x in fib))
print()

# Python version
print(f"Python {sys.version}")
print("Running in WebAssembly via Pyodide")
`;

// ── State ─────────────────────────────────────────────────
let monacoEditor = null;
let pyodide = null;
let runCount = 0;
let isRunning = false;

// ── DOM refs ──────────────────────────────────────────────
const statusDot   = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const btnRun      = document.getElementById('btnRun');
const btnClear    = document.getElementById('btnClear');
const btnReset    = document.getElementById('btnReset');
const outputEl    = document.getElementById('output');
const editorMeta  = document.getElementById('editorMeta');
const outputMeta  = document.getElementById('outputMeta');

// ── Status helpers ────────────────────────────────────────
function setStatus(state, label) {
  statusDot.className = `status-dot ${state}`;
  statusLabel.textContent = label;
}

// ── Monaco init ───────────────────────────────────────────
require(['vs/editor/editor.main'], function () {

  // Custom premium monochrome theme
  monaco.editor.defineTheme('run01-monochrome', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',         foreground: '5C5C5C', fontStyle: 'italic' },
      { token: 'keyword',         foreground: 'FFFFFF', fontStyle: 'bold' },
      { token: 'string',          foreground: 'A3A3A3' },
      { token: 'number',          foreground: 'E5E5E5' },
      { token: 'identifier',      foreground: 'D4D4D4' },
      { token: 'type.identifier',  foreground: 'FFFFFF', fontStyle: 'bold' },
      { token: 'delimiter',       foreground: '737373' },
      { token: 'operator',        foreground: 'FFFFFF' },
    ],
    colors: {
      'editor.background':           '#00000000',
      'editor.foreground':           '#D4D4D4',
      'editor.lineHighlightBackground': '#ffffff0a',
      'editor.selectionBackground':  '#ffffff20',
      'editor.inactiveSelectionBackground': '#ffffff10',
      'editorLineNumber.foreground': '#525252',
      'editorLineNumber.activeForeground': '#A3A3A3',
      'editorCursor.foreground':     '#FFFFFF',
      'editorIndentGuide.background':'#262626',
      'editorIndentGuide.activeBackground': '#404040',
      'editorWidget.background':     '#121212',
      'editorWidget.border':         '#262626',
      'input.background':            '#050505',
      'input.foreground':            '#F5F5F7',
      'scrollbarSlider.background':  '#ffffff10',
      'scrollbarSlider.hoverBackground': '#ffffff20',
    }
  });

  monacoEditor = monaco.editor.create(document.getElementById('editor'), {
    value: STARTER_CODE,
    language: 'python',
    theme: 'run01-monochrome',
    fontSize: 13.5,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'gutter',
    cursorBlinking: 'phase',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    formatOnPaste: true,
    tabSize: 4,
    insertSpaces: true,
    folding: true,
    suggest: { preview: true },
  });

  // Cursor position in pane header
  monacoEditor.onDidChangeCursorPosition(e => {
    const pos = e.position;
    editorMeta.textContent = `ln ${pos.lineNumber}, col ${pos.column}`;
  });

  // Cmd/Ctrl+Enter to run
  monacoEditor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
    () => { if (!isRunning && pyodide) runCode(); }
  );
});

// ── Pyodide init ──────────────────────────────────────────
(async function initPyodide() {
  setStatus('loading', 'Loading Pyodide…');
  try {
    // Explicit indexURL to avoid loader resolution issues
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
    setStatus('ready', 'Ready');
    btnRun.disabled = false;
    clearOutput();
    appendWelcome();
  } catch (err) {
    setStatus('error', 'Failed to load Pyodide');
    const msg = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
    appendToOutput(`Error loading Pyodide: ${msg}`, 'err');
    // Also log to console for Vercel logs
    console.error('Pyodide load error:', err);
  }
})();

// ── Run code ─────────────────────────────────────────────
async function runCode() {
  if (!pyodide || isRunning) return;

  const code = monacoEditor.getValue();
  if (!code.trim()) return;

  isRunning = true;
  runCount++;
  btnRun.disabled = true;
  setStatus('running', 'Running…');
  outputMeta.textContent = 'running…';

  const startTime = performance.now();
  const blockEl = document.createElement('div');
  blockEl.className = 'out-block';

  // Run header
  const headerEl = document.createElement('div');
  headerEl.className = 'out-run-header';
  const numEl = document.createElement('span');
  numEl.className = 'out-run-num';
  numEl.textContent = `Run #${runCount}`;
  const badgeEl = document.createElement('span');
  const timeEl = document.createElement('span');
  timeEl.className = 'out-run-time';
  headerEl.appendChild(numEl);
  headerEl.appendChild(badgeEl);
  headerEl.appendChild(timeEl);
  blockEl.appendChild(headerEl);

  // Output lines container
  const linesEl = document.createElement('div');
  blockEl.appendChild(linesEl);
  outputEl.appendChild(blockEl);

  // Capture stdout / stderr
  let stdoutBuf = '';
  let stderrBuf = '';

  pyodide.setStdout({
    batched: (s) => { stdoutBuf += s + '\n'; }
  });
  pyodide.setStderr({
    batched: (s) => { stderrBuf += s + '\n'; }
  });

  let success = false;
  try {
    await pyodide.runPythonAsync(code);
    success = true;
  } catch (err) {
    stderrBuf += err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

  // Render stdout
  if (stdoutBuf.trim()) {
    stdoutBuf.split('\n').forEach(line => {
      const span = document.createElement('span');
      span.className = 'out-line';
      span.textContent = line;
      linesEl.appendChild(span);
    });
  }

  // Render stderr
  if (stderrBuf.trim()) {
    stderrBuf.split('\n').forEach(line => {
      if (!line.trim()) return;
      const span = document.createElement('span');
      span.className = 'out-line err';
      span.textContent = line;
      linesEl.appendChild(span);
    });
  }

  // Empty output
  if (!stdoutBuf.trim() && !stderrBuf.trim()) {
    const empty = document.createElement('span');
    empty.className = 'out-line out-empty';
    empty.textContent = '(no output)';
    linesEl.appendChild(empty);
  }

  // Badge + time
  badgeEl.className = success ? 'out-success-badge' : 'out-error-badge';
  badgeEl.textContent = success ? '✓ success' : '✗ error';
  timeEl.textContent = `${elapsed}s`;

  // Scroll to bottom
  outputEl.scrollTop = outputEl.scrollHeight;

  // Update status
  setStatus(success ? 'ready' : 'error', success ? `Done in ${elapsed}s` : 'Error');
  outputMeta.textContent = `run #${runCount} · ${elapsed}s`;

  isRunning = false;
  btnRun.disabled = false;
}

// ── Output helpers ────────────────────────────────────────
function clearOutput() {
  outputEl.innerHTML = '';
  runCount = 0;
  outputMeta.textContent = 'ready';
}

function appendWelcome() {
  outputEl.innerHTML = `
    <div class="output-welcome">
      <div class="welcome-prompt">
        <span class="prompt-caret">❯</span>
        Run01 ready - press <strong style="color:var(--white)">▶ Run</strong> or <kbd style="font-family:var(--font-mono);font-size:11px;background:var(--glass-bg-hover);padding:1px 5px;border-radius:4px;border:1px solid var(--glass-border)">⌘↵</kbd> to execute the code.
      </div>
    </div>
  `;
}

function appendToOutput(text, cls) {
  const span = document.createElement('span');
  span.className = `out-line ${cls || ''}`;
  span.textContent = text;
  outputEl.appendChild(span);
}

// ── Button handlers ───────────────────────────────────────
btnRun.addEventListener('click', () => {
  if (!isRunning && pyodide) runCode();
});

btnClear.addEventListener('click', () => {
  clearOutput();
  if (pyodide) appendWelcome();
  setStatus('ready', 'Ready');
});

btnReset.addEventListener('click', () => {
  if (monacoEditor) monacoEditor.setValue(STARTER_CODE);
  clearOutput();
  if (pyodide) appendWelcome();
  setStatus('ready', 'Ready');
});

// ── Resize handle ─────────────────────────────────────────
(function initResize() {
  const handle    = document.getElementById('resizeHandle');
  const workspace = document.querySelector('.workspace');
  const editorPane = document.querySelector('.pane-editor');
  const outputPane = document.querySelector('.pane-output');

  let dragging = false;
  let startX = 0;
  let startEditorFlex = 0;
  let totalWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startEditorFlex = editorPane.getBoundingClientRect().width;
    totalWidth = workspace.getBoundingClientRect().width - handle.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newEditorW = Math.min(Math.max(startEditorFlex + delta, 200), totalWidth - 200);
    const pct = (newEditorW / totalWidth * 100).toFixed(2);
    editorPane.style.flex = `0 0 ${pct}%`;
    outputPane.style.flex = `1 1 0`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();
