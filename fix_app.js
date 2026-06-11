const fs = require('fs');
const appJsPath = 'C:\\Users\\ADMIN\\Downloads\\[p[\\app.js';
const appJs = fs.readFileSync(appJsPath, 'utf8');

// The corrupted file was created as:
// appJs.substring(0, startIndex) + runAlgoReplacement + appJs.substring(12)
// This means the old app.js is exactly "/* ==========" + appJs.substring(12) from the old appJs.
// Wait, appJs.substring(12) was appended AFTER runAlgoReplacement!
// So if we split by `if (result) {============================================`
// the second part is EXACTLY `============================================` + the rest of the old app.js!
const parts = appJs.split('if (result) {============================================');

if (parts.length === 2) {
    const oldAppJs = '/* ============================================' + parts[1];
    
    // Now we have the old app.js. We can apply the PG patch correctly.
    const pgPath = 'C:\\Users\\ADMIN\\Downloads\\[p[\\pg_algo.js';
    const pgJs = fs.readFileSync(pgPath, 'utf8');
    
    let newAppJs = oldAppJs;
    
    // 1. Add global pg_policy variable near the top
    if (!newAppJs.includes('let pg_policy = null;')) {
        newAppJs = newAppJs.replace('let currentTraces = null;', 'let currentTraces = null;\nlet pg_policy = null;');
    }
    
    // 2. Insert pg_algo.js before runAlgorithm
    const runSetupStart = '// ── Run Setup ──';
    if (!newAppJs.includes('runREINFORCE')) {
        newAppJs = newAppJs.replace(runSetupStart, pgJs + '\n\n' + runSetupStart);
    }
    
    // 3. Replace selectAlgo logic
    const selectAlgoStart = `    document.getElementById('btnTDLambda').classList.toggle('active', algo === 'td_lambda');`;
    const selectAlgoEnd = `    document.getElementById('thetaGroup').style.display = ['vi', 'pi', 'pe'].includes(algo) ? '' : 'none';`;

    const selectAlgoReplacement = `    document.getElementById('btnTDLambda').classList.toggle('active', algo === 'td_lambda');
    document.getElementById('btnSarsaLambda').classList.toggle('active', algo === 'sarsa_lambda');

    document.getElementById('btnREINFORCE').classList.toggle('active', algo === 'reinforce');
    document.getElementById('btnREINFORCEBase').classList.toggle('active', algo === 'reinforce_base');
    document.getElementById('btnActorCritic').classList.toggle('active', algo === 'actor_critic');

    const isTD = ['ql', 'sarsa', 'esarsa', 'dql'].includes(algo);
    const isMC = ['mc_on', 'mc_off'].includes(algo);
    const isNStep = ['nstep_sarsa', 'nstep_tree'].includes(algo);
    const isDyna = ['dynaq', 'prioritized_sweeping'].includes(algo);
    const isApprox = ['semi_grad_td', 'semi_grad_sarsa'].includes(algo);
    const isApproxCtrl = algo === 'semi_grad_sarsa';
    const isLambda = ['td_lambda', 'sarsa_lambda'].includes(algo);
    const isLambdaCtrl = algo === 'sarsa_lambda';
    const isPIPE = ['pi', 'pe'].includes(algo);
    const isPG = ['reinforce', 'reinforce_base', 'actor_critic'].includes(algo);
    const hasCritic = ['reinforce_base', 'actor_critic'].includes(algo);
    
    if (isPG) pg_policy = null; // Reset PG visuals when switching to/from PG

    document.getElementById('piInitSection').style.display = isPIPE ? '' : 'none';
    document.getElementById('mfParams').style.display = (isTD || isMC || isNStep || isDyna || isApprox || isLambda || isPG) ? '' : 'none';
    document.getElementById('alphaGroup').style.display = (isTD || isNStep || isDyna || isApprox || isLambda || isPG) ? '' : 'none';
    document.getElementById('alphaCriticGroup').style.display = hasCritic ? '' : 'none';
    document.getElementById('lblAlpha').innerText = isPG ? 'α_θ (Actor)' : 'α (LR)';
    document.getElementById('epsilon').parentElement.style.display = (isTD || isMC || isNStep || isDyna || isApproxCtrl || isLambdaCtrl) ? '' : 'none';
    document.getElementById('lambdaGroup').style.display = isLambda ? '' : 'none';
    document.getElementById('traceTypeGroup').style.display = isLambda ? '' : 'none';
    document.getElementById('nStepGroup').style.display = isNStep ? '' : 'none';
    document.getElementById('dynaGroup').style.display = isDyna ? '' : 'none';
    document.getElementById('featureGroup').style.display = isApprox ? '' : 'none';

    document.getElementById('asyncDPGroup').style.display = ['vi', 'pi', 'pe'].includes(algo) ? '' : 'none';
    document.getElementById('thetaGroup').style.display = ['vi', 'pi', 'pe'].includes(algo) ? '' : 'none';`;

    const idx1 = newAppJs.indexOf(selectAlgoStart);
    const idx2 = newAppJs.indexOf(selectAlgoEnd) + selectAlgoEnd.length;
    if (idx1 !== -1 && idx2 !== -1) {
        newAppJs = newAppJs.substring(0, idx1) + selectAlgoReplacement + newAppJs.substring(idx2);
    }
    
    // 4. Replace runAlgorithm manually using regex or split to avoid indexOf errors
    // We want to replace the body of runAlgorithm from isLambda down to `if (result) {`
    // Let's use a reliable split
    const splitToken1 = "    const isLambda = ['td_lambda', 'sarsa_lambda'].includes(selectedAlgo);";
    const splitToken2 = "    if (result) {\n        document.getElementById('simCard').style.display = '';";
    
    const algoParts1 = newAppJs.split(splitToken1);
    if (algoParts1.length === 2) {
        const algoParts2 = algoParts1[1].split(splitToken2);
        if (algoParts2.length === 2) {
            const runAlgoReplacement = `    const isLambda = ['td_lambda', 'sarsa_lambda'].includes(selectedAlgo);
    const isPG = ['reinforce', 'reinforce_base', 'actor_critic'].includes(selectedAlgo);

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
    } else if (isPG) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const alphaCritic = parseFloat(document.getElementById('alphaCritic').value) || 0.1;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        if (selectedAlgo === 'reinforce') {
            result = await runREINFORCE(alpha, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
        } else if (selectedAlgo === 'reinforce_base') {
            result = await runREINFORCEBaseline(alpha, alphaCritic, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
        } else {
            result = await runActorCritic(alpha, alphaCritic, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
        }
    } else if (isMC) {
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        result = await runMonteCarloControl(selectedAlgo, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isNStep) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        const nStep = parseInt(document.getElementById('nSteps').value) || 3;
        result = await runNStepControl(selectedAlgo, nStep, alpha, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    } else if (isDyna) {
        const alpha = parseFloat(document.getElementById('alpha').value) || 0.1;
        const epsilon = parseFloat(document.getElementById('epsilon').value) || 0.2;
        const episodes = parseInt(document.getElementById('episodes').value) || 1000;
        const planningSteps = parseInt(document.getElementById('planningSteps').value) || 10;
        result = await runDynaControl(selectedAlgo, planningSteps, alpha, epsilon, episodes, gamma, isNaN(stepReward) ? -0.04 : stepReward);
    }

    if (result) {
        document.getElementById('simCard').style.display = '';`;
            
            newAppJs = algoParts1[0] + runAlgoReplacement + algoParts2[1];
        }
    }
    
    // 5. Update renderGrid
    const drawArrowCall = `                    if (isPolicy) {
                        drawArrow(r, c, currentPolicy[r][c], cellDiv);
                    }`;
    const drawArrowReplacement = `                    if (isPolicy) {
                        if (pg_policy && pg_policy[r] && pg_policy[r][c]) {
                            // Policy Gradient mode: Draw stochastic arrows
                            const probs = getSoftmaxProbabilities(pg_policy[r][c]);
                            for (const a of ACTION_KEYS) {
                                if (probs[a] > 0.01) {
                                    drawStochasticArrow(r, c, a, probs[a], cellDiv);
                                }
                            }
                        } else {
                            // Deterministic mode
                            drawArrow(r, c, currentPolicy[r][c], cellDiv);
                        }
                    }`;

    if (!newAppJs.includes('drawStochasticArrow')) {
        newAppJs = newAppJs.replace(drawArrowCall, drawArrowReplacement);

        const drawArrowDef = `function drawArrow(r, c, action, cellDiv) {`;
        const drawStocArrowDef = `function drawStochasticArrow(r, c, action, prob, cellDiv) {
    if (!action || action === '#' || action === 'T') return;
    const arrowMap = { 'U': '↑', 'D': '↓', 'L': '←', 'R': '→' };
    const span = document.createElement('span');
    span.innerText = arrowMap[action] || '';
    span.style.position = 'absolute';
    span.style.color = '#fff';
    span.style.fontWeight = 'bold';
    span.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
    
    span.style.opacity = prob.toFixed(2);
    span.style.fontSize = (0.5 + prob * 0.8) + 'rem'; 

    if (action === 'U') { span.style.top = '2px'; span.style.left = '50%'; span.style.transform = 'translateX(-50%)'; }
    if (action === 'D') { span.style.bottom = '2px'; span.style.left = '50%'; span.style.transform = 'translateX(-50%)'; }
    if (action === 'L') { span.style.left = '2px'; span.style.top = '50%'; span.style.transform = 'translateY(-50%)'; }
    if (action === 'R') { span.style.right = '2px'; span.style.top = '50%'; span.style.transform = 'translateY(-50%)'; }
    
    cellDiv.appendChild(span);
}

function drawArrow(r, c, action, cellDiv) {`;
        newAppJs = newAppJs.replace(drawArrowDef, drawStocArrowDef);
    }
    
    fs.writeFileSync(appJsPath, newAppJs);
    console.log('FIX SUCCESS!');
} else {
    console.log('Split failed');
}
