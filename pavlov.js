const ctx = document.getElementById('chart').getContext('2d');
let chart;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runSimulation() {
    const cs1Start = parseInt(document.getElementById('cs1Start').value);
    const cs1Dur = parseInt(document.getElementById('cs1Dur').value);
    const cs2Start = parseInt(document.getElementById('cs2Start').value);
    const cs2Dur = parseInt(document.getElementById('cs2Dur').value);
    const usStart = parseInt(document.getElementById('usStart').value);
    const usVal = parseFloat(document.getElementById('usVal').value);
    
    const alpha = parseFloat(document.getElementById('alpha').value);
    const gamma = parseFloat(document.getElementById('gamma').value);
    const numTrials = parseInt(document.getElementById('trials').value);

    const T = 50; // Total time steps per trial

    // Complete Serial Compound (CSC) Representation
    // w1[tau] is the weight for the feature corresponding to tau steps after CS1 onset
    let w1 = new Array(T).fill(0);
    let w2 = new Array(T).fill(0);

    const labels = Array.from({length: T}, (_, i) => i);
    
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'V(t) - Dự đoán Reward',
                    data: new Array(T).fill(0),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    fill: true,
                    tension: 0.1,
                    borderWidth: 2
                },
                {
                    label: 'US (Thức ăn)',
                    data: new Array(T).fill(0).map((_, i) => i === usStart ? usVal : 0),
                    borderColor: '#10b981',
                    borderWidth: 2,
                    stepped: true
                },
                {
                    label: 'CS1 (Chuông)',
                    data: new Array(T).fill(0).map((_, i) => (i >= cs1Start && i < cs1Start + cs1Dur) ? 0.5 : 0),
                    borderColor: '#3b82f6',
                    borderDash: [5, 5],
                    borderWidth: 1,
                    stepped: true
                },
                {
                    label: 'CS2 (Đèn)',
                    data: new Array(T).fill(0).map((_, i) => (cs2Dur > 0 && i >= cs2Start && i < cs2Start + cs2Dur) ? 0.3 : 0),
                    borderColor: '#ec4899',
                    borderDash: [2, 2],
                    borderWidth: 1,
                    stepped: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: { min: -0.2, max: usVal * 1.5, title: { display: true, text: 'Value / Signal' } },
                x: { title: { display: true, text: 'Time Step (t)' } }
            },
            plugins: {
                title: { display: true, text: 'Trial 0', color: 'white', font: { size: 16 } },
                legend: { labels: { color: 'white' } }
            }
        }
    });

    for (let trial = 1; trial <= numTrials; trial++) {
        let V = new Array(T).fill(0);
        
        // Calculate V(t)
        for (let t = 0; t < T; t++) {
            let v = 0;
            if (t >= cs1Start) v += w1[t - cs1Start];
            if (cs2Dur > 0 && t >= cs2Start) v += w2[t - cs2Start];
            V[t] = v;
        }

        // TD(0) Update
        for (let t = 0; t < T - 1; t++) {
            let R = (t === usStart) ? usVal : 0;
            let delta = R + gamma * V[t+1] - V[t];
            
            // Update weights for active features (t >= onset)
            if (t >= cs1Start) w1[t - cs1Start] += alpha * delta;
            if (cs2Dur > 0 && t >= cs2Start) w2[t - cs2Start] += alpha * delta;
        }

        // Animate charting
        if (trial === 1 || trial % Math.ceil(numTrials / 20) === 0 || trial === numTrials) {
            chart.data.datasets[0].data = V;
            chart.options.plugins.title.text = `Trial ${trial} / ${numTrials}`;
            chart.update();
            await sleep(50);
        }
    }
}
