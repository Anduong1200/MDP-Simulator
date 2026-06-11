/* =========================================================
   GridWorld MDP Visualizer – Application Logic
   ========================================================= */

// ── Constants ──
const ACTIONS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const ACTION_KEYS = ['U', 'D', 'L', 'R'];
const ARROWS = { U: '↑', D: '↓', L: '←', R: '→' };

// ── State ──
let gridRows = 0, gridCols = 0;
let cells = [];          // 2D: { type:'empty'|'blocked'|'terminal', reward:0 }
let selectedCell = null; // { r, c }
let selectedAlgo = 'vi';
let piInitMode = 'uniform';
let uniformDirection = 'U';
let initPolicy = [];     // 2D: action string ('U','D','L','R') or null
let currentV = [];       // 2D: float
let currentPolicy = [];  // 2D: action string
let displayMode = 'both';
let isRunning = false;

// ── Grid Creation ──
function createGrid() {
    const m = parseInt(document.getElementById('rows').value);
    const n = parseInt(document.getElementById('cols').value);
    if (m < 2 || m > 10 || n < 2 || n > 10) {
        alert('Rows và Cols phải nằm trong [2, 10]');
        return;
    }
    gridRows = m;
    gridCols = n;

    cells = [];
    for (let r = 0; r < m; r++) {
        cells[r] = [];
        for (let c = 0; c < n; c++) {
            cells[r][c] = { type: 'empty', reward: 0 };
        }
    }

    initPolicy = [];
    for (let r = 0; r < m; r++) {
        initPolicy[r] = [];
        for (let c = 0; c < n; c++) {
            initPolicy[r][c] = 'U';
        }
    }

    currentV = [];
    currentPolicy = [];
    selectedCell = null;
    isRunning = false;

    // Show panels
    document.getElementById('cellEditorCard').style.display = '';
    document.getElementById('paramsCard').style.display = '';
    document.getElementById('algoCard').style.display = '';
    document.getElementById('gridPlaceholder').style.display = 'none';
    document.getElementById('gridWrapper').style.display = '';
    document.getElementById('gridLabel').textContent = `${m} × ${n} Grid`;
    document.getElementById('btnStep').style.display = 'none';
    document.getElementById('btnReset').style.display = 'none';

    renderGrid();
}

function renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.style.gridTemplateColumns = `repeat(${gridCols}, 80px)`;
    gridEl.innerHTML = '';

    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const cell = cells[r][c];
            const el = document.createElement('div');
            el.className = 'grid-cell';
            el.id = `cell-${r}-${c}`;
            el.dataset.r = r;
            el.dataset.c = c;

            // Type class
            if (cell.type === 'blocked') {
                el.classList.add('blocked');
            } else if (cell.type === 'terminal') {
                el.classList.add('terminal');
                el.classList.add(cell.reward >= 0 ? 'positive' : 'negative');
            } else {
                el.classList.add('empty');
            }

            // Selected
            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                el.classList.add('selected');
            }

            // Coord label
            const coordSpan = document.createElement('span');
            coordSpan.className = 'cell-coord';
            coordSpan.textContent = `${r},${c}`;
            el.appendChild(coordSpan);

            // Content
            if (cell.type === 'blocked') {
                // blocked: show hatching only
            } else if (cell.type === 'terminal') {
                const rewardSpan = document.createElement('span');
                rewardSpan.className = 'cell-reward ' + (cell.reward >= 0 ? 'positive-reward' : 'negative-reward');
                rewardSpan.textContent = cell.reward >= 0 ? `+${cell.reward}` : `${cell.reward}`;
                rewardSpan.style.position = 'static';
                rewardSpan.style.fontSize = '1rem';
                el.appendChild(rewardSpan);
            } else {
                // Show value and/or policy
                const hasV = currentV.length > 0;
                const hasP = currentPolicy.length > 0;

                if (hasV && (displayMode === 'values' || displayMode === 'both')) {
                    const valSpan = document.createElement('span');
                    valSpan.className = 'cell-value';
                    valSpan.textContent = currentV[r][c].toFixed(2);
                    el.appendChild(valSpan);
                }
                if (hasP && (displayMode === 'policy' || displayMode === 'both')) {
                    const arrSpan = document.createElement('span');
                    arrSpan.className = 'cell-arrow';
                    arrSpan.textContent = ARROWS[currentPolicy[r][c]] || currentPolicy[r][c];
                    el.appendChild(arrSpan);
                }

                // Show init policy arrow if PI manual mode and no result yet
                if (!hasV && !hasP && selectedAlgo === 'pi' && piInitMode === 'manual') {
                    const initSpan = document.createElement('span');
                    initSpan.className = 'cell-init-arrow';
                    initSpan.textContent = ARROWS[initPolicy[r][c]] || '?';
                    el.appendChild(initSpan);
                }
                if (!hasV && !hasP && selectedAlgo === 'pi' && piInitMode === 'uniform') {
                    const initSpan = document.createElement('span');
                    initSpan.className = 'cell-init-arrow';
                    initSpan.textContent = ARROWS[uniformDirection];
                    el.appendChild(initSpan);
                }
            }

            el.addEventListener('click', () => onCellClick(r, c));
            gridEl.appendChild(el);
        }
    }
}

