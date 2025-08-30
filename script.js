document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('chessboard');
    const statusElement = document.getElementById('status'); // This ID doesn't exist, but we'll add a placeholder if needed
    const turnElement = document.getElementById('current-player');
    const gameModeModal = document.getElementById('game-mode-modal');
    const pvpButton = document.getElementById('pvp-button');
    const pvaiButton = document.getElementById('pva-button');

    let game = new Chess();
    let stockfish = null;
    let playerColor = 'w';
    let gameMode = null; // 'pvp' or 'pvai'

    // --- STOCKFISH AI ---
    function initStockfish() {
        if (stockfish) {
            try {
               stockfish.terminate();
            } catch(e) {
                console.warn("Failed to terminate previous stockfish instance", e);
            }
        }
        try {
            stockfish = new Worker('stockfish.wasm.js');
            stockfish.onmessage = (event) => {
                const message = event.data;
                if (message.startsWith('bestmove')) {
                    const bestMove = message.split(' ')[1];
                    const from = bestMove.substring(0, 2);
                    const to = bestMove.substring(2, 4);
                    const promotion = bestMove.length > 4 ? bestMove.substring(4) : undefined;

                    game.move({ from, to, promotion });
                    renderBoard();
                    updateStatus();
                }
            };
            stockfish.postMessage('uci');
            stockfish.postMessage('isready');
            stockfish.postMessage('ucinewgame');
        } catch (error) {
            console.error('Failed to initialize Stockfish:', error);
            if(statusElement) statusElement.textContent = 'Error: Could not load AI engine.';
        }
    }

    function getBestMove() {
        if (!stockfish || game.game_over()) return;
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go depth 15');
    }

    // --- UI & GAME FLOW ---

    function renderBoard() {
        boardElement.innerHTML = '';
        const squares = game.board();
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = squares[i][j];
                const squareElement = document.createElement('div');
                squareElement.classList.add('square', (i + j) % 2 === 0 ? 'white' : 'black');
                squareElement.dataset.row = i;
                squareElement.dataset.col = j;

                if (square) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece');
                    pieceElement.textContent = getPieceUnicode(square);
                    pieceElement.dataset.piece = `${square.color}${square.type}`;
                    squareElement.appendChild(pieceElement);
                }
                boardElement.appendChild(squareElement);
            }
        }
        updateStatus();
    }

    function getPieceUnicode(piece) {
        const unicodeMap = {
            p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔',
            P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚'
        };
        const key = piece.color === 'w' ? piece.type : piece.type.toUpperCase();
        return unicodeMap[key];
    }

    function updateStatus() {
        let statusText = '';
        if (game.in_checkmate()) {
            statusText = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
        } else if (game.in_draw()) {
            statusText = 'Draw!';
        } else if (game.in_check()) {
            statusText = 'Check!';
        }

        // A status element doesn't exist in the HTML, so we won't set it.
        // if (statusElement) {
        //    statusElement.textContent = statusText;
        // }

        if (turnElement) {
            turnElement.textContent = `${game.turn() === 'w' ? 'White' : 'Black'}'s Turn`;
             if (game.in_check()) {
                turnElement.textContent += ' (Check)';
            }
        }
    }

    let selectedSquare = null;
    let legalMoves = [];

    function handleSquareClick(event) {
        if (game.game_over()) return;

        const squareElement = event.target.closest('.square');
        if (!squareElement) return;

        const row = parseInt(squareElement.dataset.row);
        const col = parseInt(squareElement.dataset.col);
        const algebraic = String.fromCharCode(97 + col) + (8 - row);

        // AI's turn
        if (gameMode === 'pvai' && game.turn() !== playerColor) {
            return;
        }

        if (selectedSquare) {
            const move = legalMoves.find(m => m.to === algebraic);
            if (move) {
                let promotion = undefined;
                if (move.flags.includes('p')) {
                    promotion = prompt("Promote to (q, r, b, n)?", "q") || 'q';
                     if (!['q', 'r', 'b', 'n'].includes(promotion)) {
                        selectedSquare = null;
                        clearHighlights();
                        return;
                    }
                }

                game.move({
                    from: selectedSquare,
                    to: algebraic,
                    promotion: promotion
                });

                selectedSquare = null;
                clearHighlights();
                renderBoard();

                if (gameMode === 'pvai' && !game.game_over()) {
                    setTimeout(getBestMove, 250);
                }

            } else {
                selectedSquare = null;
                clearHighlights();
                const piece = game.get(algebraic);
                if (piece && piece.color === game.turn()) {
                    selectPiece(algebraic, squareElement);
                }
            }
        } else {
            const piece = game.get(algebraic);
            if (piece && piece.color === game.turn()) {
                selectPiece(algebraic, squareElement);
            }
        }
    }

    function selectPiece(algebraic, squareElement) {
        selectedSquare = algebraic;
        legalMoves = game.moves({ square: algebraic, verbose: true });

        clearHighlights();
        squareElement.classList.add('selected');
        legalMoves.forEach(move => {
            const targetSquareEl = document.querySelector(`[data-row='${8 - parseInt(move.to[1])}'][data-col='${move.to.charCodeAt(0) - 97}']`);
            if (targetSquareEl) {
                 targetSquareEl.classList.add('highlight-legal');
            }
        });
    }

    function clearHighlights() {
        document.querySelectorAll('.square.selected').forEach(s => s.classList.remove('selected'));
        document.querySelectorAll('.highlight-legal').forEach(h => h.classList.remove('highlight-legal'));
    }

    function startGame(mode) {
        gameMode = mode;
        game = new Chess();
        selectedSquare = null;
        legalMoves = [];
        playerColor = 'w';

        if (mode === 'pvai') {
            initStockfish();
        }

        renderBoard();
        boardElement.addEventListener('click', handleSquareClick);
        gameModeModal.style.display = 'none';
    }

    // --- INITIALIZATION ---
    pvpButton.addEventListener('click', () => startGame('pvp'));
    pvaiButton.addEventListener('click', () => startGame('pvai'));

    // Show the modal on page load
    gameModeModal.style.display = 'flex';
});
