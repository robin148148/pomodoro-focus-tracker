// --- Application State ---
const MODES = {
  pomodoro: { label: 'Tập trung', time: 25 * 60, colorVar: '--accent-work', glowVar: '--accent-work-glow' },
  shortBreak: { label: 'Nghỉ ngắn', time: 5 * 60, colorVar: '--accent-short', glowVar: '--accent-short-glow' },
  longBreak: { label: 'Nghỉ dài', time: 15 * 60, colorVar: '--accent-long', glowVar: '--accent-long-glow' }
};

let currentMode = 'pomodoro';
let totalDuration = MODES.pomodoro.time;
let remainingSeconds = totalDuration;
let timerInterval = null;
let isRunning = false;
let isSoundEnabled = true;

// Stats & Tasks State
let completedCycles = parseInt(localStorage.getItem('pomo_cycles') || '0', 10);
let totalFocusedMinutes = parseInt(localStorage.getItem('pomo_focused_mins') || '0', 10);
let tasks = JSON.parse(localStorage.getItem('pomo_tasks') || '[]');

// --- DOM Elements ---
const timerDigitsEl = document.getElementById('timerTime');
const timerStatusEl = document.getElementById('timerStatus');
const startPauseBtn = document.getElementById('startPauseBtn');
const startIcon = document.getElementById('startIcon');
const startText = document.getElementById('startText');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const modeButtons = document.querySelectorAll('.mode-btn');
const progressCircle = document.getElementById('progressCircle');

const cycleCountEl = document.getElementById('cycleCount');
const focusedMinutesEl = document.getElementById('focusedMinutes');

const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');

const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskListEl = document.getElementById('taskList');
const taskStatsEl = document.getElementById('taskStats');

// SVG Ring Circumference Setup (r = 120)
const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
progressCircle.style.strokeDasharray = `${CIRCUMFERENCE}`;
progressCircle.style.strokeDashoffset = '0';

// --- Initialization ---
function init() {
  loadSavedTheme();
  renderStats();
  renderTasks();
  updateTimerDisplay();
  applyModeStyle();
  setupEventListeners();
}

// --- Sound Synthesizer (Web Audio API) ---
function playNotificationChime() {
  if (!isSoundEnabled) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major chord
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.85);
    });
  } catch (err) {
    console.warn('AudioContext not allowed or failed:', err);
  }
}

// --- Timer Logic ---
function updateTimerDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  timerDigitsEl.textContent = formatted;
  document.title = `${formatted} - ${MODES[currentMode].label} | PomoFocus`;

  // Update circular progress ring
  const fraction = remainingSeconds / totalDuration;
  const offset = CIRCUMFERENCE - (fraction * CIRCUMFERENCE);
  progressCircle.style.strokeDashoffset = offset;
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startIcon.textContent = '⏸';
  startText.textContent = 'Tạm dừng';
  timerStatusEl.textContent = `Đang ${MODES[currentMode].label.toLowerCase()}...`;

  timerInterval = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateTimerDisplay();
    } else {
      handleTimerCompletion();
    }
  }, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  startIcon.textContent = '▶';
  startText.textContent = 'Tiếp tục';
  timerStatusEl.textContent = 'Đã tạm dừng';
}

function resetTimer() {
  pauseTimer();
  remainingSeconds = totalDuration;
  startIcon.textContent = '▶';
  startText.textContent = 'Bắt đầu';
  timerStatusEl.textContent = 'Sẵn sàng bắt đầu';
  updateTimerDisplay();
}

function handleTimerCompletion() {
  pauseTimer();
  playNotificationChime();

  if (currentMode === 'pomodoro') {
    completedCycles++;
    totalFocusedMinutes += Math.round(MODES.pomodoro.time / 60);
    localStorage.setItem('pomo_cycles', completedCycles);
    localStorage.setItem('pomo_focused_mins', totalFocusedMinutes);
    renderStats();

    // Auto prompt switch to break
    if (completedCycles % 4 === 0) {
      switchMode('longBreak');
    } else {
      switchMode('shortBreak');
    }
  } else {
    switchMode('pomodoro');
  }
}

function switchMode(newMode) {
  currentMode = newMode;
  totalDuration = MODES[newMode].time;
  remainingSeconds = totalDuration;

  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === newMode);
  });

  applyModeStyle();
  resetTimer();
}

function applyModeStyle() {
  const root = document.documentElement;
  const modeData = MODES[currentMode];
  root.style.setProperty('--current-accent', `var(${modeData.colorVar})`);
  root.style.setProperty('--current-glow', `var(${modeData.glowVar})`);
}

// --- Stats Rendering ---
function renderStats() {
  cycleCountEl.textContent = completedCycles;
  focusedMinutesEl.textContent = totalFocusedMinutes;
}

// --- Task Manager ---
function renderTasks() {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = `<li class="empty-task-placeholder">Chưa có công việc nào. Hãy thêm việc để tập trung nhé!</li>`;
    taskStatsEl.textContent = '0/0 hoàn thành';
    return;
  }

  const completedCount = tasks.filter(t => t.completed).length;
  taskStatsEl.textContent = `${completedCount}/${tasks.length} hoàn thành`;

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;

    li.innerHTML = `
      <div class="task-left">
        <input 
          type="checkbox" 
          class="task-checkbox" 
          ${task.completed ? 'checked' : ''} 
          data-index="${index}"
        />
        <span class="task-text">${escapeHtml(task.title)}</span>
      </div>
      <button class="task-delete-btn" data-index="${index}" title="Xoá việc này">✕</button>
    `;

    taskListEl.appendChild(li);
  });
}

function addTask(title) {
  if (!title.trim()) return;
  tasks.push({ title: title.trim(), completed: false });
  saveTasks();
  renderTasks();
}

function toggleTask(index) {
  if (tasks[index]) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(index) {
  if (tasks[index] !== undefined) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }
}

function saveTasks() {
  localStorage.setItem('pomo_tasks', JSON.stringify(tasks));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Theme Management ---
function loadSavedTheme() {
  const saved = localStorage.getItem('pomo_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  themeIcon.textContent = saved === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  themeIcon.textContent = target === 'light' ? '☀️' : '🌙';
  localStorage.setItem('pomo_theme', target);
}

// --- Event Listeners ---
function setupEventListeners() {
  // Start / Pause
  startPauseBtn.addEventListener('click', () => {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  // Reset
  resetBtn.addEventListener('click', resetTimer);

  // Skip
  skipBtn.addEventListener('click', () => {
    if (confirm('Bạn có muốn bỏ qua phiên hiện tại?')) {
      handleTimerCompletion();
    }
  });

  // Mode Switch Buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode !== currentMode) {
        switchMode(btn.dataset.mode);
      }
    });
  });

  // Sound Toggle
  soundToggleBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    soundIcon.textContent = isSoundEnabled ? '🔔' : '🔕';
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Task Form Submit
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(taskInput.value);
    taskInput.value = '';
  });

  // Task List Delegation
  taskListEl.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('task-checkbox')) {
      const idx = parseInt(target.dataset.index, 10);
      toggleTask(idx);
    } else if (target.classList.contains('task-delete-btn')) {
      const idx = parseInt(target.dataset.index, 10);
      deleteTask(idx);
    }
  });

  // Keyboard shortcut: Spacebar to toggle Play/Pause (except when typing in input)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement !== taskInput) {
      e.preventDefault();
      if (isRunning) pauseTimer();
      else startTimer();
    }
  });
}

// Start app
init();
