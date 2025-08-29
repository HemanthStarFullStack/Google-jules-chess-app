// --- Game State (non-DOM) ---
const boardState = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
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
let sourceSquare = '';

// --- AI and Game Mode State (non-DOM) ---
let stockfish = null;
let isAiGame = false;
let playerColor = null;
let isAiThinking = false;

// --- DOM elements (will be initialized when DOM is ready) ---
let board = null;
let playerTurnDisplay = null;

// --- Helper Functions ---
function squareToRowCol(s) { return { row: 8 - parseInt(s[1]), col: s.charCodeAt(0) - 97 } }
function rowColToSquare(r, c) { return `${String.fromCharCode(97 + c)}${8 - r}` }
function getPieceColor(p) { return p === p.toUpperCase() ? 'white' : 'black' }

function boardStateToFen() {
    let fen = '';
    for (let i = 0; i < 8; i++) {
        let empty = 0;
        for (let j = 0; j < 8; j++) {
            const piece = boardState[i][j];
            if (piece) {
                if (empty > 0) { fen += empty; empty = 0; }
                fen += piece;
            } else { empty++; }
        }
        if (empty > 0) fen += empty;
        if (i < 7) fen += '/';
    }
    fen += ` ${currentPlayer === 'white' ? 'w' : 'b'}`;
    let castle = '';
    if (castlingRights.white.kingSide) castle += 'K';
    if (castlingRights.white.queenSide) castle += 'Q';
    if (castlingRights.black.kingSide) castle += 'k';
    if (castlingRights.black.queenSide) castleFen += 'q';
    fen += ` ${castle || '-'}`;
    if (enPassantTargetSquare) {
        fen += ` ${rowColToSquare(enPassantTargetSquare.row, enPassantTargetSquare.col)}`;
    } else { fen += ' -'; }
    fen += ' 0 1';
    return fen;
}

function updateStatus() {
    if (gameOver) return;
    let status = `Turn: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
    if (isAiGame && currentPlayer !== playerColor) {
        status = "Stockfish is thinking...";
    }
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
    playerTurnDisplay.text(status);
}

// --- Game Logic (Engine) ---
function getLegalMovesForPiece(r, c) {
    const p = boardState[r][c], moves = [];
    if (!p) return moves;
    for (let tr = 0; tr < 8; tr++) {
        for (let tc = 0; tc < 8; tc++) {
            if (isMoveLegal(p, r, c, tr, tc)) moves.push(rowColToSquare(tr, tc));
        }
    }
    return moves;
}

function makeMove(from, to) {
    const piece = boardState[from.row][from.col];
    const isEnP = piece.toLowerCase() === 'p' && enPassantTargetSquare && to.row === enPassantTargetSquare.row && to.col === enPassantTargetSquare.col;
    const isCastle = piece.toLowerCase() === 'k' && Math.abs(from.col - to.col) === 2;
    boardState[to.row][to.col] = piece;
    boardState[from.row][from.col] = '';
    if (isEnP) boardState[from.row][to.col] = '';
    if (isCastle) {
        const dir = to.col > from.col ? 1 : -1, rCol = dir === 1 ? 7 : 0, rToCol = dir === 1 ? 5 : 3;
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
    board.position(boardStateToFen());
    updateStatus();
    if (isAiGame && currentPlayer !== playerColor) {
        setTimeout(getAiMove, 250);
    }
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

// --- UI & AI Integration ---
function removeHighlights() { $('#board .square-55d63').removeClass('highlight-legal') }
function onSquareClick(sq) {
    if (gameOver || isAiThinking || (isAiGame && currentPlayer !== playerColor)) return;
    const c = squareToRowCol(sq), p = boardState[c.row][c.col];
    if (!sourceSquare && p && getPieceColor(p) === currentPlayer) {
        sourceSquare = sq;
        getLegalMovesForPiece(c.row, c.col).forEach(s => $(`#board .square-${s}`).addClass('highlight-legal'));
    } else if (sourceSquare) {
        removeHighlights();
        if (sourceSquare !== sq) {
            const from = squareToRowCol(sourceSquare), to = squareToRowCol(sq);
            if (isMoveLegal(boardState[from.row][from.col], from.row, from.col, to.row, to.col)) {
                makeMove(from, to);
            }
        }
        sourceSquare = '';
    }
}
function onDragStart(s, p) {
    if (gameOver || isAiThinking || p.search(new RegExp(`^${currentPlayer === 'white' ? 'w' : 'b'}`)) === -1 || (isAiGame && currentPlayer !== playerColor)) return false;
    removeHighlights(); sourceSquare = '';
}
function onDrop(src, tgt) {
    removeHighlights();
    const from = squareToRowCol(src), to = squareToRowCol(tgt);
    if (isMoveLegal(boardState[from.row][from.col], from.row, from.col, to.row, to.col)) {
        makeMove(from, to);
    } else return 'snapback';
}
function initStockfish() {
    stockfish = new Worker('stockfish.js');
    stockfish.addEventListener('message', function (e) {
        const bestMoveRegex = /bestmove\s([a-h][1-8])([a-h][1-8])/;
        const match = e.data.match(bestMoveRegex);
        if (match) {
            isAiThinking = false;
            makeMove(squareToRowCol(match[1]), squareToRowCol(match[2]));
        }
    });
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
}
function getAiMove() {
    isAiThinking = true;
    updateStatus();
    stockfish.postMessage(`position fen ${boardStateToFen()}`);
    stockfish.postMessage('go depth 15');
}

// --- Main Execution ---
function startGame() {
    const config = {
        draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    $('#board').on('click', 'div[data-square]', function() { onSquareClick($(this).data('square')) });
    if(isAiGame) initStockfish();
    if(isAiGame && playerColor === 'black') getAiMove();
    updateStatus();
}

$(function() {
    playerTurnDisplay = $('#current-player');
    $('#pvp-button').on('click', () => {
        isAiGame = false;
        $('#game-mode-modal').addClass('hidden');
        startGame();
    });
    $('#pva-button').on('click', () => {
        $('#color-selection').removeClass('hidden');
    });
    $('#white-button').on('click', () => {
        isAiGame = true; playerColor = 'white';
        $('#game-mode-modal').addClass('hidden');
        startGame();
    });
    $('#black-button').on('click', () => {
        isAiGame = true; playerColor = 'black';
        $('#game-mode-modal').addClass('hidden');
        startGame();
    });
});
