/* =========================================================
   GridWorld MDP Visualizer – Application Logic
   ========================================================= */

// ── Constants ──
const ACTIONS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const ACTION_KEYS = ['U', 'D', 'L', 'R'];
const ARROWS = { U: '↑', D: '↓', L: '←', R: '→' };

// ── State ──
let gridRows = 0, gridCols = 0;
let cells = [];          // 2D: { type:'empty'|'blocked'|'terminal'|'start', reward:0 }
let startCell = null;    // {r, c}
let selectedCell = null; // { r, c }
let selectedAlgo = 'vi';
let piInitMode = 'uniform';
let uniformDirection = 'U';
let initPolicy = [];     // 2D: action string
let currentV = [];       // 2D: float
let currentPolicy = [];  // 2D: action string
let displayMode = 'both';
let isRunning = false;
let isStochastic = false;
let slipProb = 0.2;
let qMatrix = [];        // 2D: { U, D, L, R }
let logLines = [];       // Lưu log toàn cục để render dần

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Simulation State ──
let simInterval = null;
let agentPos = null;
let simG = 0;
let simGammaPower = 1;
let simStepCount = 0;

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

    for (let r = 0; r < m; r++) {
        cells[r] = [];
        initPolicy[r] = [];
        qMatrix[r] = [];
        for (let c = 0; c < n; c++) {
            cells[r][c] = { type: 'empty', reward: 0 };
            initPolicy[r][c] = 'U';
            qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
        }
    }

    currentV = [];
    currentPolicy = [];
    selectedCell = null;
    startCell = null;
    resetSimulation();

    // Show panels
    document.getElementById('cellEditorCard').style.display = '';
    document.getElementById('paramsCard').style.display = '';
    document.getElementById('algoCard').style.display = '';
    document.getElementById('gridPlaceholder').style.display = 'none';
    document.getElementById('gridWrapper').style.display = '';
    document.getElementById('gridLabel').textContent = `${m} × ${n} Grid`;
    
    // Default show simCard
    document.getElementById('simCard').style.display = '';

    renderGrid();
}

function renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.style.gridTemplateColumns = `repeat(${gridCols}, 80px)`;
    gridEl.innerHTML = '';

    // Create Agent Marker
    let agentEl = document.getElementById('agentMarker');
    if (!agentEl) {
        agentEl = document.createElement('div');
        agentEl.id = 'agentMarker';
        agentEl.className = 'agent-marker';
        agentEl.style.display = 'none';
        gridEl.appendChild(agentEl);
    }

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
            } else if (cell.type === 'start') {
                el.classList.add('start');
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
                if (hasV && displayMode === 'qsa') {
                    const qValues = qMatrix[r][c] || {U:0, D:0, L:0, R:0};
                    let bestA = 'U', bestVal = -Infinity;
                    for (const a of ACTION_KEYS) {
                        if (qValues[a] > bestVal) { bestVal = qValues[a]; bestA = a; }
                    }
                    
                    const qContainer = document.createElement('div');
                    qContainer.className = 'cell-q-container';
                    
                    const elU = document.createElement('div'); elU.className = `cell-q-val cell-q-u ${bestA === 'U' ? 'cell-q-best' : ''}`; elU.textContent = qValues['U'].toFixed(2);
                    const elD = document.createElement('div'); elD.className = `cell-q-val cell-q-d ${bestA === 'D' ? 'cell-q-best' : ''}`; elD.textContent = qValues['D'].toFixed(2);
                    const elL = document.createElement('div'); elL.className = `cell-q-val cell-q-l ${bestA === 'L' ? 'cell-q-best' : ''}`; elL.textContent = qValues['L'].toFixed(2);
                    const elR = document.createElement('div'); elR.className = `cell-q-val cell-q-r ${bestA === 'R' ? 'cell-q-best' : ''}`; elR.textContent = qValues['R'].toFixed(2);
                    
                    qContainer.appendChild(elU);
                    qContainer.appendChild(elD);
                    qContainer.appendChild(elL);
                    qContainer.appendChild(elR);
                    
                    el.appendChild(qContainer);
                }

                // Show init policy arrow if PI/PE manual mode and no result yet
                if (!hasV && !hasP && (selectedAlgo === 'pi' || selectedAlgo === 'pe') && piInitMode === 'manual') {
                    const initSpan = document.createElement('span');
                    initSpan.className = 'cell-init-arrow';
                    initSpan.textContent = ARROWS[initPolicy[r][c]] || '?';
                    el.appendChild(initSpan);
                }
                if (!hasV && !hasP && (selectedAlgo === 'pi' || selectedAlgo === 'pe') && piInitMode === 'uniform') {
                    const initSpan = document.createElement('span');
                    initSpan.className = 'cell-init-arrow';
                    initSpan.textContent = ARROWS[uniformDirection];
                    el.appendChild(initSpan);
                }
            }

            // Events
            el.addEventListener('click', () => onCellClick(r, c));
            el.addEventListener('mouseenter', (e) => onCellHover(r, c, e));
            el.addEventListener('mouseleave', hideTooltip);

            gridEl.appendChild(el);
        }
    }
    
    updateAgentPosition();
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
    
    // Clear old start cell if setting new one
    if (type === 'start') {
        if (startCell) {
            cells[startCell.r][startCell.c] = { type: 'empty', reward: 0 };
        }
        startCell = { r, c };
        cells[r][c] = { type: 'start', reward: 0 };
        document.getElementById('terminalRewardGroup').style.display = 'none';
    } else if (type === 'terminal') {
        if (startCell && startCell.r === r && startCell.c === c) startCell = null;
        const reward = parseFloat(document.getElementById('terminalReward').value) || 1;
        cells[r][c] = { type: 'terminal', reward };
        document.getElementById('terminalRewardGroup').style.display = '';
        document.getElementById('terminalReward').value = reward;
    } else {
        if (startCell && startCell.r === r && startCell.c === c) startCell = null;
        cells[r][c] = { type, reward: 0 };
        document.getElementById('terminalRewardGroup').style.display = 'none';
    }
    
    document.getElementById('selectedCellText').textContent =
        `(${r}, ${c}) — ${cells[r][c].type}${cells[r][c].type === 'terminal' ? ` [${cells[r][c].reward}]` : ''}`;
    currentV = [];
    currentPolicy = [];
    resetSimulation();
    renderGrid();
}