// ── Cell Interaction ──
function onCellClick(r, c) {
    selectedCell = { r, c };
    const cell = cells[r][c];
    document.getElementById('selectedCellText').textContent =
        `(${r}, ${c}) — ${cell.type}${cell.type === 'terminal' ? ` [${cell.reward}]` : ''}`;

    if (cell.type === 'terminal') {
        document.getElementById('terminalRewardGroup').style.display = '';
        document.getElementById('terminalReward').value = cell.reward;
    } else {
        document.getElementById('terminalRewardGroup').style.display = 'none';
    }

    renderGrid();
}

function setCellType(type) {
    if (!selectedCell) { alert('Hãy click chọn 1 ô trên grid trước!'); return; }
    const { r, c } = selectedCell;
    if (type === 'terminal') {
        const reward = parseFloat(document.getElementById('terminalReward').value) || 1;
        cells[r][c] = { type: 'terminal', reward };
        document.getElementById('terminalRewardGroup').style.display = '';
        document.getElementById('terminalReward').value = reward;
    } else {
        cells[r][c] = { type, reward: 0 };
        document.getElementById('terminalRewardGroup').style.display = 'none';
    }
    document.getElementById('selectedCellText').textContent =
        `(${r}, ${c}) — ${cells[r][c].type}${cells[r][c].type === 'terminal' ? ` [${cells[r][c].reward}]` : ''}`;
    currentV = [];
    currentPolicy = [];
    renderGrid();
}

function applyTerminalReward() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (cells[r][c].type !== 'terminal') return;
    cells[r][c].reward = parseFloat(document.getElementById('terminalReward').value) || 0;
    currentV = [];
    currentPolicy = [];
    renderGrid();
}

// ── Algorithm Selection ──
function selectAlgo(algo) {
    selectedAlgo = algo;
    document.getElementById('btnVI').classList.toggle('active', algo === 'vi');
    document.getElementById('btnPI').classList.toggle('active', algo === 'pi');
    document.getElementById('piInitSection').style.display = algo === 'pi' ? '' : 'none';
    currentV = [];
    currentPolicy = [];
    renderGrid();
}

function onPiInitChange() {
    const selected = document.querySelector('input[name="piInit"]:checked').value;
    piInitMode = selected;
    document.getElementById('uniformDirGroup').style.display = selected === 'uniform' ? '' : 'none';
    document.getElementById('manualPolicyHint').style.display = selected === 'manual' ? '' : 'none';
    renderGrid();
}

function setUniformDir(dir) {
    uniformDirection = dir;
    document.querySelectorAll('#uniformDirGroup .btn-dir').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dir === dir);
    });
    // Update all initPolicy
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (cells[r][c].type === 'empty') {
                initPolicy[r][c] = dir;
            }
        }
    }
    renderGrid();
}

function setManualDir(dir) {
    if (!selectedCell) { alert('Click chọn 1 ô trên grid trước!'); return; }
    const { r, c } = selectedCell;
    if (cells[r][c].type !== 'empty') { alert('Chỉ set hướng cho ô Empty!'); return; }
    initPolicy[r][c] = dir;
    renderGrid();
}

// ── Display Toggle ──
function toggleDisplay(mode) {
    displayMode = mode;
    document.getElementById('btnShowValues').classList.toggle('active', mode === 'values');
    document.getElementById('btnShowPolicy').classList.toggle('active', mode === 'policy');
    document.getElementById('btnShowBoth').classList.toggle('active', mode === 'both');
    renderGrid();
}

// ── MDP Core Functions ──
function inBounds(r, c) {
    return r >= 0 && r < gridRows && c >= 0 && c < gridCols;
}

function getNextState(r, c, action) {
    const [dr, dc] = ACTIONS[action];
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return [r, c];
    if (cells[nr][nc].type === 'blocked') return [r, c];
    return [nr, nc];
}

