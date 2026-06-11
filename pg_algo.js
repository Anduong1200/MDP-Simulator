// ── Policy Gradient Methods (Chapter 13) ──

function getSoftmaxProbabilities(h_state) {
    // h_state is an object like {U: 0, D: 0, L: 0, R: 0}
    const max_h = Math.max(...Object.values(h_state));
    let sum = 0;
    const exp_h = {};
    for (const a of ACTION_KEYS) {
        exp_h[a] = Math.exp(h_state[a] - max_h); // subtract max for numerical stability
        sum += exp_h[a];
    }
    const probs = {};
    for (const a of ACTION_KEYS) {
        probs[a] = exp_h[a] / sum;
    }
    return probs;
}

function getSoftmaxAction(probs) {
    const r = Math.random();
    let cumulative = 0;
    for (const a of ACTION_KEYS) {
        cumulative += probs[a];
        if (r <= cumulative) return a;
    }
    return ACTION_KEYS[ACTION_KEYS.length - 1]; // fallback
}

async function runREINFORCE(alpha, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    logLines = []; logLines.push({ type: 'header', text: '═══ REINFORCE ═══' }); renderLog();
    initChart();
    
    // Policy parameters h(s,a)
    let h = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({U:0, D:0, L:0, R:0})));
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0)); // Just for visualization fallback
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0, epReward = 0;
        let episode = [];
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);

        // Generate episode
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) {
                pg_policy = h; // Global variable to indicate PG viz
                agentPos = {r, c}; renderGrid(); await sleep(50);
            }
            steps++;
            const probs = getSoftmaxProbabilities(h[r][c]);
            const action = getSoftmaxAction(probs);
            const next = getNextStateProbabilities(r, c, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(r, c, action, nextR, nextC, stepReward);
            
            episode.push({r, c, a: action, reward});
            epReward += reward;
            r = nextR; c = nextC;
        }

        // Update loop
        for (let t = 0; t < episode.length; t++) {
            let G = 0;
            for (let k = t; k < episode.length; k++) {
                G += Math.pow(gamma, k - t) * episode[k].reward;
            }
            const state = episode[t];
            const probs = getSoftmaxProbabilities(h[state.r][state.c]);
            
            // h(s,a) += alpha * gamma^t * G * grad ln pi(a|s)
            // grad ln pi(a|s) w.r.t h(s,x) is 1 - pi(x|s) if x == a else -pi(x|s)
            for (const a of ACTION_KEYS) {
                if (a === state.a) {
                    h[state.r][state.c][a] += alpha * Math.pow(gamma, t) * G * (1 - probs[a]);
                } else {
                    h[state.r][state.c][a] -= alpha * Math.pow(gamma, t) * G * probs[a];
                }
            }
        }
        
        updateChart(ep, epReward);
        
        if (isAnimatingThisEp) {
            pg_policy = h;
            agentPos = {r, c}; renderGrid(); await sleep(500);
        }
    }
    
    finalizeChart();
    pg_policy = h;
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        let bestA = 'U', bestH = -Infinity;
        for (const a of ACTION_KEYS) if (h[r][c][a] > bestH) { bestH = h[r][c][a]; bestA = a; }
        policy[r][c] = bestA;
    }
    currentPolicy = policy; currentV = V; agentPos = null; updateAgentPosition();
    return { V, policy };
}