function applyTerminalReward() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (cells[r][c].type !== 'terminal') return;
    cells[r][c].reward = parseFloat(document.getElementById('terminalReward').value) || 0;
    currentV = [];
    currentPolicy = [];
    resetSimulation();
    renderGrid();
}

// ── Tooltip Q-Value ──
function onCellHover(r, c, event) {
    if (currentV.length === 0 || cells[r][c].type === 'blocked' || cells[r][c].type === 'terminal' || displayMode === 'qsa') {
        hideTooltip();
        return;
    }
    
    const qValues = qMatrix[r][c] || {U:0, D:0, L:0, R:0};
    let bestA = 'U', bestVal = -Infinity;
    
    for (const a of ACTION_KEYS) {
        if (qValues[a] > bestVal) { bestVal = qValues[a]; bestA = a; }
    }
    
    const tooltip = document.getElementById('qTooltip');
    const elU = document.getElementById('qValU');
    const elD = document.getElementById('qValD');
    const elL = document.getElementById('qValL');
    const elR = document.getElementById('qValR');
    
    elU.textContent = qValues['U'].toFixed(2);
    elD.textContent = qValues['D'].toFixed(2);
    elL.textContent = qValues['L'].toFixed(2);
    elR.textContent = qValues['R'].toFixed(2);
    
    [elU, elD, elL, elR].forEach(el => el.classList.remove('best-action'));
    if (bestA === 'U') elU.classList.add('best-action');
    if (bestA === 'D') elD.classList.add('best-action');
    if (bestA === 'L') elL.classList.add('best-action');
    if (bestA === 'R') elR.classList.add('best-action');
    
    tooltip.style.display = 'grid';
    // Position near cursor
    tooltip.style.left = (event.pageX + 15) + 'px';
    tooltip.style.top = (event.pageY + 15) + 'px';
}

function hideTooltip() {
    document.getElementById('qTooltip').style.display = 'none';
}

document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('qTooltip');
    if (tooltip.style.display !== 'none') {
        tooltip.style.left = (e.pageX + 15) + 'px';
        tooltip.style.top = (e.pageY + 15) + 'px';
    }
});

// ── Environment Settings ──
function toggleStochasticParams() {
    const isStoch = document.getElementById('isStochastic').checked;
    document.getElementById('stochParams').style.display = isStoch ? 'block' : 'none';
    if (isStoch) updateStochFormula();
}

function updateStochFormula() {
    slipProb = parseFloat(document.getElementById('slipProb').value);
    if (isNaN(slipProb)) slipProb = 0.2;
    if (slipProb < 0) slipProb = 0;
    if (slipProb > 1) slipProb = 1;
    
    const straight = (1 - slipProb).toFixed(2);
    const side = (slipProb / 2).toFixed(2);
    const formulaDiv = document.getElementById('stochFormula');
    
    formulaDiv.innerHTML = `\\( p(s'|s,a) = \\begin{cases} 
                            ${straight} & \\text{hướng } a \\\\ 
                            ${side} & \\text{vuông góc 1} \\\\ 
                            ${side} & \\text{vuông góc 2} 
                            \\end{cases} \\)`;
                            
    if (window.MathJax) {
        MathJax.typesetPromise([formulaDiv]);
    }
}

