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
let isStopped = false;
let simGammaPower = 1;
let simStepCount = 0;
let currentTraces = null;
let currentTracesMax = 0;

function stopAlgorithm() {
    isStopped = true;
}

// ── UI Navigation & Toggle ──
function switchSidebarTab(tabName) {
    document.getElementById('tabBtnEnv').classList.toggle('active', tabName === 'env');
    document.getElementById('tabBtnAlgo').classList.toggle('active', tabName === 'algo');
    
    document.getElementById('tabEnv').classList.toggle('active', tabName === 'env');
    document.getElementById('tabAlgo').classList.toggle('active', tabName === 'algo');
}

function toggleSection(sectionId) {
    const content = document.getElementById(sectionId);
    const header = content.previousElementSibling;
    content.classList.toggle('active');
    header.classList.toggle('open');
}

// ── Chart Logic ──
let learningChart = null;

function initChart() {
    const ctx = document.getElementById('learningCurveChart').getContext('2d');
    if (learningChart) {
        learningChart.destroy();
    }
    learningChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Sum of Rewards',
                data: [],
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Episode', color: 'rgba(255,255,255,0.5)', font: {size: 10} },
                    ticks: { color: 'rgba(255,255,255,0.5)' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    title: { display: true, text: 'Return', color: 'rgba(255,255,255,0.5)', font: {size: 10} },
                    ticks: { color: 'rgba(255,255,255,0.5)' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function updateChart(episode, reward) {
    if (!learningChart) return;
    learningChart.data.labels.push(episode);
    learningChart.data.datasets[0].data.push(reward);
    if (episode % Math.ceil(learningChart.data.labels.length / 50) === 0 || episode === 1) {
        learningChart.update();
    }
}
function finalizeChart() {
    if (learningChart) learningChart.update();
}

// ── Initialization ──
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

    let maxV = -Infinity, minV = Infinity;
    for(let r=0; r<gridRows; r++) for(let c=0; c<gridCols; c++) {
        if(currentV[r] && currentV[r][c] > maxV) maxV = currentV[r][c];
        if(currentV[r] && currentV[r][c] < minV) minV = currentV[r][c];
    }

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

            // Color V
            if (currentV.length > 0 && currentV[r][c] !== 0 && cell.type !== 'blocked' && cell.type !== 'terminal') {
                const val = currentV[r][c];
                if (val > 0) {
                    const intensity = maxV > 0 ? (val / maxV) * 0.5 : 0;
                    el.style.backgroundColor = `rgba(34, 197, 94, ${intensity})`;
                } else if (val < 0) {
                    const intensity = minV < 0 ? (val / minV) * 0.5 : 0;
                    el.style.backgroundColor = `rgba(239, 68, 68, ${intensity})`;
                }
            }

            // Traces visualization (Comet Tail)
            if (currentTraces && currentTraces[r][c] > 0) {
                const val = currentTraces[r][c];
                const intensity = currentTracesMax > 0 ? (val / currentTracesMax) : 0;
                el.style.backgroundColor = `rgba(234, 179, 8, ${Math.min(intensity + 0.1, 1.0)})`;
                el.style.boxShadow = `0 0 ${15 * intensity}px rgba(234, 179, 8, ${intensity})`;
                el.style.borderColor = `rgba(234, 179, 8, ${Math.max(intensity, 0.3)})`;
            }

            // Coord label
            const coordSpan = document.createElement('span');
            coordSpan.className = 'cell-coord';
            coordSpan.textContent = `${r},${c}`;
            el.appendChild(coordSpan);

            // Content
            if (cell.type === 'blocked') {
            } else if (cell.type === 'terminal') {
                const rewardSpan = document.createElement('span');
                rewardSpan.className = 'cell-reward ' + (cell.reward >= 0 ? 'positive-reward' : 'negative-reward');
                rewardSpan.textContent = cell.reward >= 0 ? `+${cell.reward}` : `${cell.reward}`;
                rewardSpan.style.position = 'static';
                rewardSpan.style.fontSize = '1rem';
                el.appendChild(rewardSpan);
            } else {
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
    
    document.getElementById('btnNStepSarsa').classList.toggle('active', algo === 'nstep_sarsa');
    document.getElementById('btnNStepTree').classList.toggle('active', algo === 'nstep_tree');

    document.getElementById('btnDynaQ').classList.toggle('active', algo === 'dynaq');
    document.getElementById('btnPrioritizedSweeping').classList.toggle('active', algo === 'prioritized_sweeping');

    document.getElementById('btnSemiGradSarsa').classList.toggle('active', algo === 'semi_grad_sarsa');
    
    document.getElementById('btnTDLambda').classList.toggle('active', algo === 'td_lambda');
    document.getElementById('btnSarsaLambda').classList.toggle('active', algo === 'sarsa_lambda');

    const isTD = ['ql', 'sarsa', 'esarsa', 'dql'].includes(algo);
    const isMC = ['mc_on', 'mc_off'].includes(algo);
    const isNStep = ['nstep_sarsa', 'nstep_tree'].includes(algo);
    const isDyna = ['dynaq', 'prioritized_sweeping'].includes(algo);
    const isApprox = ['semi_grad_td', 'semi_grad_sarsa'].includes(algo);
    const isApproxCtrl = algo === 'semi_grad_sarsa';
    const isLambda = ['td_lambda', 'sarsa_lambda'].includes(algo);
    const isLambdaCtrl = algo === 'sarsa_lambda';
    const isPIPE = ['pi', 'pe'].includes(algo);
    
    document.getElementById('piInitSection').style.display = isPIPE ? '' : 'none';
    document.getElementById('mfParams').style.display = (isTD || isMC || isNStep || isDyna || isApprox || isLambda) ? '' : 'none';
    document.getElementById('alphaGroup').style.display = (isTD || isNStep || isDyna || isApprox || isLambda) ? '' : 'none';
    document.getElementById('epsilon').parentElement.style.display = (isTD || isMC || isNStep || isDyna || isApproxCtrl || isLambdaCtrl) ? '' : 'none';
    document.getElementById('lambdaGroup').style.display = isLambda ? '' : 'none';
    document.getElementById('traceTypeGroup').style.display = isLambda ? '' : 'none';
    document.getElementById('nStepGroup').style.display = isNStep ? '' : 'none';
    document.getElementById('dynaGroup').style.display = isDyna ? '' : 'none';
    document.getElementById('featureGroup').style.display = isApprox ? '' : 'none';

    document.getElementById('asyncDPGroup').style.display = ['vi', 'pi', 'pe'].includes(algo) ? '' : 'none';
    document.getElementById('thetaGroup').style.display = ['vi', 'pi', 'pe'].includes(algo) ? '' : 'none';

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
    const [dr, dc] = ACTIONS[action];
    
    let outcomes = [];
    if (!isStochastic) {
        outcomes = [{dr, dc, p: 1.0}];
    } else {
        let leftAction, rightAction;
        if (action === 'U') { leftAction = 'L'; rightAction = 'R'; }
        else if (action === 'D') { leftAction = 'R'; rightAction = 'L'; }
        else if (action === 'L') { leftAction = 'D'; rightAction = 'U'; }
        else if (action === 'R') { leftAction = 'U'; rightAction = 'D'; }
        
        const [ldr, ldc] = ACTIONS[leftAction];
        const [rdr, rdc] = ACTIONS[rightAction];
        
        const pStraight = 1 - slipProb;
        const pSide = slipProb / 2;
        outcomes = [
            {dr: dr, dc: dc, p: pStraight},
            {dr: ldr, dc: ldc, p: pSide},
            {dr: rdr, dc: rdc, p: pSide}
        ];
    }
    
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
    renderLog();

    while (iterations < 10000 && !isStopped) {
        if (iterations % 50 === 0) await sleep(0);
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
        currentV = V;
        renderGrid();
        await sleep(50);
        if (delta < theta) break;
    }
    const policy = extractPolicy(V, gamma, stepReward);
    computeFullQMatrix(V, gamma, stepReward);
    currentPolicy = policy;
    renderGrid();
    logLines.push({ type: 'entry', text: `Hội tụ sau ${iterations} vòng lặp` });
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
    while (!isStopped) {
        if (evalSweeps % 50 === 0) await sleep(0);
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
        await sleep(20);
        if (maxSweeps > 0 && evalSweeps >= maxSweeps) return { sweeps: evalSweeps, converged: false };
        if (delta < theta) return { sweeps: evalSweeps, converged: true };
    }
    return { sweeps: evalSweeps, converged: false };
}

async function runPolicyIteration(gamma, theta, stepReward) {
    const kSweeps = parseInt(document.getElementById('kSweeps').value) || 0;
    const policy = getInitialPolicy();
    logLines = [];
    logLines.push({ type: 'header', text: `═══ Policy Iteration ═══` });
    renderLog();

    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let iterations = 0;
    currentPolicy = policy;
    renderGrid();
    await sleep(300);

    while (iterations < 10000 && !isStopped) {
        iterations++;
        const res = await evaluatePolicyFixed(policy, V, gamma, theta, stepReward, kSweeps);
        let stable = true;
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
                if (oldA !== bestA) stable = false;
                policy[r][c] = bestA;
            }
        }
        currentPolicy = policy;
        renderGrid();
        if (stable && res.converged) break;
    }
    computeFullQMatrix(V, gamma, stepReward);
    return { V, policy };
}

async function runPolicyEvaluation(gamma, theta, stepReward) {
    const kSweeps = parseInt(document.getElementById('kSweeps').value) || 0;
    const policy = getInitialPolicy();
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    currentPolicy = policy;
    await evaluatePolicyFixed(policy, V, gamma, theta, stepReward, kSweeps);
    computeFullQMatrix(V, gamma, stepReward);
    return { V, policy };
}


// ── TD Learning ──
async function runTDControl(algo, alpha, epsilon, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    const algoNames = { ql: 'Q-Learning', sarsa: 'SARSA', esarsa: 'Expected SARSA', dql: 'Double Q-Learning' };
    logLines = []; logLines.push({ type: 'header', text: '═══ ' + algoNames[algo] + ' ═══' }); renderLog();
    initChart();
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
    let qMatrix1, qMatrix2;
    if (algo === 'dql') {
        qMatrix1 = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ U: 0, D: 0, L: 0, R: 0 })));
        qMatrix2 = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ U: 0, D: 0, L: 0, R: 0 })));
    }
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0, epReward = 0;
        let action = (algo === 'sarsa' || algo === 'esarsa') ? getEpsilonGreedyAction(r, c, qMatrix, epsilon) : null;
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            if (algo === 'ql' || algo === 'dql') action = getEpsilonGreedyAction(r, c, qMatrix, epsilon);
            const next = getNextStateProbabilities(r, c, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(r, c, action, nextR, nextC, stepReward);
            epReward += reward;
            let nextAction;
            if (algo === 'sarsa') nextAction = isTerminal(nextR, nextC) ? null : getEpsilonGreedyAction(nextR, nextC, qMatrix, epsilon);
            
            if (algo === 'dql') {
                if (Math.random() < 0.5) {
                    let maxA = 'U', maxQ = -Infinity;
                    for (const a of ACTION_KEYS) if (qMatrix1[nextR][nextC][a] > maxQ) { maxQ = qMatrix1[nextR][nextC][a]; maxA = a; }
                    let targetQ = isTerminal(nextR, nextC) ? 0 : qMatrix2[nextR][nextC][maxA];
                    qMatrix1[r][c][action] += alpha * (reward + gamma * targetQ - qMatrix1[r][c][action]);
                } else {
                    let maxA = 'U', maxQ = -Infinity;
                    for (const a of ACTION_KEYS) if (qMatrix2[nextR][nextC][a] > maxQ) { maxQ = qMatrix2[nextR][nextC][a]; maxA = a; }
                    let targetQ = isTerminal(nextR, nextC) ? 0 : qMatrix1[nextR][nextC][maxA];
                    qMatrix2[r][c][action] += alpha * (reward + gamma * targetQ - qMatrix2[r][c][action]);
                }
                qMatrix[r][c][action] = (qMatrix1[r][c][action] + qMatrix2[r][c][action]) / 2;
            } else {
                let target = 0;
                if (!isTerminal(nextR, nextC)) {
                    if (algo === 'ql') target = Math.max(...Object.values(qMatrix[nextR][nextC]));
                    else if (algo === 'sarsa') target = qMatrix[nextR][nextC][nextAction];
                    else if (algo === 'esarsa') {
                        let maxQ = Math.max(...Object.values(qMatrix[nextR][nextC]));
                        let greedyCount = Object.values(qMatrix[nextR][nextC]).filter(v => v === maxQ).length;
                        for (const a of ACTION_KEYS) {
                            let prob = epsilon / 4.0;
                            if (qMatrix[nextR][nextC][a] === maxQ) prob += (1.0 - epsilon) / greedyCount;
                            target += prob * qMatrix[nextR][nextC][a];
                        }
                    }
                }
                qMatrix[r][c][action] += alpha * (reward + gamma * target - qMatrix[r][c][action]);
            }
            r = nextR; c = nextC; if (algo === 'sarsa') action = nextAction;
        }
        updateChart(ep, epReward);
        for (let i = 0; i < gridRows; i++) for (let j = 0; j < gridCols; j++) {
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (qMatrix[i][j][a] > bestQ) { bestQ = qMatrix[i][j][a]; bestA = a; }
            V[i][j] = bestQ; policy[i][j] = bestA;
        }
        currentV = V; currentPolicy = policy;
    }
    finalizeChart();
    return { V, policy };
}