async function runREINFORCEBaseline(alpha_theta, alpha_w, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    logLines = []; logLines.push({ type: 'header', text: '═══ REINFORCE w/ Baseline ═══' }); renderLog();
    initChart();
    
    let h = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({U:0, D:0, L:0, R:0})));
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let r = startCell.r, c = startCell.c, steps = 0, epReward = 0;
        let episode = [];
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);

        // Generate episode
        while (!isTerminal(r, c) && steps < 1000) {
            if (isAnimatingThisEp) { pg_policy = h; agentPos = {r, c}; renderGrid(); await sleep(50); }
            steps++;
            const probs = getSoftmaxProbabilities(h[r][c]);
            const action = getSoftmaxAction(probs);
            const next = getNextStateProbabilities(r, c, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(r, c, action, nextR, nextC, stepReward);
            
            episode.push({r, c, a: action, reward});
            epReward += reward;
            r = nextR; c = nextC;
        }

        // Update loop
        for (let t = 0; t < episode.length; t++) {
            let G = 0;
            for (let k = t; k < episode.length; k++) {
                G += Math.pow(gamma, k - t) * episode[k].reward;
            }
            const state = episode[t];
            const delta = G - V[state.r][state.c];
            
            // Update Baseline (Critic)
            V[state.r][state.c] += alpha_w * delta;

            const probs = getSoftmaxProbabilities(h[state.r][state.c]);
            
            // Update Actor
            for (const a of ACTION_KEYS) {
                if (a === state.a) {
                    h[state.r][state.c][a] += alpha_theta * Math.pow(gamma, t) * delta * (1 - probs[a]);
                } else {
                    h[state.r][state.c][a] -= alpha_theta * Math.pow(gamma, t) * delta * probs[a];
                }
            }
        }
        
        updateChart(ep, epReward);
        if (isAnimatingThisEp) { pg_policy = h; agentPos = {r, c}; renderGrid(); await sleep(500); }
    }
    
    finalizeChart();
    pg_policy = h;
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        let bestA = 'U', bestH = -Infinity;
        for (const a of ACTION_KEYS) if (h[r][c][a] > bestH) { bestH = h[r][c][a]; bestA = a; }
        policy[r][c] = bestA;
    }
    currentPolicy = policy; currentV = V; agentPos = null; updateAgentPosition();
    return { V, policy };
}

async function runActorCritic(alpha_theta, alpha_w, episodes, gamma, stepReward) {
    if (!startCell) return { V: currentV, policy: currentPolicy };
    logLines = []; logLines.push({ type: 'header', text: '═══ One-step Actor-Critic ═══' }); renderLog();
    initChart();
    
    let h = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({U:0, D:0, L:0, R:0})));
    let V = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let policy = Array.from({ length: gridRows }, () => Array(gridCols).fill('U'));

    for (let ep = 1; ep <= episodes && !isStopped; ep++) {
        if (ep % 50 === 0) await sleep(0);
        let currR = startCell.r, currC = startCell.c, steps = 0, epReward = 0;
        let I = 1; // Discount factor for actor update
        const isAnimatingThisEp = document.getElementById('animateAgent') && document.getElementById('animateAgent').checked && (episodes - ep < 5);

        while (!isTerminal(currR, currC) && steps < 1000) {
            if (isAnimatingThisEp) { pg_policy = h; agentPos = {r: currR, c: currC}; renderGrid(); await sleep(50); }
            steps++;
            const probs = getSoftmaxProbabilities(h[currR][currC]);
            const action = getSoftmaxAction(probs);
            const next = getNextStateProbabilities(currR, currC, action)[0];
            const nextR = next.nr, nextC = next.nc;
            const reward = getReward(currR, currC, action, nextR, nextC, stepReward);
            epReward += reward;

            const v_next = isTerminal(nextR, nextC) ? 0 : V[nextR][nextC];
            const delta = reward + gamma * v_next - V[currR][currC];

            // Critic update
            V[currR][currC] += alpha_w * delta;

            // Actor update
            for (const a of ACTION_KEYS) {
                if (a === action) {
                    h[currR][currC][a] += alpha_theta * I * delta * (1 - probs[a]);
                } else {
                    h[currR][currC][a] -= alpha_theta * I * delta * probs[a];
                }
            }

            I *= gamma;
            currR = nextR; currC = nextC;
        }
        
        updateChart(ep, epReward);
        if (isAnimatingThisEp) { pg_policy = h; agentPos = {r: currR, c: currC}; renderGrid(); await sleep(500); }
    }
    
    finalizeChart();
    pg_policy = h;
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        let bestA = 'U', bestH = -Infinity;
        for (const a of ACTION_KEYS) if (h[r][c][a] > bestH) { bestH = h[r][c][a]; bestA = a; }
        policy[r][c] = bestA;
    }
    currentPolicy = policy; currentV = V; agentPos = null; updateAgentPosition();
    return { V, policy };
}
