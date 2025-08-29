import { Chessboard, INPUT_EVENT_TYPE, FEN } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js";

document.addEventListener('DOMContentLoaded', () => {

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
    const playerTurnDisplay = document.getElementById('current-player');

    // --- Helper Functions ---

    function boardStateToFen() {
        let fen = '';
        for (let i = 0; i < 8; i++) {
            let emptyCount = 0;
            for (let j = 0; j < 8; j++) {
                const piece = boardState[i][j];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += piece;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (i < 7) {
                fen += '/';
            }
        }

        fen += ` ${currentPlayer === 'white' ? 'w' : 'b'}`;

        let castleFen = '';
        if (castlingRights.white.kingSide) castleFen += 'K';
        if (castlingRights.white.queenSide) castleFen += 'Q';
        if (castlingRights.black.kingSide) castleFen += 'k';
        if (castlingRights.black.queenSide) castleFen += 'q';
        fen += ` ${castleFen || '-'}`;

        if (enPassantTargetSquare) {
            fen += ` ${rowColToSquare(enPassantTargetSquare.row, enPassantTargetSquare.col)}`;
        } else {
            fen += ' -';
        }

        fen += ' 0 1';
        return fen;
    }

    function squareToRowCol(square) {
        const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
        const row = 8 - parseInt(square.charAt(1), 10);
        return { row, col };
    }

    function rowColToSquare(row, col) {
        const file = String.fromCharCode('a'.charCodeAt(0) + col);
        const rank = 8 - row;
        return `${file}${rank}`;
    }

    function updateTurnDisplay() {
        playerTurnDisplay.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
    }

    function getPieceColor(piece) {
        if (!piece) return null;
        return piece === piece.toUpperCase() ? 'white' : 'black';
    }

    // --- Game Logic Functions (The Engine) ---

    function isMoveLegal(piece, fromRow, fromCol, toRow, toCol) {
        if (!isValidMove(piece, fromRow, fromCol, toRow, toCol)) {
            return false;
        }
        const originalPiece = boardState[toRow][toCol];
        boardState[toRow][toCol] = piece;
        boardState[fromRow][fromCol] = '';
        const inCheck = isInCheck(getPieceColor(piece));
        boardState[fromRow][fromCol] = piece;
        boardState[toRow][toCol] = originalPiece;
        return !inCheck;
    }

    function isValidMove(piece, fromRow, fromCol, toRow, toCol) {
        const pieceType = piece.toLowerCase();
        const pieceColor = getPieceColor(piece);
        const destinationPiece = boardState[toRow][toCol];

        if (destinationPiece && getPieceColor(destinationPiece) === pieceColor) {
            return false;
        }

        switch (pieceType) {
            case 'p':
                const direction = pieceColor === 'white' ? -1 : 1;
                if (fromCol === toCol && destinationPiece === '' && toRow === fromRow + direction) return true;
                if (fromCol === toCol && destinationPiece === '' && (pieceColor === 'white' ? 6 : 1) === fromRow && toRow === fromRow + 2 * direction && isPathClear(fromRow, fromCol, toRow, toCol)) return true;
                if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction && destinationPiece) return true;
                if (enPassantTargetSquare && toRow === enPassantTargetSquare.row && toCol === enPassantTargetSquare.col && Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) return true;
                return false;
            case 'n':
                const rowDiff = Math.abs(toRow - fromRow);
                const colDiff = Math.abs(toCol - fromCol);
                return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            case 'b':
                return Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol) && isPathClear(fromRow, fromCol, toRow, toCol);
            case 'r':
                return (toRow === fromRow || toCol === fromCol) && isPathClear(fromRow, fromCol, toRow, toCol);
            case 'q':
                return (Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol) || toRow === fromRow || toCol === fromCol) && isPathClear(fromRow, fromCol, toRow, toCol);
            case 'k':
                const kingRowDiff = Math.abs(toRow - fromRow);
                const kingColDiff = Math.abs(toCol - fromCol);
                if (kingRowDiff <= 1 && kingColDiff <= 1) return true;
                if (kingRowDiff === 0 && kingColDiff === 2) {
                    if (isInCheck(pieceColor)) return false;
                    const castleDirection = toCol > fromCol ? 1 : -1;
                    const rookSide = castleDirection === 1 ? 'kingSide' : 'queenSide';
                    if (!castlingRights[pieceColor][rookSide]) return false;
                    const rookCol = castleDirection === 1 ? 7 : 0;
                    if (!isPathClear(fromRow, fromCol, fromRow, rookCol)) return false;
                    if (isSquareAttacked(fromRow, fromCol + castleDirection, pieceColor === 'white' ? 'black' : 'white')) return false;
                    return true;
                }
                return false;
            default:
                return false;
        }
    }

    function isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        while (currentRow !== toRow || currentCol !== toCol) {
            if (boardState[currentRow][currentCol] !== '') return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        return true;
    }

    function findKing(color) {
        const kingPiece = color === 'white' ? 'K' : 'k';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (boardState[i][j] === kingPiece) return { row: i, col: j };
            }
        }
        return null;
    }

    function isInCheck(color) {
        const kingPos = findKing(color);
        if (!kingPos) return false;
        return isSquareAttacked(kingPos.row, kingPos.col, color === 'white' ? 'black' : 'white');
    }

    function isSquareAttacked(row, col, attackerColor) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardState[i][j];
                if (piece && getPieceColor(piece) === attackerColor) {
                    if (isValidMove(piece, i, j, row, col)) return true;
                }
            }
        }
        return false;
    }

    function generateAllLegalMoves(color) {
        const legalMoves = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardState[i][j];
                if (piece && getPieceColor(piece) === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (isMoveLegal(piece, i, j, toRow, toCol)) {
                                legalMoves.push({ from: [i, j], to: [toRow, toCol] });
                            }
                        }
                    }
                }
            }
        }
        return legalMoves;
    }

    // --- Main Execution ---

    const board = new Chessboard(document.getElementById('chessboard'), {
        position: FEN.start,
        assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
        style: {
            cssClass: "blue",
            pieces: {
                file: "pieces/staunty.svg"
            }
        }
    });

    function inputHandler(event) {
        if (gameOver) {
            event.preventDefault();
            return;
        }

        switch (event.type) {
            case INPUT_EVENT_TYPE.moveInputStarted:
                const from = squareToRowCol(event.squareFrom);
                const piece = boardState[from.row][from.col];
                return piece && getPieceColor(piece) === currentPlayer;

            case INPUT_EVENT_TYPE.validateMoveInput:
                const fromCoords = squareToRowCol(event.squareFrom);
                const toCoords = squareToRowCol(event.squareTo);
                const movingPiece = boardState[fromCoords.row][fromCoords.col];

                if (isMoveLegal(movingPiece, fromCoords.row, fromCoords.col, toCoords.row, toCoords.col)) {

                    const isEnPassant = movingPiece.toLowerCase() === 'p' && enPassantTargetSquare && toCoords.row === enPassantTargetSquare.row && toCoords.col === enPassantTargetSquare.col;
                    const isCastling = movingPiece.toLowerCase() === 'k' && Math.abs(fromCoords.col - toCoords.col) === 2;

                    boardState[toCoords.row][toCoords.col] = movingPiece;
                    boardState[fromCoords.row][fromCoords.col] = '';

                    if (isEnPassant) {
                        boardState[fromCoords.row][toCoords.col] = '';
                    }
                    if (isCastling) {
                        const direction = toCoords.col > fromCoords.col ? 1 : -1;
                        const rookCol = direction === 1 ? 7 : 0;
                        const rookToCol = direction === 1 ? 5 : 3;
                        const rook = boardState[fromCoords.row][rookCol];
                        boardState[fromCoords.row][rookToCol] = rook;
                        boardState[fromCoords.row][rookCol] = '';
                    }

                    if (movingPiece.toLowerCase() === 'p' && Math.abs(fromCoords.row - toCoords.row) === 2) {
                        enPassantTargetSquare = { row: (fromCoords.row + toCoords.row) / 2, col: fromCoords.col };
                    } else {
                        enPassantTargetSquare = null;
                    }

                    if (movingPiece === 'K') { castlingRights.white.kingSide = false; castlingRights.white.queenSide = false; }
                    if (movingPiece === 'k') { castlingRights.black.kingSide = false; castlingRights.black.queenSide = false; }
                    if (movingPiece === 'R' && fromCoords.row === 7 && fromCoords.col === 0) { castlingRights.white.queenSide = false; }
                    if (movingPiece === 'R' && fromCoords.row === 7 && fromCoords.col === 7) { castlingRights.white.kingSide = false; }
                    if (movingPiece === 'r' && fromCoords.row === 0 && fromCoords.col === 0) { castlingRights.black.queenSide = false; }
                    if (movingPiece === 'r' && fromCoords.row === 0 && fromCoords.col === 7) { castlingRights.black.kingSide = false; }

                    if (movingPiece.toLowerCase() === 'p') {
                        const promotionRank = getPieceColor(movingPiece) === 'white' ? 0 : 7;
                        if (toCoords.row === promotionRank) {
                            boardState[toCoords.row][toCoords.col] = getPieceColor(movingPiece) === 'white' ? 'Q' : 'q';
                        }
                    }

                    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
                    updateTurnDisplay();

                    setTimeout(() => {
                        board.setPosition(boardStateToFen(), true);
                        const legalMoves = generateAllLegalMoves(currentPlayer);
                        if (legalMoves.length === 0) {
                            gameOver = true;
                            if (isInCheck(currentPlayer)) {
                                playerTurnDisplay.textContent = 'Checkmate! ' + (currentPlayer === 'white' ? 'Black' : 'White') + ' wins.';
                            } else {
                                playerTurnDisplay.textContent = 'Stalemate! The game is a draw.';
                            }
                        } else if (isInCheck(currentPlayer)) {
                            playerTurnDisplay.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`;
                        } else {
                             updateTurnDisplay();
                        }
                    }, 250);

                    return true;
                }
                return false;
        }
    }

    board.enableMoveInput(inputHandler);
    updateTurnDisplay();
});