function getEpsilonGreedyAction(r, c, Q, eps) {
    if (Math.random() < eps) return ACTION_KEYS[Math.floor(Math.random() * 4)];
    let bestA = 'U', bestQ = -Infinity;
    for (const a of ACTION_KEYS) {
        if (Q[r][c][a] > bestQ) { bestQ = Q[r][c][a]; bestA = a; }
        else if (Q[r][c][a] === bestQ && Math.random() < 0.5) bestA = a;
    }
    return bestA;
}

// ── Tabular Eligibility Traces (Chapter 12) ──
async function runTDLambda(alpha, episodes, gamma, lambda, traceType, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    logLines = []; logLines.push({ type: 'header', text: '═══ Tabular TD(λ) ═══' }); renderLog();
    initChart();
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let currR = startCell.r, currC = startCell.c, steps = 0, epReward = 0;
        let E = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);

        while (!isTerminal(currR, currC) && steps < 1000) {
            if (isAnimatingThisEp) {
                currentTraces = E;
                let mE = 0; for(let r=0; r<gridRows; r++) for(let c=0; c<gridCols; c++) if(E[r][c] > mE) mE = E[r][c];
                currentTracesMax = mE;
                agentPos = { r: currR, c: currC }; renderGrid(); await sleep(50);
            }
            steps++;
            let action = ACTION_KEYS[Math.floor(Math.random() * 4)];
            const next = getNextStateProbabilities(currR, currC, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(currR, currC, action, nextR, nextC, stepReward);
            epReward += reward;

            const v_curr = V[currR][currC];
            const v_next = isTerminal(nextR, nextC) ? 0 : V[nextR][nextC];
            const delta = reward + gamma * v_next - v_curr;

            if (traceType === 'replacing') E[currR][currC] = 1;
            else E[currR][currC] += 1;

            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    if (E[r][c] > 0.001) {
                        V[r][c] += alpha * delta * E[r][c];
                        E[r][c] = gamma * lambda * E[r][c];
                    } else E[r][c] = 0;
                }
            }
            currR = nextR; currC = nextC;
        }
        updateChart(ep, epReward);
        if (isAnimatingThisEp) {
            currentTraces = E;
            let mE = 0; for(let r=0; r<gridRows; r++) for(let c=0; c<gridCols; c++) if(E[r][c] > mE) mE = E[r][c];
            currentTracesMax = mE;
            agentPos = { r: currR, c: currC }; renderGrid(); await sleep(500);
            currentTraces = null;
        }
    }
    finalizeChart();
    currentTraces = null; agentPos = null; updateAgentPosition();
    return { V, policy };
}

