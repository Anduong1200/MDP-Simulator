const fs = require('fs');

const appJsPath = 'C:\\Users\\ADMIN\\Downloads\\[p[\\app.js';
const recoveryPath = 'C:\\Users\\ADMIN\\Downloads\\[p[\\algo_recovery.js';

let appJs = fs.readFileSync(appJsPath, 'utf8');
const recoveryJs = fs.readFileSync(recoveryPath, 'utf8');

// The bad block to replace
const badBlockStart = '// ── TD Learning ──';
const badBlockEnd = '// ── Run Setup ──';

const startIndex = appJs.indexOf(badBlockStart);
const endIndex = appJs.indexOf(badBlockEnd);

if (startIndex !== -1 && endIndex !== -1) {
    // Construct the good TDControl, TDLambda, SarsaLambda
    const goodAlgorithms = `
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
`;

    // Put it all together
    const newContent = appJs.slice(0, startIndex) +
                       goodAlgorithms + '\n\n' + recoveryJs + '\n\n' +
                       appJs.slice(endIndex);

    fs.writeFileSync(appJsPath, newContent);
    console.log('PATCH SUCCESS');
} else {
    console.log('BAD BLOCK NOT FOUND');
}
