// Tic-Tac-Toe Self-Play with TD(0) Afterstates
// Inspired by Sutton & Barto Chapter 1 & Chapter 16

const BOARD_SIZE = 9;
let V = {}; // Value function mapping state string to win probability for O
let isTraining = false;
let isHumanPlaying = false;
let currentBoard = Array(BOARD_SIZE).fill('.');
let humanPlayer = 'X';
let agentPlayer = 'O';

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('gameStatus');
let chart;

// --- Initialize ---
function initBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < BOARD_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => onCellClick(i));
        boardEl.appendChild(cell);
    }
}

function renderBoard() {
    const cells = boardEl.children;
    for (let i = 0; i < BOARD_SIZE; i++) {
        cells[i].innerText = currentBoard[i] === '.' ? '' : currentBoard[i];
        cells[i].className = 'ttt-cell ' + (currentBoard[i] !== '.' ? currentBoard[i].toLowerCase() : '');
    }
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] !== '.' && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // 'X' or 'O'
        }
    }
    if (!board.includes('.')) return 'Draw';
    return null;
}

function getStateStr(board) {
    return board.join('');
}

function getV(state) {
    if (V[state] !== undefined) return V[state];
    
    // Initialize terminal states
    const winner = checkWinner(state.split(''));
    if (winner === 'O') V[state] = 1.0;
    else if (winner === 'X') V[state] = 0.0;
    else if (winner === 'Draw') V[state] = 0.5; // Draw is slightly better than losing for O
    else V[state] = 0.5; // Unknown states initialized to 0.5
    
    return V[state];
}

// --- Agent Logic ---
function getAvailableMoves(board) {
    let moves = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        if (board[i] === '.') moves.push(i);
    }
    return moves;
}

function getBestMove(board, player, epsilon) {
    const moves = getAvailableMoves(board);
    if (moves.length === 0) return null;

    // Explore
    if (Math.random() < epsilon) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // Exploit (Afterstates)
    let bestMove = -1;
    let bestValue = player === 'O' ? -Infinity : Infinity;

    // O wants to maximize V, X wants to minimize V (Minimax concept in Self-Play)
    for (let move of moves) {
        let nextBoard = [...board];
        nextBoard[move] = player;
        let stateStr = getStateStr(nextBoard);
        let val = getV(stateStr);
        
        if (player === 'O') {
            // Maximizer
            if (val > bestValue || (val === bestValue && Math.random() < 0.5)) {
                bestValue = val;
                bestMove = move;
            }
        } else {
            // Minimizer
            if (val < bestValue || (val === bestValue && Math.random() < 0.5)) {
                bestValue = val;
                bestMove = move;
            }
        }
    }
    return bestMove;
}

// --- Training (Self-Play) ---
async function startTraining() {
    if (isTraining) return;
    isTraining = true;
    isHumanPlaying = false;
    
    const episodes = parseInt(document.getElementById('episodes').value);
    const epsilon = parseFloat(document.getElementById('epsilon').value);
    const alpha = parseFloat(document.getElementById('alpha').value);
    
    statusEl.innerText = "Đang huấn luyện (Self-Play)...";
    
    let winCount = 0;
    let drawCount = 0;
    let lossCount = 0;
    let winRates = [];
    let labels = [];

    initChart();

    for (let ep = 1; ep <= episodes; ep++) {
        let board = Array(BOARD_SIZE).fill('.');
        let historyO = []; // Track afterstates for O
        let historyX = []; // Track afterstates for X
        let currentPlayer = 'X'; // X goes first

        while (true) {
            let move = getBestMove(board, currentPlayer, epsilon);
            board[move] = currentPlayer;
            let afterstate = getStateStr(board);
            
            if (currentPlayer === 'O') historyO.push(afterstate);
            else historyX.push(afterstate);

            let winner = checkWinner(board);
            if (winner) {
                // Update terminal state value implicitly handled in getV
                // Perform TD(0) update backwards
                updateTD(historyO, alpha);
                updateTD(historyX, alpha); // Both learn from the experience

                // Record stats for Chart (Agent O's perspective)
                if (winner === 'O') winCount++;
                else if (winner === 'Draw') drawCount++;
                else lossCount++;
                break;
            }
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        }

        // Update chart every 500 episodes
        if (ep % (episodes / 20) === 0 || ep === episodes) {
            let total = winCount + lossCount + drawCount;
            winRates.push((winCount / total) * 100);
            labels.push(ep);
            updateChartData(labels, winRates);
            
            // Render the last board to look cool
            currentBoard = board;
            renderBoard();
            
            // Reset counters for the next bucket to see moving average
            winCount = 0; drawCount = 0; lossCount = 0;
            
            // Yield to browser
            await new Promise(r => setTimeout(r, 0));
        }
    }

    isTraining = false;
    statusEl.innerText = "Huấn luyện hoàn tất! Bạn có thể chơi thử với Agent.";
}

function updateTD(history, alpha) {
    if (history.length === 0) return;
    // TD(0) Afterstate update: V(S_t) <- V(S_t) + alpha * [V(S_{t+1}) - V(S_t)]
    // We iterate backwards. The last state is terminal, its value is fixed.
    let target = getV(history[history.length - 1]);
    for (let i = history.length - 2; i >= 0; i--) {
        let state = history[i];
        let currentV = getV(state);
        V[state] = currentV + alpha * (target - currentV);
        target = V[state]; // Bootstrap
    }
}

// --- Human Play ---
function startHumanGame() {
    if (isTraining) {
        alert("Đang huấn luyện, vui lòng chờ!");
        return;
    }
    isHumanPlaying = true;
    currentBoard = Array(BOARD_SIZE).fill('.');
    renderBoard();
    statusEl.innerText = "Lượt của bạn (X). Vui lòng chọn ô.";
}

function onCellClick(index) {
    if (!isHumanPlaying || currentBoard[index] !== '.') return;
    
    // Human move (X)
    currentBoard[index] = humanPlayer;
    renderBoard();
    
    let winner = checkWinner(currentBoard);
    if (winner) {
        endHumanGame(winner);
        return;
    }

    // Agent move (O)
    statusEl.innerText = "Agent (O) đang suy nghĩ...";
    setTimeout(() => {
        let move = getBestMove(currentBoard, agentPlayer, 0.0); // Epsilon 0 for exploiting
        if (move !== null) {
            currentBoard[move] = agentPlayer;
            renderBoard();
            winner = checkWinner(currentBoard);
            if (winner) {
                endHumanGame(winner);
            } else {
                statusEl.innerText = "Lượt của bạn (X).";
            }
        }
    }, 200);
}

function endHumanGame(winner) {
    isHumanPlaying = false;
    if (winner === 'Draw') statusEl.innerText = "Hòa! Agent đã phòng thủ tốt.";
    else if (winner === humanPlayer) statusEl.innerText = "Bạn (X) đã thắng! (Cần train Agent thêm)";
    else statusEl.innerText = "Agent (O) đã thắng! Sự siêu việt của RL!";
}

// --- Chart JS ---
function initChart() {
    const ctx = document.getElementById('winRateChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Tỷ lệ thắng của Agent O (%)',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100 }
            }
        }
    });
}

function updateChartData(labels, data) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
}

// Initialize on load
initBoard();
initChart();