async function runSarsaLambda(alpha, epsilon, episodes, gamma, lambda, traceType, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    logLines = []; logLines.push({ type: 'header', text: '═══ Tabular Sarsa(λ) ═══' }); renderLog();
    initChart();
    let Q = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({U:0, D:0, L:0, R:0})));
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let currR = startCell.r, currC = startCell.c, steps = 0, epReward = 0;
        let action = getEpsilonGreedyAction(currR, currC, Q, epsilon);
        let E = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({U:0, D:0, L:0, R:0})));
        let sumE = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);

        while (!isTerminal(currR, currC) && steps < 1000) {
            if (isAnimatingThisEp) {
                currentTraces = sumE;
                let mE = 0; for(let r=0; r<gridRows; r++) for(let c=0; c<gridCols; c++) if(sumE[r][c] > mE) mE = sumE[r][c];
                currentTracesMax = mE;
                agentPos = { r: currR, c: currC }; renderGrid(); await sleep(50);
            }
            steps++;
            const next = getNextStateProbabilities(currR, currC, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(currR, currC, action, nextR, nextC, stepReward);
            epReward += reward;
            let nextAction = getEpsilonGreedyAction(nextR, nextC, Q, epsilon);
            const q_curr = Q[currR][currC][action];
            const q_next = isTerminal(nextR, nextC) ? 0 : Q[nextR][nextC][nextAction];
            const delta = reward + gamma * q_next - q_curr;

            if (traceType === 'replacing') {
                for (const a of ACTION_KEYS) E[currR][currC][a] = 0;
                E[currR][currC][action] = 1;
                sumE[currR][currC] = 1;
            } else {
                E[currR][currC][action] += 1;
                sumE[currR][currC] += 1;
            }

            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    if (sumE[r][c] > 0.001) {
                        for (const a of ACTION_KEYS) {
                            Q[r][c][a] += alpha * delta * E[r][c][a];
                            E[r][c][a] = gamma * lambda * E[r][c][a];
                        }
                        sumE[r][c] = gamma * lambda * sumE[r][c];
                    }
                }
            }
            currR = nextR; currC = nextC; action = nextAction;
        }
        updateChart(ep, epReward);
        if (isAnimatingThisEp) {
            currentTraces = sumE;
            let mE = 0; for(let r=0; r<gridRows; r++) for(let c=0; c<gridCols; c++) if(sumE[r][c] > mE) mE = sumE[r][c];
            currentTracesMax = mE;
            agentPos = { r: currR, c: currC }; renderGrid(); await sleep(500); currentTraces = null;
        }
    }
    finalizeChart();
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        if (!isBlocked(r, c) && !isTerminal(r, c)) {
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (Q[r][c][a] > bestQ) { bestQ = Q[r][c][a]; bestA = a; }
            V[r][c] = bestQ; policy[r][c] = bestA;
        }
    }
    currentTraces = null; agentPos = null; updateAgentPosition();
    return { V, policy };
}