// ── Algorithm Selection ──
function selectAlgo(algo) {
    selectedAlgo = algo;
    document.getElementById('btnVI').classList.toggle('active', algo === 'vi');
    document.getElementById('btnPI').classList.toggle('active', algo === 'pi');
    document.getElementById('btnPE').classList.toggle('active', algo === 'pe');
    
    document.getElementById('btnMCOn').classList.toggle('active', algo === 'mc_on');
    document.getElementById('btnMCOff').classList.toggle('active', algo === 'mc_off');
    
    document.getElementById('btnQL').classList.toggle('active', algo === 'ql');
    document.getElementById('btnSARSA').classList.toggle('active', algo === 'sarsa');
    document.getElementById('btnESARSA').classList.toggle('active', algo === 'esarsa');
    document.getElementById('btnDQL').classList.toggle('active', algo === 'dql');
    
    const isTD = ['ql', 'sarsa', 'esarsa', 'dql'].includes(algo);
    const isMC = ['mc_on', 'mc_off'].includes(algo);
    
    document.getElementById('piInitSection').style.display = (algo === 'pi' || algo === 'pe') ? '' : 'none';
    document.getElementById('mfParams').style.display = (isTD || isMC) ? '' : 'none';
    document.getElementById('alphaGroup').style.display = isTD ? '' : 'none';
    
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
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (cells[r][c].type === 'empty' || cells[r][c].type === 'start') {
                initPolicy[r][c] = dir;
            }
        }
    }
    renderGrid();
}

function setManualDir(dir) {
    if (!selectedCell) { alert('Click chọn 1 ô trên grid trước!'); return; }
    const { r, c } = selectedCell;
    if (cells[r][c].type === 'blocked' || cells[r][c].type === 'terminal') { alert('Không set hướng cho ô bị lấp hoặc terminal!'); return; }
    initPolicy[r][c] = dir;
    renderGrid();
}

function toggleDisplay(mode) {
    displayMode = mode;
    document.getElementById('btnShowValues').classList.toggle('active', mode === 'values');
    document.getElementById('btnShowPolicy').classList.toggle('active', mode === 'policy');
    document.getElementById('btnShowBoth').classList.toggle('active', mode === 'both');
    document.getElementById('btnShowQ').classList.toggle('active', mode === 'qsa');
    renderGrid();
}

// ── MDP Core Functions ──
function inBounds(r, c) {
    return r >= 0 && r < gridRows && c >= 0 && c < gridCols;
}

function getActualNextState(r, c, dr, dc) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return {nr: r, nc: c};
    if (cells[nr][nc].type === 'blocked') return {nr: r, nc: c};
    return {nr, nc};
}

function getNextStateProbabilities(r, c, action) {
    // Return array of {nr, nc, prob}
    const [dr, dc] = ACTIONS[action];
    
    if (!isStochastic) {
        const {nr, nc} = getActualNextState(r, c, dr, dc);
        return [{nr, nc, prob: 1.0}];
    }
    
    // Stochastic
    let leftAction, rightAction;
    if (action === 'U') { leftAction = 'L'; rightAction = 'R'; }
    else if (action === 'D') { leftAction = 'R'; rightAction = 'L'; }
    else if (action === 'L') { leftAction = 'D'; rightAction = 'U'; }
    else if (action === 'R') { leftAction = 'U'; rightAction = 'D'; }
    
    const [ldr, ldc] = ACTIONS[leftAction];
    const [rdr, rdc] = ACTIONS[rightAction];
    
    const pStraight = 1 - slipProb;
    const pSide = slipProb / 2;

    const outcomes = [
        {dr: dr, dc: dc, p: pStraight},
        {dr: ldr, dc: ldc, p: pSide},
        {dr: rdr, dc: rdc, p: pSide}
    ];
    
    const map = {};
    for (const out of outcomes) {
        const {nr, nc} = getActualNextState(r, c, out.dr, out.dc);
        const key = `${nr},${nc}`;
        if (!map[key]) map[key] = {nr, nc, prob: 0};
        map[key].prob += out.p;
    }
    
    return Object.values(map);
}

function getReward(r, c, action, nr, nc, stepReward) {
    if (cells[nr][nc].type === 'terminal') return cells[nr][nc].reward;
    return stepReward;
}

function isTerminal(r, c) { return cells[r][c].type === 'terminal'; }
function isBlocked(r, c) { return cells[r][c].type === 'blocked'; }

// ── Tính toán Q Matrix từ V(s) (cho VI/PI/PE) ──
function computeFullQMatrix(V, gamma, stepReward) {
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c) || isTerminal(r, c)) continue;
            for (const a of ACTION_KEYS) {
                const probs = getNextStateProbabilities(r, c, a);
                let q = 0;
                for (const p of probs) {
                    const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                    q += p.prob * (reward + gamma * V[p.nr][p.nc]);
                }
                qMatrix[r][c][a] = q;
            }
        }
    }
}