function getReward(r, c, action, nr, nc, stepReward) {
    if (cells[nr][nc].type === 'terminal') return cells[nr][nc].reward;
    return stepReward;
}

function getTerminals() {
    const t = {};
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (cells[r][c].type === 'terminal') {
                t[`${r},${c}`] = cells[r][c].reward;
            }
        }
    }
    return t;
}

function isTerminal(r, c) {
    return cells[r][c].type === 'terminal';
}

function isBlocked(r, c) {
    return cells[r][c].type === 'blocked';
}

// ── Value Iteration ──
function runValueIteration(gamma, theta, stepReward) {
    const V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    const terminals = getTerminals();
    let iterations = 0;
    let finalDelta = Infinity;

    const logLines = [];
    logLines.push({ type: 'header', text: '═══ Value Iteration ═══' });

    while (iterations < 10000) {
        iterations++;
        let delta = 0;
        const newV = V.map(row => [...row]);

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c) || isTerminal(r, c)) {
                    newV[r][c] = 0;
                    continue;
                }
                let bestVal = -Infinity;
                for (const a of ACTION_KEYS) {
                    const [nr, nc] = getNextState(r, c, a);
                    const reward = getReward(r, c, a, nr, nc, stepReward);
                    const val = reward + gamma * V[nr][nc];
                    bestVal = Math.max(bestVal, val);
                }
                newV[r][c] = bestVal;
                delta = Math.max(delta, Math.abs(newV[r][c] - V[r][c]));
            }
        }
        for (let r = 0; r < gridRows; r++) V[r] = newV[r];
        finalDelta = delta;
        if (delta < theta) break;
    }

    // Extract policy
    const policy = Array.from({ length: gridRows }, () => Array(gridCols).fill(''));
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c)) { policy[r][c] = '#'; continue; }
            if (isTerminal(r, c)) { policy[r][c] = 'T'; continue; }
            let bestA = 'U', bestVal = -Infinity;
            for (const a of ACTION_KEYS) {
                const [nr, nc] = getNextState(r, c, a);
                const reward = getReward(r, c, a, nr, nc, stepReward);
                const val = reward + gamma * V[nr][nc];
                if (val > bestVal) { bestVal = val; bestA = a; }
            }
            policy[r][c] = bestA;
        }
    }

    logLines.push({ type: 'entry', text: `Hội tụ sau ${iterations} vòng lặp` });
    logLines.push({ type: 'entry', text: `Delta cuối: ${finalDelta.toFixed(8)}` });

    return { V, policy, logLines };
}