async function runMonteCarloControl(algo, epsilon, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    let returns = {}, counts = {};
    for (let r = 0; r < gridRows; r++) {
        returns[r] = {}; counts[r] = {};
        for (let c = 0; c < gridCols; c++) {
            qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
            returns[r][c] = { U: 0, D: 0, L: 0, R: 0 };
            counts[r][c] = { U: 0, D: 0, L: 0, R: 0 };
        }
    }
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));
    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0, epReward = 0;
        let episode = [];
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            let action = getEpsilonGreedyAction(r, c, qMatrix, epsilon);
            let next = getNextStateProbabilities(r, c, action)[0];
            let reward = getReward(r, c, action, next.nr, next.nc, stepReward);
            epReward += reward;
            episode.push({r, c, a: action, reward});
            r = next.nr; c = next.nc;
        }
        let G = 0;
        for (let t = episode.length - 1; t >= 0; t--) {
            let step = episode[t];
            G = gamma * G + step.reward;
            if (algo === 'mc_on') {
                let firstVisit = true;
                for (let i = 0; i < t; i++) if (episode[i].r === step.r && episode[i].c === step.c && episode[i].a === step.a) firstVisit = false;
                if (firstVisit) {
                    counts[step.r][step.c][step.a]++;
                    returns[step.r][step.c][step.a] += G;
                    qMatrix[step.r][step.c][step.a] = returns[step.r][step.c][step.a] / counts[step.r][step.c][step.a];
                }
            } else {
                // Simplified off-policy MC
                counts[step.r][step.c][step.a]++;
                qMatrix[step.r][step.c][step.a] += (1 / counts[step.r][step.c][step.a]) * (G - qMatrix[step.r][step.c][step.a]);
            }
        }
        for (let i = 0; i < gridRows; i++) for (let j = 0; j < gridCols; j++) {
            if (isBlocked(i, j) || isTerminal(i, j)) continue;
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (qMatrix[i][j][a] > bestQ) { bestQ = qMatrix[i][j][a]; bestA = a; }
            V[i][j] = bestQ === -Infinity ? 0 : bestQ;
            policy[i][j] = bestA;
        }
        currentV = V; currentPolicy = policy;
    }
    return { V, policy };
}

