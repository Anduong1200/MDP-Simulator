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
                    const stepReward = parseFloat(document.getElementById('stepReward').value) || -0.04;
                    const gamma = parseFloat(document.getElementById('gamma').value) || 0.9;
                    const qValues = {};
                    let bestA = null, bestVal = -Infinity;
                    for (const a of ACTION_KEYS) {
                        let q = 0;
                        const probs = getNextStateProbabilities(r, c, a);
                        for (const p of probs) {
                            const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                            q += p.prob * (reward + gamma * currentV[p.nr][p.nc]);
                        }
                        qValues[a] = q;
                        if (q > bestVal) { bestVal = q; bestA = a; }
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
    
    const stepReward = parseFloat(document.getElementById('stepReward').value) || -0.04;
    const gamma = parseFloat(document.getElementById('gamma').value) || 0.9;
    
    const qValues = {};
    let bestA = null, bestVal = -Infinity;
    
    for (const a of ACTION_KEYS) {
        let q = 0;
        const probs = getNextStateProbabilities(r, c, a);
        for (const p of probs) {
            const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
            q += p.prob * (reward + gamma * currentV[p.nr][p.nc]);
        }
        qValues[a] = q;
        if (q > bestVal) { bestVal = q; bestA = a; }
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
    document.getElementById('piInitSection').style.display = (algo === 'pi' || algo === 'pe') ? '' : 'none';
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

// ── Value Iteration ──
async function runValueIteration(gamma, theta, stepReward) {
    const V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let iterations = 0;
    let finalDelta = Infinity;

    logLines = [];
    logLines.push({ type: 'header', text: `═══ Value Iteration (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
    renderLog();

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
                    const probs = getNextStateProbabilities(r, c, a);
                    let expectedVal = 0;
                    for (const p of probs) {
                        const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                        expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                    }
                    bestVal = Math.max(bestVal, expectedVal);
                }
                newV[r][c] = bestVal;
                delta = Math.max(delta, Math.abs(newV[r][c] - V[r][c]));
            }
        }
        for (let r = 0; r < gridRows; r++) V[r] = newV[r];
        finalDelta = delta;
        
        // Cập nhật UI ngay lập tức
        currentV = V;
        renderGrid();
        await sleep(50); // Delay nhỏ để nhìn thấy hiệu ứng Sweep

        if (delta < theta) break;
    }

    // Extract policy
    const policy = extractPolicy(V, gamma, stepReward);
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

async function evaluatePolicyFixed(policy, V, gamma, theta, stepReward) {
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
                
                const probs = getNextStateProbabilities(r, c, a);
                let expectedVal = 0;
                for (const p of probs) {
                    const reward = getReward(r, c, a, p.nr, p.nc, stepReward);
                    expectedVal += p.prob * (reward + gamma * V[p.nr][p.nc]);
                }
                newV[r][c] = expectedVal;
                delta = Math.max(delta, Math.abs(newV[r][c] - V[r][c]));
            }
        }
        for (let r = 0; r < gridRows; r++) V[r] = newV[r];
        
        currentV = V;
        renderGrid();
        await sleep(20); // Render nhanh cho PE sweeps

        if (delta < theta) return evalSweeps;
    }
}

async function runPolicyIteration(gamma, theta, stepReward) {
    const policy = getInitialPolicy();
    logLines = [];
    logLines.push({ type: 'header', text: `═══ Policy Iteration (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
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
        const sweeps = await evaluatePolicyFixed(policy, V, gamma, theta, stepReward);
        logLines.push({ type: 'sweep', text: `    Hội tụ sau ${sweeps} sweep` });
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

        if (stable) {
            logLines.push({ type: 'stable', text: `✓ Policy STABLE! Kết thúc sau ${iterations} vòng.` });
            renderLog();
            break;
        }
    }

    return { V, policy };
}

// ── Policy Evaluation Standalone ──
async function runPolicyEvaluationStandalone(gamma, theta, stepReward) {
    const policy = getInitialPolicy();
    logLines = [];
    logLines.push({ type: 'header', text: `═══ Evaluate Current Policy (${isStochastic?'Stochastic':'Deterministic'}) ═══` });
    logLines.push({ type: 'entry', text: `Chỉ tính V(s) cho Policy hiện hành, KHÔNG tối ưu.` });
    renderLog();

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    currentPolicy = policy;
    const sweeps = await evaluatePolicyFixed(policy, V, gamma, theta, stepReward);
    
    logLines.push({ type: 'sweep', text: `Hội tụ sau ${sweeps} sweep` });
    renderLog();
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

    let result;
    if (selectedAlgo === 'vi') {
        result = await runValueIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (selectedAlgo === 'pi') {
        result = await runPolicyIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else {
        result = await runPolicyEvaluationStandalone(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
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