// ── Value Iteration ──
async function runValueIteration(gamma, theta, stepReward) {
    const isAsyncDP = document.getElementById('isAsyncDP').checked;
    const V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let iterations = 0;
    let finalDelta = Infinity;

    logLines = [];
    logLines.push({ type: 'header', text: `═══ Value Iteration (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
    logLines.push({ type: 'entry', text: `Chế độ: ${isAsyncDP ? 'Asynchronous (In-place)' : 'Synchronous'}` });
    renderLog();

    while (iterations < 10000) {
        iterations++;
        let delta = 0;
        const newV = isAsyncDP ? V : V.map(row => [...row]);

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c) || isTerminal(r, c)) {
                    newV[r][c] = 0;
                    continue;
                }
                let bestVal = -Infinity;
                for (const a of ACTION_KEYS) {
                    const probs = getNextStateProbabilities(r, c, a);
                    let expectedVal = 0;
                    for (const p of probs) {
                        const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                        expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                    }
                    bestVal = Math.max(bestVal, expectedVal);
                }
                const diff = Math.abs(bestVal - V[r][c]);
                newV[r][c] = bestVal;
                delta = Math.max(delta, diff);
            }
        }
        if (!isAsyncDP) {
            for (let r = 0; r < gridRows; r++) V[r] = newV[r];
        }
        finalDelta = delta;
        
        // Cập nhật UI ngay lập tức
        currentV = V;
        renderGrid();
        await sleep(50); // Delay nhỏ để nhìn thấy hiệu ứng Sweep

        if (delta < theta) break;
    }

    // Extract policy
    const policy = extractPolicy(V, gamma, stepReward);
    computeFullQMatrix(V, gamma, stepReward);
    currentPolicy = policy;
    renderGrid();

    logLines.push({ type: 'entry', text: `Hội tụ sau ${iterations} vòng lặp` });
    logLines.push({ type: 'entry', text: `Delta cuối: ${finalDelta.toFixed(8)}` });
    renderLog();

    return { V, policy };
}

function extractPolicy(V, gamma, stepReward) {
    const policy = Array.from({ length: gridRows }, () => Array(gridCols).fill(''));
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c)) { policy[r][c] = '#'; continue; }
            if (isTerminal(r, c)) { policy[r][c] = 'T'; continue; }
            let bestA = 'U', bestVal = -Infinity;
            for (const a of ACTION_KEYS) {
                const probs = getNextStateProbabilities(r, c, a);
                let expectedVal = 0;
                for (const p of probs) {
                    const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                    expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                }
                if (expectedVal > bestVal) { bestVal = expectedVal; bestA = a; }
            }
            policy[r][c] = bestA;
        }
    }
    return policy;
}

// ── Policy Iteration ──
function getInitialPolicy() {
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
    return policy;
}

async function evaluatePolicyFixed(policy, V, gamma, theta, stepReward, maxSweeps = 0) {
    let evalSweeps = 0;
    const isAsyncDP = document.getElementById('isAsyncDP').checked;
    while (true) {
        evalSweeps++;
        let delta = 0;
        const newV = isAsyncDP ? V : V.map(row => [...row]);
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c) || isTerminal(r, c)) { newV[r][c] = 0; continue; }
                const a = policy[r][c];
                if (!a || a === '#' || a === 'T') continue;
                
                const probs = getNextStateProbabilities(r, c, a);
                let expectedVal = 0;
                for (const p of probs) {
                    const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                    expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                }
                const diff = Math.abs(expectedVal - V[r][c]);
                newV[r][c] = expectedVal;
                delta = Math.max(delta, diff);
            }
        }
        if (!isAsyncDP) {
            for (let r = 0; r < gridRows; r++) V[r] = newV[r];
        }
        
        currentV = V;
        renderGrid();
        await sleep(20); // Render nhanh cho PE sweeps

        if (maxSweeps > 0 && evalSweeps >= maxSweeps) return { sweeps: evalSweeps, converged: false };
        if (delta < theta) return { sweeps: evalSweeps, converged: true };
    }
}

async function runPolicyIteration(gamma, theta, stepReward) {
    const isAsyncDP = document.getElementById('isAsyncDP').checked;
    const kSweeps = parseInt(document.getElementById('kSweeps').value) || 0;
    const policy = getInitialPolicy();
    logLines = [];
    logLines.push({ type: 'header', text: `═══ Policy Iteration (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
    logLines.push({ type: 'entry', text: `Cập nhật: ${isAsyncDP ? 'Asynchronous' : 'Synchronous'}, k = ${kSweeps > 0 ? kSweeps : '∞'}` });
    renderLog();

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let iterations = 0;

    currentPolicy = policy;
    renderGrid();
    await sleep(300); // Ngưng 1 chút để xem policy ban đầu

    while (iterations < 10000) {
        iterations++;
        logLines.push({ type: 'iteration', text: `── Vòng lặp ${iterations} ──` });
        renderLog();

        // Policy Evaluation
        const res = await evaluatePolicyFixed(policy, V, gamma, theta, stepReward, kSweeps);
        logLines.push({ type: 'sweep', text: `    Đánh giá dừng sau ${res.sweeps} sweep (${res.converged ? 'Hội tụ' : 'Đạt k'})` });
        renderLog();
        
        await sleep(100);

        // Policy Improvement
        let stable = true;
        const changes = [];

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (isBlocked(r, c) || isTerminal(r, c)) continue;
                const oldA = policy[r][c];
                let bestA = 'U', bestVal = -Infinity;
                for (const a of ACTION_KEYS) {
                    const probs = getNextStateProbabilities(r, c, a);
                    let expectedVal = 0;
                    for (const p of probs) {
                        const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                        expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                    }
                    if (expectedVal > bestVal) { bestVal = expectedVal; bestA = a; }
                }
                if (oldA !== bestA) {
                    stable = false;
                    changes.push({ r, c, from: oldA, to: bestA });
                }
                policy[r][c] = bestA;
            }
        }

        currentPolicy = policy;
        renderGrid();

        if (changes.length > 0) {
            logLines.push({ type: 'entry', text: `    ${changes.length} ô thay đổi` });
        }
        renderLog();

        await sleep(200);

        if (stable && res.converged) {
            logLines.push({ type: 'stable', text: `✓ Policy STABLE! Kết thúc sau ${iterations} vòng.` });
            renderLog();
            break;
        } else if (stable && !res.converged) {
            logLines.push({ type: 'entry', text: `    Policy không đổi nhưng V(s) chưa hội tụ -> tiếp tục.` });
            renderLog();
        }
    }

    computeFullQMatrix(V, gamma, stepReward);
    return { V, policy };
}

// ── Policy Evaluation Standalone ──
async function runPolicyEvaluationStandalone(gamma, theta, stepReward) {
    const isAsyncDP = document.getElementById('isAsyncDP').checked;
    const kSweeps = parseInt(document.getElementById('kSweeps').value) || 0;
    const policy = getInitialPolicy();
    logLines = [];
    logLines.push({ type: 'header', text: `═══ Evaluate Current Policy (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
    logLines.push({ type: 'entry', text: `Chỉ tính V(s) cho Policy hiện hành, KHÔNG tối ưu.` });
    logLines.push({ type: 'entry', text: `Cập nhật: ${isAsyncDP ? 'Asynchronous' : 'Synchronous'}, Max Sweeps: ${kSweeps > 0 ? kSweeps : '∞'}` });
    renderLog();

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    currentPolicy = policy;
    const res = await evaluatePolicyFixed(policy, V, gamma, theta, stepReward, kSweeps);
    
    logLines.push({ type: 'sweep', text: `Dừng sau ${res.sweeps} sweep (${res.converged ? 'Hội tụ' : 'Đạt k max'})` });
    computeFullQMatrix(V, gamma, stepReward);
    renderLog();
    return { V, policy };
}

// ── Monte Carlo Control (Episodic Model-Free) ──
async function runMonteCarloControl(algo, epsilon, episodes, gamma, stepReward) {
    if (!startCell) {
        alert('Cần đặt Start State để chạy Monte Carlo!');
        return { V: currentV, policy: currentPolicy };
    }

    const algoNames = { mc_on: 'On-policy MC Control', mc_off: 'Off-policy MC Control' };
    logLines = [];
    logLines.push({ type: 'header', text: `═══ ${algoNames[algo]} ═══` });
    renderLog();

    let returns = [];
    let C = [];
    for (let r = 0; r < gridRows; r++) {
        returns[r] = [];
        C[r] = [];
        for (let c = 0; c < gridCols; c++) {
            qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
            returns[r][c] = { U: {sum:0, count:0}, D: {sum:0, count:0}, L: {sum:0, count:0}, R: {sum:0, count:0} };
            C[r][c] = { U: 0, D: 0, L: 0, R: 0 };
        }
    }

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    function getEpsilonGreedyAction(r, c, targetPolicy, eps) {
        if (Math.random() < eps) {
            return ACTION_KEYS[Math.floor(Math.random() * 4)];
        }
        return targetPolicy[r][c];
    }
    
    // Init greedy policy arbitrarily
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            policy[r][c] = ACTION_KEYS[Math.floor(Math.random() * 4)];
        }
    }

    for (let ep = 1; ep <= episodes; ep++) {
        let episode = []; 
        let currR = startCell.r;
        let currC = startCell.c;
        let steps = 0;
        
        agentPos = { r: currR, c: currC };
        updateAgentPosition();

        // 1. Generate Episode
        while (!isTerminal(currR, currC) && steps < 1000) {
            steps++;
            let action = getEpsilonGreedyAction(currR, currC, policy, epsilon);

            const probs = getNextStateProbabilities(currR, currC, action);
            const rand = Math.random();
            let cumulative = 0;
            let nextR = currR, nextC = currC;
            for (const p of probs) {
                cumulative += p.prob;
                if (rand <= cumulative) { nextR = p.nr; nextC = p.nc; break; }
            }

            const reward = getReward(currR, currC, action, nextR, nextC, stepReward);
            
            episode.push({ r: currR, c: currC, action, reward });
            currR = nextR;
            currC = nextC;
            
            agentPos = { r: currR, c: currC };
            renderGrid();
            await sleep(0); // Rất nhanh
        }

        // 2. Backward Update (G_t)
        if (isTerminal(currR, currC)) {
            let G = 0;
            let W = 1.0;
            
            for (let t = episode.length - 1; t >= 0; t--) {
                const step = episode[t];
                G = gamma * G + step.reward;

                if (algo === 'mc_on') {
                    // First-visit check
                    let isFirstVisit = true;
                    for (let i = 0; i < t; i++) {
                        if (episode[i].r === step.r && episode[i].c === step.c && episode[i].action === step.action) {
                            isFirstVisit = false;
                            break;
                        }
                    }
                    if (isFirstVisit) {
                        returns[step.r][step.c][step.action].sum += G;
                        returns[step.r][step.c][step.action].count += 1;
                        qMatrix[step.r][step.c][step.action] = returns[step.r][step.c][step.action].sum / returns[step.r][step.c][step.action].count;
                        
                        let bestA = 'U', bestQ = -Infinity;
                        for (const a of ACTION_KEYS) {
                            if (qMatrix[step.r][step.c][a] > bestQ) { bestQ = qMatrix[step.r][step.c][a]; bestA = a; }
                        }
                        policy[step.r][step.c] = bestA;
                    }
                } else if (algo === 'mc_off') {
                    C[step.r][step.c][step.action] += W;
                    qMatrix[step.r][step.c][step.action] += (W / C[step.r][step.c][step.action]) * (G - qMatrix[step.r][step.c][step.action]);
                    
                    let bestA = 'U', bestQ = -Infinity;
                    for (const a of ACTION_KEYS) {
                        if (qMatrix[step.r][step.c][a] > bestQ) { bestQ = qMatrix[step.r][step.c][a]; bestA = a; }
                    }
                    policy[step.r][step.c] = bestA;

                    if (step.action !== policy[step.r][step.c]) {
                        break; 
                    }
                    
                    let b_prob = epsilon / 4.0;
                    if (step.action === policy[step.r][step.c]) {
                        b_prob += (1.0 - epsilon);
                    }
                    W = W * (1.0 / b_prob);
                }
            }
        }
        
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (!isBlocked(r,c) && !isTerminal(r,c)) {
                    let bestQ = -Infinity;
                    for (const a of ACTION_KEYS) {
                        if (qMatrix[r][c][a] > bestQ) bestQ = qMatrix[r][c][a];
                    }
                    V[r][c] = bestQ === -Infinity ? 0 : bestQ;
                }
            }
        }

        currentV = V;
        currentPolicy = policy;
        renderGrid();
        
        if (ep % Math.ceil(episodes/10) === 0 || ep === episodes) {
            logLines.push({ type: 'entry', text: `Episode ${ep}/${episodes} completed.` });
            renderLog();
        }
        
        if (document.getElementById('qTableModal').style.display === 'flex') {
            renderQTable();
        }
    }
    
    agentPos = null;
    updateAgentPosition();
    return { V, policy };
}

// ── TD Learning Control (Model-Free) ──
async function runTDControl(algo, alpha, epsilon, episodes, gamma, stepReward) {
    if (!startCell) {
        alert('Cần đặt Start State để chạy TD Learning!');
        return { V: currentV, policy: currentPolicy };
    }

    const algoNames = { ql: 'Q-Learning', sarsa: 'SARSA', esarsa: 'Expected SARSA', dql: 'Double Q-Learning' };
    logLines = [];
    logLines.push({ type: 'header', text: `═══ ${algoNames[algo]} ═══` });
    renderLog();

    // Reset Q-Matrix
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
        }
    }
    
    let qMatrix1, qMatrix2;
    if (algo === 'dql') {
        qMatrix1 = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ U: 0, D: 0, L: 0, R: 0 })));
        qMatrix2 = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ U: 0, D: 0, L: 0, R: 0 })));
    }

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    function getEpsilonGreedyAction(r, c, Q) {
        if (Math.random() < epsilon) {
            return ACTION_KEYS[Math.floor(Math.random() * 4)];
        }
        let bestA = 'U', bestQ = -Infinity;
        for (const a of ACTION_KEYS) {
            if (Q[r][c][a] > bestQ) { bestQ = Q[r][c][a]; bestA = a; }
        }
        return bestA;
    }

    for (let ep = 1; ep <= episodes; ep++) {
        let r = startCell.r;
        let c = startCell.c;
        let steps = 0;
        
        agentPos = { r, c };
        updateAgentPosition();

        let action = (algo === 'sarsa' || algo === 'esarsa') ? getEpsilonGreedyAction(r, c, qMatrix) : null;

        while (!isTerminal(r, c) && steps < 500) {
            steps++;
            
            if (algo === 'ql' || algo === 'dql') {
                // For DQL, we use combined qMatrix for exploration
                action = getEpsilonGreedyAction(r, c, qMatrix);
            }

            // Take action
            const probs = getNextStateProbabilities(r, c, action);
            const rand = Math.random();
            let cumulative = 0;
            let nextR = r, nextC = c;
            for (const p of probs) {
                cumulative += p.prob;
                if (rand <= cumulative) { nextR = p.nr; nextC = p.nc; break; }
            }

            const reward = getReward(r, c, action, nextR, nextC, stepReward);
            
            let nextAction;
            if (algo === 'sarsa') {
                nextAction = isTerminal(nextR, nextC) ? null : getEpsilonGreedyAction(nextR, nextC, qMatrix);
            }

            if (algo === 'dql') {
                if (Math.random() < 0.5) {
                    // Update Q1
                    let maxA = 'U', maxQ = -Infinity;
                    if (!isTerminal(nextR, nextC)) {
                        for (const a of ACTION_KEYS) {
                            if (qMatrix1[nextR][nextC][a] > maxQ) { maxQ = qMatrix1[nextR][nextC][a]; maxA = a; }
                        }
                    }
                    const targetQ = isTerminal(nextR, nextC) ? 0 : qMatrix2[nextR][nextC][maxA];
                    qMatrix1[r][c][action] += alpha * (reward + gamma * targetQ - qMatrix1[r][c][action]);
                } else {
                    // Update Q2
                    let maxA = 'U', maxQ = -Infinity;
                    if (!isTerminal(nextR, nextC)) {
                        for (const a of ACTION_KEYS) {
                            if (qMatrix2[nextR][nextC][a] > maxQ) { maxQ = qMatrix2[nextR][nextC][a]; maxA = a; }
                        }
                    }
                    const targetQ = isTerminal(nextR, nextC) ? 0 : qMatrix1[nextR][nextC][maxA];
                    qMatrix2[r][c][action] += alpha * (reward + gamma * targetQ - qMatrix2[r][c][action]);
                }
                qMatrix[r][c][action] = (qMatrix1[r][c][action] + qMatrix2[r][c][action]) / 2;
            } else {
                let target = 0;
                if (!isTerminal(nextR, nextC)) {
                    if (algo === 'ql') {
                        target = Math.max(...Object.values(qMatrix[nextR][nextC]));
                    } else if (algo === 'sarsa') {
                        target = qMatrix[nextR][nextC][nextAction];
                    } else if (algo === 'esarsa') {
                        let maxQ = -Infinity;
                        let greedyCount = 0;
                        for (const a of ACTION_KEYS) {
                            if (qMatrix[nextR][nextC][a] > maxQ) maxQ = qMatrix[nextR][nextC][a];
                        }
                        for (const a of ACTION_KEYS) {
                            if (qMatrix[nextR][nextC][a] === maxQ) greedyCount++;
                        }
                        for (const a of ACTION_KEYS) {
                            let prob = epsilon / 4.0;
                            if (qMatrix[nextR][nextC][a] === maxQ) {
                                prob += (1.0 - epsilon) / greedyCount;
                            }
                            target += prob * qMatrix[nextR][nextC][a];
                        }
                    }
                }
                qMatrix[r][c][action] += alpha * (reward + gamma * target - qMatrix[r][c][action]);
            }

            // Update V and Policy for display
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) {
                if (qMatrix[r][c][a] > bestQ) { bestQ = qMatrix[r][c][a]; bestA = a; }
            }
            V[r][c] = bestQ;
            policy[r][c] = bestA;

            r = nextR;
            c = nextC;
            if (algo === 'sarsa') action = nextAction;
            
            agentPos = { r, c };
            currentV = V;
            currentPolicy = policy;
            renderGrid();
            
            await sleep(1); // Render speed
        }
        
        if (ep % Math.ceil(episodes/10) === 0 || ep === episodes) {
            logLines.push({ type: 'entry', text: `Episode ${ep}/${episodes} completed.` });
            renderLog();
        }
        
        if (document.getElementById('qTableModal').style.display === 'flex') {
            renderQTable();
        }
    }
    
    agentPos = null;
    updateAgentPosition();
    return { V, policy };
}

// ── Run Setup ──
async function runAlgorithm() {
    if (isRunning) return;
    isStochastic = document.getElementById('isStochastic').checked;
    
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

    // Show log panel
    document.getElementById('logPanel').style.display = '';
    document.querySelector('.main-layout').classList.remove('no-log');
    
    const btnRun = document.getElementById('btnRun');
    btnRun.disabled = true;
    btnRun.innerHTML = `<span class="run-icon">⏳</span> Đang Chạy...`;
    isRunning = true;
    
    currentV = [];
    currentPolicy = [];
    resetSimulation();

    const isTD = ['ql', 'sarsa', 'esarsa', 'dql'].includes(selectedAlgo);
    const isMC = ['mc_on', 'mc_off'].includes(selectedAlgo);
    let result;
    if (selectedAlgo === 'vi') {
        result = await runValueIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (selectedAlgo === 'pi') {
        result = await runPolicyIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (selectedAlgo === 'pe') {
        result = await runPolicyEvaluationStandalone(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isTD) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        result = await runTDControl(selectedAlgo, alpha, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isMC) {
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        result = await runMonteCarloControl(selectedAlgo, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    }

    currentV = result.V;
    currentPolicy = result.policy;
    renderGrid();
    
    btnRun.disabled = false;
    btnRun.innerHTML = `<span class="run-icon">▶</span> Chạy Thuật Toán`;
    isRunning = false;
}

// ── Log ──
function renderLog() {
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

// ── Agent Simulation ──
function updateAgentPosition() {
    const agentEl = document.getElementById('agentMarker');
    if (!agentEl) return;
    
    if (!agentPos) {
        agentEl.style.display = 'none';
        return;
    }
    
    agentEl.style.display = 'block';
    // Calculate position based on grid
    const cellEl = document.getElementById(`cell-${agentPos.r}-${agentPos.c}`);
    if (cellEl) {
        // Grid có padding 12px, cell 80px, gap 4px
        // Khoảng cách từ mép grid = padding + index * (cell + gap) + cell/2 - agent/2
        // = 12 + index * 84 + 40 - 12 = 40 + index * 84
        const left = 40 + agentPos.c * 84;
        const top = 40 + agentPos.r * 84; 
        
        agentEl.style.left = `${left}px`;
        agentEl.style.top = `${top}px`;
    }
}

function resetSimulation() {
    if (simInterval) clearInterval(simInterval);
    simInterval = null;
    agentPos = startCell ? { r: startCell.r, c: startCell.c } : null;
    simG = 0;
    simGammaPower = 1;
    simStepCount = 0;
    document.getElementById('simReturn').textContent = '0.00';
    updateAgentPosition();
}

function stepSimulation() {
    if (currentPolicy.length === 0) {
        alert('Cần chạy thuật toán để có Policy trước khi mô phỏng!');
        return;
    }
    if (!startCell) {
        alert('Cần đặt Start State để mô phỏng Agent!');
        return;
    }
    if (!agentPos) {
        resetSimulation();
    }
    
    const {r, c} = agentPos;
    if (isTerminal(r, c)) {
        if (simInterval) clearInterval(simInterval);
        simInterval = null;
        return; // done
    }
    
    const action = currentPolicy[r][c];
    if (!action || action === '#' || action === 'T') return;
    
    // Get next state based on probabilities
    const probs = getNextStateProbabilities(r, c, action);
    const rand = Math.random();
    let cumulative = 0;
    let nextR = r, nextC = c;
    
    for (const p of probs) {
        cumulative += p.prob;
        if (rand <= cumulative) {
            nextR = p.nr;
            nextC = p.nc;
            break;
        }
    }
    
    // Calculate reward and Return
    const stepReward = parseFloat(document.getElementById('stepReward').value) || -0.04;
    const gamma = parseFloat(document.getElementById('gamma').value) || 0.9;
    
    const reward = getReward(r, c, action, nextR, nextC, stepReward);
    simG += simGammaPower * reward;
    simGammaPower *= gamma;
    simStepCount++;
    
    document.getElementById('simReturn').textContent = simG.toFixed(4);
    
    agentPos = { r: nextR, c: nextC };
    updateAgentPosition();
    
    if (isTerminal(nextR, nextC) && simInterval) {
        clearInterval(simInterval);
        simInterval = null;
    }
}

function playSimulation() {
    if (currentPolicy.length === 0) {
        alert('Cần chạy thuật toán để có Policy trước khi mô phỏng!');
        return;
    }
    if (!startCell) {
        alert('Cần đặt Start State để mô phỏng Agent!');
        return;
    }
    resetSimulation();
    simInterval = setInterval(stepSimulation, 500); // 500ms per step
}

// ── Q-Table Modal ──
function openQTable() {
    document.getElementById('qTableModal').style.display = 'flex';
    renderQTable();
}

function closeQTable() {
    document.getElementById('qTableModal').style.display = 'none';
}

function renderQTable() {
    const tbody = document.getElementById('qTableContent');
    let html = `
        <tr>
            <th>State (r, c)</th>
            <th>Q(s, U) ↑</th>
            <th>Q(s, D) ↓</th>
            <th>Q(s, L) ←</th>
            <th>Q(s, R) →</th>
            <th>Max Q</th>
            <th>Best Action</th>
        </tr>
    `;
    
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (isBlocked(r, c) || isTerminal(r, c)) continue;
            const q = qMatrix[r][c];
            let bestA = 'U', maxQ = -Infinity;
            for (const a of ACTION_KEYS) {
                if (q[a] > maxQ) { maxQ = q[a]; bestA = a; }
            }
            
            html += `
                <tr>
                    <td class="state-col">(${r}, ${c})</td>
                    <td class="${bestA==='U'?'best-q':''}">${q.U.toFixed(4)}</td>
                    <td class="${bestA==='D'?'best-q':''}">${q.D.toFixed(4)}</td>
                    <td class="${bestA==='L'?'best-q':''}">${q.L.toFixed(4)}</td>
                    <td class="${bestA==='R'?'best-q':''}">${q.R.toFixed(4)}</td>
                    <td style="font-weight:bold; color:var(--text-primary);">${maxQ.toFixed(4)}</td>
                    <td style="color:var(--accent-bright);">${ARROWS[bestA]}</td>
                </tr>
            `;
        }
    }
    tbody.innerHTML = html;
}