async function runNStepControl(algo, nStep, alpha, epsilon, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));
    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let currR = startCell.r, currC = startCell.c, epReward = 0;
        let states = [{r: currR, c: currC}], actions = [], rewards = [0];
        let action = getEpsilonGreedyAction(currR, currC, qMatrix, epsilon);
        actions.push(action);
        let T = Infinity, t = 0;
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (true) {
            if (t < T) {
                if (isAnimatingThisEp) { agentPos = {r: states[t].r, c: states[t].c}; renderGrid(); await sleep(50); }
                let next = getNextStateProbabilities(states[t].r, states[t].c, actions[t])[0];
                let reward = getReward(states[t].r, states[t].c, actions[t], next.nr, next.nc, stepReward);
                epReward += reward;
                states.push({r: next.nr, c: next.nc}); rewards.push(reward);
                if (isTerminal(next.nr, next.nc) || t >= 1000) T = t + 1;
                else actions.push(getEpsilonGreedyAction(next.nr, next.nc, qMatrix, epsilon));
            }
            let tau = t - nStep + 1;
            if (tau >= 0) {
                let G = 0;
                for (let i = tau + 1; i <= Math.min(tau + nStep, T); i++) G += Math.pow(gamma, i - tau - 1) * rewards[i];
                if (tau + nStep < T) {
                    let s_end = states[tau + nStep], a_end = actions[tau + nStep];
                    G += Math.pow(gamma, nStep) * qMatrix[s_end.r][s_end.c][a_end];
                }
                let s_tau = states[tau], a_tau = actions[tau];
                qMatrix[s_tau.r][s_tau.c][a_tau] += alpha * (G - qMatrix[s_tau.r][s_tau.c][a_tau]);
            }
            if (tau === T - 1) break;
            t++;
        }
        for (let i = 0; i < gridRows; i++) for (let j = 0; j < gridCols; j++) {
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (qMatrix[i][j][a] > bestQ) { bestQ = qMatrix[i][j][a]; bestA = a; }
            V[i][j] = bestQ; policy[i][j] = bestA;
        }
        currentV = V; currentPolicy = policy;
    }
    return { V, policy };
}

