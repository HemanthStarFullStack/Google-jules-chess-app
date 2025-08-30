document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const chessboardEl = document.getElementById('chessboard');
    const playerTurnDisplay = document.getElementById('current-player');

    // --- Game State ---
    const boardState = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    let currentPlayer = 'white';
    let gameOver = false;
    let enPassantTargetSquare = null;
    let castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    let selectedSquare = null;

    // --- Piece Representation ---
    const pieceToIdMap = {
        'r': 'br', 'n': 'bn', 'b': 'bb', 'q': 'bq', 'k': 'bk', 'p': 'bp',
        'R': 'wr', 'N': 'wn', 'B': 'wb', 'Q': 'wq', 'K': 'wk', 'P': 'wp'
    };

    // --- Helper Functions ---
    function getPieceColor(p) { return p === p.toUpperCase() ? 'white' : 'black' }

    // --- Rendering ---
    function initBoard() {
        chessboardEl.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const squareEl = document.createElement('div');
                squareEl.classList.add('square');
                const isWhite = (i + j) % 2 === 0;
                squareEl.classList.add(isWhite ? 'white' : 'black');
                squareEl.dataset.row = i;
                squareEl.dataset.col = j;
                squareEl.addEventListener('click', () => onSquareClick(i, j));
                chessboardEl.appendChild(squareEl);
            }
        }
        updateBoard();
    }

    function updateBoard() {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const squareEl = chessboardEl.querySelector(`[data-row='${i}'][data-col='${j}']`);
                const piece = boardState[i][j];

                // Clear previous content
                squareEl.innerHTML = '';
                squareEl.classList.remove('selected');

                if (selectedSquare && selectedSquare.row === i && selectedSquare.col === j) {
                    squareEl.classList.add('selected');
                }

                if (piece) {
                    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    const useEl = document.createElementNS("http://www.w3.org/2000/svg", "use");
                    useEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", `assets/pieces/staunty.svg#${pieceToIdMap[piece]}`);
                    svgEl.appendChild(useEl);
                    squareEl.appendChild(svgEl);
                }
            }
        }
        updateStatus();
    }

    function updateStatus() {
        if (gameOver) return;
        let status = `Turn: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
        const legalMoves = generateAllLegalMoves(currentPlayer);
        if (legalMoves.length === 0) {
            gameOver = true;
            if (isInCheck(currentPlayer)) {
                status = 'Checkmate! ' + (currentPlayer === 'white' ? 'Black' : 'White') + ' wins.';
            } else {
                status = 'Stalemate! The game is a draw.';
            }
        } else if (isInCheck(currentPlayer)) {
            status += ' (in check)';
        }
        playerTurnDisplay.textContent = status;
    }

    // --- Game Logic (Engine) ---
    function makeMove(from, to) {
        const piece = boardState[from.row][from.col];
        const isEnP = piece.toLowerCase() === 'p' && enPassantTargetSquare && to.row === enPassantTargetSquare.row && to.col === enPassantTargetSquare.col;
        const isCastle = piece.toLowerCase() === 'k' && Math.abs(from.col - to.col) === 2;
        boardState[to.row][to.col] = piece;
        boardState[from.row][from.col] = '';
        if (isEnP) boardState[from.row][to.col] = '';
        if (isCastle) {
            const dir = to.col > from.col ? 1 : -1;
            const rCol = dir === 1 ? 7 : 0;
            const rToCol = dir === 1 ? 5 : 3;
            const rook = boardState[from.row][rCol];
            boardState[from.row][rToCol] = rook;
            boardState[from.row][rCol] = '';
        }
        enPassantTargetSquare = (piece.toLowerCase() === 'p' && Math.abs(from.row - to.row) === 2) ? { row: (from.row + to.row) / 2, col: from.col } : null;
        if (piece === 'K') castlingRights.white = { kingSide: false, queenSide: false };
        if (piece === 'k') castlingRights.black = { kingSide: false, queenSide: false };
        if (piece === 'R' && from.row === 7 && from.col === 0) castlingRights.white.queenSide = false;
        if (piece === 'R' && from.row === 7 && from.col === 7) castlingRights.white.kingSide = false;
        if (piece === 'r' && from.row === 0 && from.col === 0) castlingRights.black.queenSide = false;
        if (piece === 'r' && from.row === 0 && from.col === 7) castlingRights.black.kingSide = false;
        if (piece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7)) {
            boardState[to.row][to.col] = getPieceColor(piece) === 'white' ? 'Q' : 'q';
        }
        currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    }

    function isMoveLegal(p, r1, c1, r2, c2) {
        if (!isValidMove(p, r1, c1, r2, c2)) return false;
        const op = boardState[r2][c2];
        boardState[r2][c2] = p; boardState[r1][c1] = '';
        const isCheck = isInCheck(getPieceColor(p));
        boardState[r1][c1] = p; boardState[r2][c2] = op;
        return !isCheck;
    }

    function isValidMove(p, r1, c1, r2, c2) {
        const pt = p.toLowerCase(), pc = getPieceColor(p), dp = boardState[r2][c2];
        if (dp && getPieceColor(dp) === pc) return false;
        switch (pt) {
            case 'p':
                const dir = pc === 'white' ? -1 : 1;
                if (c1 === c2 && !dp && r2 === r1 + dir) return true;
                if (c1 === c2 && !dp && (pc === 'white' ? 6 : 1) === r1 && r2 === r1 + 2 * dir && isPathClear(r1, c1, r2, c2)) return true;
                if (Math.abs(c1 - c2) === 1 && r2 === r1 + dir && dp) return true;
                if (enPassantTargetSquare && r2 === enPassantTargetSquare.row && c2 === enPassantTargetSquare.col && Math.abs(c1 - c2) === 1 && r2 === r1 + dir) return true;
                return false;
            case 'n': const rd = Math.abs(r2 - r1), cd = Math.abs(c2 - c1); return (rd === 2 && cd === 1) || (rd === 1 && cd === 2);
            case 'b': return Math.abs(r2 - r1) === Math.abs(c2 - c1) && isPathClear(r1, c1, r2, c2);
            case 'r': return (r2 === r1 || c2 === c1) && isPathClear(r1, c1, r2, c2);
            case 'q': return (Math.abs(r2 - r1) === Math.abs(c2 - c1) || r2 === r1 || c2 === c1) && isPathClear(r1, c1, r2, c2);
            case 'k':
                const krd = Math.abs(r2 - r1), kcd = Math.abs(c2 - c1);
                if (krd <= 1 && kcd <= 1) return true;
                if (krd === 0 && kcd === 2) {
                    if (isInCheck(pc)) return false;
                    const cdir = c2 > c1 ? 1 : -1, rs = cdir === 1 ? 'kingSide' : 'queenSide';
                    if (!castlingRights[pc][rs]) return false;
                    const rc = cdir === 1 ? 7 : 0;
                    if (!isPathClear(r1, c1, r1, rc)) return false;
                    if (isSquareAttacked(r1, c1 + cdir, pc === 'white' ? 'black' : 'white')) return false;
                    return true;
                }
                return false;
        }
    }
    function isPathClear(r1, c1, r2, c2) {
        const rs = Math.sign(r2 - r1), cs = Math.sign(c2 - c1);
        let r = r1 + rs, c = c1 + cs;
        while (r !== r2 || c !== c2) {
            if (boardState[r][c]) return false;
            r += rs; c += cs;
        }
        return true;
    }
    function findKing(c) {
        const k = c === 'white' ? 'K' : 'k';
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (boardState[i][j] === k) return { row: i, col: j };
        return null;
    }
    function isInCheck(c) { const kp = findKing(c); return kp && isSquareAttacked(kp.row, kp.col, c === 'white' ? 'black' : 'white') }
    function isSquareAttacked(r, c, ac) {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
            const p = boardState[i][j];
            if (p && getPieceColor(p) === ac && isValidMove(p, i, j, r, c)) return true;
        }
        return false;
    }
    function generateAllLegalMoves(c) {
        const m = [];
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
            const p = boardState[i][j];
            if (p && getPieceColor(p) === c) for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) if (isMoveLegal(p, i, j, r, col)) m.push({});
        }
        return m;
    }

    // --- UI Interaction ---
    function onSquareClick(row, col) {
        if (gameOver) return;
        const piece = boardState[row][col];
        if (!selectedSquare && piece && getPieceColor(piece) === currentPlayer) {
            selectedSquare = { row, col };
        } else if (selectedSquare) {
            const from = selectedSquare;
            const to = { row, col };
            if (isMoveLegal(boardState[from.row][from.col], from.row, from.col, to.row, to.col)) {
                makeMove(from, to);
            }
            selectedSquare = null;
        }
        updateBoard();
    }

    // --- Main Execution ---
    initBoard();
});