// ── Policy Iteration ──
function runPolicyIteration(gamma, theta, stepReward) {
    // Build initial policy
    const policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c)) { policy[r][c] = '#'; continue; }
            if (isTerminal(r, c)) { policy[r][c] = 'T'; continue; }
            if (piInitMode === 'uniform') {
                policy[r][c] = uniformDirection;
            } else if (piInitMode === 'random') {
                policy[r][c] = ACTION_KEYS[Math.floor(Math.random() * 4)];
            } else {
                policy[r][c] = initPolicy[r][c] || 'U';
            }
        }
    }

    const logLines = [];
    logLines.push({ type: 'header', text: '═══ Policy Iteration ═══' });

    // Show init policy
    logLines.push({ type: 'entry', text: 'Policy ban đầu:' });
    for (let r = 0; r < gridRows; r++) {
        let row = '  ';
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c)) row += ' # ';
            else if (isTerminal(r, c)) row += ' T ';
            else row += ' ' + (ARROWS[policy[r][c]] || '?') + ' ';
        }
        logLines.push({ type: 'entry', text: row });
    }

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let iterations = 0;

    while (iterations < 10000) {
        iterations++;
        logLines.push({ type: 'iteration', text: `── Vòng lặp ${iterations} ──` });

        // Policy Evaluation
        logLines.push({ type: 'entry', text: '  Bước 1: Policy Evaluation' });
        V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
        let evalSweeps = 0;
        while (true) {
            evalSweeps++;
            let delta = 0;
            const newV = V.map(row => [...row]);
            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    if (isBlocked(r, c) || isTerminal(r, c)) { newV[r][c] = 0; continue; }
                    const a = policy[r][c];
                    if (!a || a === '#' || a === 'T') continue;
                    const [nr, nc] = getNextState(r, c, a);
                    const reward = getReward(r, c, a, nr, nc, stepReward);
                    newV[r][c] = reward + gamma * V[nr][nc];
                    delta = Math.max(delta, Math.abs(newV[r][c] - V[r][c]));
                }
            }
            for (let r = 0; r < gridRows; r++) V[r] = newV[r];
            if (delta < theta) {
                logLines.push({ type: 'sweep', text: `    Hội tụ sau ${evalSweeps} sweep (Δ=${delta.toFixed(8)})` });
                break;
            }
        }

        // Show V
        logLines.push({ type: 'entry', text: '    V(s) sau Evaluation:' });
        for (let r = 0; r < gridRows; r++) {
            let row = '    ';
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c)) row += '#####  ';
                else row += V[r][c].toFixed(2).padStart(5) + '  ';
            }
            logLines.push({ type: 'entry', text: row });
        }

        // Policy Improvement
        logLines.push({ type: 'entry', text: '  Bước 2: Policy Improvement' });
        let stable = true;
        const changes = [];

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c) || isTerminal(r, c)) continue;
                const oldA = policy[r][c];
                let bestA = 'U', bestVal = -Infinity;
                for (const a of ACTION_KEYS) {
                    const [nr, nc] = getNextState(r, c, a);
                    const reward = getReward(r, c, a, nr, nc, stepReward);
                    const val = reward + gamma * V[nr][nc];
                    if (val > bestVal) { bestVal = val; bestA = a; }
                }
                if (oldA !== bestA) {
                    stable = false;
                    changes.push({ r, c, from: oldA, to: bestA });
                }
                policy[r][c] = bestA;
            }
        }

        if (changes.length > 0) {
            logLines.push({ type: 'entry', text: `    ${changes.length} ô thay đổi:` });
            for (const ch of changes) {
                logLines.push({
                    type: 'change',
                    text: `      (${ch.r},${ch.c}): ${ARROWS[ch.from]} → ${ARROWS[ch.to]}`
                });
            }
        } else {
            logLines.push({ type: 'stable', text: '    Không có ô nào thay đổi → Policy ổn định!' });
        }

        // Show policy
        logLines.push({ type: 'entry', text: '    Policy sau Improvement:' });
        for (let r = 0; r < gridRows; r++) {
            let row = '    ';
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c)) row += ' # ';
                else if (isTerminal(r, c)) row += ' T ';
                else row += ' ' + (ARROWS[policy[r][c]] || '?') + ' ';
            }
            logLines.push({ type: 'entry', text: row });
        }

        if (stable) {
            logLines.push({ type: 'stable', text: `✓ Policy STABLE! Kết thúc sau ${iterations} vòng.` });
            break;
        } else {
            logLines.push({ type: 'entry', text: '  → Chưa ổn định, tiếp tục...' });
        }
    }

    return { V, policy, logLines, iterations };
}

// ── Run ──
function runAlgorithm() {
    // Validate: at least 1 terminal
    let hasTerminal = false;
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (cells[r][c].type === 'terminal') hasTerminal = true;
        }
    }
    if (!hasTerminal) {
        alert('Cần ít nhất 1 ô Terminal! Click chọn 1 ô rồi chọn Terminal.');
        return;
    }

    const gamma = parseFloat(document.getElementById('gamma').value) || 0.9;
    const theta = parseFloat(document.getElementById('theta').value) || 0.0001;
    const stepReward = parseFloat(document.getElementById('stepReward').value);

    let result;
    if (selectedAlgo === 'vi') {
        result = runValueIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else {
        result = runPolicyIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    }

    currentV = result.V;
    currentPolicy = result.policy;

    // Show log panel
    document.getElementById('logPanel').style.display = '';
    document.querySelector('.main-layout').classList.remove('no-log');
    renderLog(result.logLines);
    renderGrid();

    // Show reset
    document.getElementById('btnReset').style.display = '';
}

function resetAlgorithm() {
    currentV = [];
    currentPolicy = [];
    isRunning = false;
    document.getElementById('btnReset').style.display = 'none';
    document.getElementById('btnStep').style.display = 'none';
    renderGrid();
}

// ── Log ──
function renderLog(logLines) {
    const logEl = document.getElementById('logContent');
    logEl.innerHTML = '';
    for (const line of logLines) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        if (line.type === 'header') div.className = 'log-header';
        else if (line.type === 'iteration') div.className = 'log-entry log-iteration';
        else if (line.type === 'change') div.className = 'log-entry log-change';
        else if (line.type === 'stable') div.className = 'log-entry log-stable';
        else if (line.type === 'sweep') div.className = 'log-entry log-sweep';
        div.textContent = line.text;
        logEl.appendChild(div);
    }
    logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
    document.getElementById('logContent').innerHTML = '';
}

// ── Step-through (future enhancement) ──
function stepAlgorithm() {
    // placeholder for step-by-step mode
}