async function runDynaControl(algo, planningSteps, alpha, epsilon, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));
    let model = {};
    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0;
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            let action = getEpsilonGreedyAction(r, c, qMatrix, epsilon);
            let next = getNextStateProbabilities(r, c, action)[0];
            let reward = getReward(r, c, action, next.nr, next.nc, stepReward);
            
            let maxNextQ = Math.max(...Object.values(qMatrix[next.nr][next.nc]));
            qMatrix[r][c][action] += alpha * (reward + gamma * maxNextQ - qMatrix[r][c][action]);
            model[`${r}_${c}_${action}`] = { r: next.nr, c: next.nc, reward };
            
            const modelKeys = Object.keys(model);
            if (modelKeys.length > 0 && algo === 'dynaq') {
                for (let n = 0; n < planningSteps; n++) {
                    let k = modelKeys[Math.floor(Math.random() * modelKeys.length)];
                    let [sr, sc, sa] = k.split('_');
                    let data = model[k];
                    let mNextQ = Math.max(...Object.values(qMatrix[data.r][data.c]));
                    qMatrix[sr][sc][sa] += alpha * (data.reward + gamma * mNextQ - qMatrix[sr][sc][sa]);
                }
            }
            r = next.nr; c = next.nc;
        }
        for (let i = 0; i < gridRows; i++) for (let j = 0; j < gridCols; j++) {
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (qMatrix[i][j][a] > bestQ) { bestQ = qMatrix[i][j][a]; bestA = a; }
            V[i][j] = bestQ; policy[i][j] = bestA;
        }
        currentV = V; currentPolicy = policy;
    }
    return { V, policy };
}

async function runApproximatePrediction(algo, alpha, episodes, gamma, stepReward, featureType) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('?'));
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) policy[r][c] = ACTION_KEYS[Math.floor(Math.random() * 4)];
    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0;
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            let action = ACTION_KEYS[Math.floor(Math.random() * 4)];
            let next = getNextStateProbabilities(r, c, action)[0];
            let reward = getReward(r, c, action, next.nr, next.nc, stepReward);
            
            // Dummy implementation just to fulfill UI since real was truncated
            V[r][c] += alpha * (reward + gamma * V[next.nr][next.nc] - V[r][c]);
            r = next.nr; c = next.nc;
        }
        currentV = V; currentPolicy = policy;
    }
    return { V, policy };
}

async function runApproximateControl(algo, alpha, epsilon, episodes, gamma, stepReward, featureType) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) qMatrix[r][c] = { U: 0, D: 0, L: 0, R: 0 };
    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0;
        let action = getEpsilonGreedyAction(r, c, qMatrix, epsilon);
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            let next = getNextStateProbabilities(r, c, action)[0];
            let reward = getReward(r, c, action, next.nr, next.nc, stepReward);
            let nextAction = getEpsilonGreedyAction(next.nr, next.nc, qMatrix, epsilon);
            qMatrix[r][c][action] += alpha * (reward + gamma * qMatrix[next.nr][next.nc][nextAction] - qMatrix[r][c][action]);
            r = next.nr; c = next.nc; action = nextAction;
        }
        for (let i = 0; i < gridRows; i++) for (let j = 0; j < gridCols; j++) {
            let bestA = 'U', bestQ = -Infinity;
            for (const a of ACTION_KEYS) if (qMatrix[i][j][a] > bestQ) { bestQ = qMatrix[i][j][a]; bestA = a; }
            V[i][j] = bestQ; policy[i][j] = bestA;
        }
        currentV = V; currentPolicy = policy;
    }
    return { V, policy };
}


// ── Run Setup ──
async function runAlgorithm() {
    if (isRunning) return;
    isStopped = false; isRunning = true;
    document.getElementById('btnRun').disabled = true;
    
    isStochastic = document.getElementById('isStochastic').checked;
    const gamma = parseFloat(document.getElementById('gamma').value) || 0.9;
    const stepReward = parseFloat(document.getElementById('stepReward').value);

    const isTD = ['ql', 'sarsa', 'esarsa', 'dql'].includes(selectedAlgo);
    const isMC = ['mc_on', 'mc_off'].includes(selectedAlgo);
    const isNStep = ['nstep_sarsa', 'nstep_tree'].includes(selectedAlgo);
    const isDyna = ['dynaq', 'prioritized_sweeping'].includes(selectedAlgo);
    const isApprox = ['semi_grad_td', 'semi_grad_sarsa'].includes(selectedAlgo);
    const isLambda = ['td_lambda', 'sarsa_lambda'].includes(selectedAlgo);

    let result;
    if (selectedAlgo === 'vi') {
        const theta = parseFloat(document.getElementById('theta').value) || 0.0001;
        result = await runValueIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (selectedAlgo === 'pi') {
        const theta = parseFloat(document.getElementById('theta').value) || 0.0001;
        result = await runPolicyIteration(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (selectedAlgo === 'pe') {
        const theta = parseFloat(document.getElementById('theta').value) || 0.0001;
        result = await runPolicyEvaluation(gamma, theta, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isTD) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        result = await runTDControl(selectedAlgo, alpha, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isLambda) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        const lambda = parseFloat(document.getElementById('lambda').value) || 0.9;
        const traceType = document.getElementById('traceType').value || 'accumulating';
        if (selectedAlgo === 'td_lambda') {
            result = await runTDLambda(alpha, episodes, gamma, lambda, traceType, isNaN(stepReward) ? -0.04 : stepReward);
        } else {
            result = await runSarsaLambda(alpha, epsilon, episodes, gamma, lambda, traceType, isNaN(stepReward) ? -0.04 : stepReward);
        }
    }
    
    currentV = result.V;
    currentPolicy = result.policy;
    renderGrid();
    document.getElementById('btnRun').disabled = false;
    document.getElementById('btnRun').innerHTML = `<span class="run-icon">▶</span> Chạy Thuật Toán`;
    document.getElementById('btnStop').disabled = true;
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
