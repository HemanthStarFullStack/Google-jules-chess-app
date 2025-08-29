document.addEventListener('DOMContentLoaded', () => {
    const chessboard = document.getElementById('chessboard');

    const pieces = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    };

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

    let selectedSquare = null;
    let currentPlayer = 'white';
    let gameOver = false;
    let enPassantTargetSquare = null;
    let castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    const playerTurnDisplay = document.getElementById('current-player');

    function renderBoard() {
        chessboard.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = document.createElement('div');
                square.classList.add('square');
                const isWhite = (i + j) % 2 === 0;
                square.classList.add(isWhite ? 'white' : 'black');
                square.dataset.row = i;
                square.dataset.col = j;

                if (selectedSquare && selectedSquare.row === i && selectedSquare.col === j) {
                    square.classList.add('selected');
                }

                const piece = boardState[i][j];
                if (piece) {
                    square.textContent = pieces[piece];
                }

                square.addEventListener('click', () => handleSquareClick(i, j));

                chessboard.appendChild(square);
            }
        }
    }

    function handleSquareClick(row, col) {
        if (gameOver) return;

        if (selectedSquare) {
            const fromRow = selectedSquare.row;
            const fromCol = selectedSquare.col;
            const piece = boardState[fromRow][fromCol];

            if (fromRow === row && fromCol === col) {
                selectedSquare = null;
            } else {
                const destinationPiece = boardState[row][col];
                if (destinationPiece && getPieceColor(piece) === getPieceColor(destinationPiece)) {
                    selectedSquare = { row, col };
                } else if (isMoveLegal(piece, fromRow, fromCol, row, col)) {

                    const isEnPassant = piece.toLowerCase() === 'p' && enPassantTargetSquare && row === enPassantTargetSquare.row && col === enPassantTargetSquare.col;
                    const isCastling = piece.toLowerCase() === 'k' && Math.abs(fromCol - col) === 2;

                    // Move the piece (king)
                    boardState[row][col] = piece;
                    boardState[fromRow][fromCol] = '';

                    // Handle special moves
                    if (isEnPassant) {
                        const capturedPawnRow = fromRow;
                        const capturedPawnCol = col;
                        boardState[capturedPawnRow][capturedPawnCol] = '';
                    }
                    if (isCastling) {
                        const direction = col > fromCol ? 1 : -1;
                        const rookCol = direction === 1 ? 7 : 0;
                        const rookToCol = direction === 1 ? 5 : 3;
                        const rook = boardState[fromRow][rookCol];
                        boardState[fromRow][rookToCol] = rook;
                        boardState[fromRow][rookCol] = '';
                    }

                    // Set en passant target for the next turn
                    if (piece.toLowerCase() === 'p' && Math.abs(fromRow - row) === 2) {
                        enPassantTargetSquare = { row: (fromRow + row) / 2, col: fromCol };
                    } else {
                        enPassantTargetSquare = null;
                    }

                    // Update castling rights if king or rook moves
                    if (piece === 'K') { castlingRights.white.kingSide = false; castlingRights.white.queenSide = false; }
                    if (piece === 'k') { castlingRights.black.kingSide = false; castlingRights.black.queenSide = false; }
                    if (piece === 'R' && fromRow === 7 && fromCol === 0) { castlingRights.white.queenSide = false; }
                    if (piece === 'R' && fromRow === 7 && fromCol === 7) { castlingRights.white.kingSide = false; }
                    if (piece === 'r' && fromRow === 0 && fromCol === 0) { castlingRights.black.queenSide = false; }
                    if (piece === 'r' && fromRow === 0 && fromCol === 7) { castlingRights.black.kingSide = false; }

                    // Check for pawn promotion
                    if (piece.toLowerCase() === 'p') {
                        const promotionRank = getPieceColor(piece) === 'white' ? 0 : 7;
                        if (row === promotionRank) {
                            boardState[row][col] = getPieceColor(piece) === 'white' ? 'Q' : 'q';
                        }
                    }

                    selectedSquare = null;
                    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
                    updateTurnDisplay();

                    const legalMoves = generateAllLegalMoves(currentPlayer);
                    if (legalMoves.length === 0) {
                        gameOver = true;
                        if (isInCheck(currentPlayer)) {
                            playerTurnDisplay.textContent = 'Checkmate! ' + (currentPlayer === 'white' ? 'Black' : 'White') + ' wins.';
                        } else {
                            playerTurnDisplay.textContent = 'Stalemate! The game is a draw.';
                        }
                    } else if (isInCheck(currentPlayer)) {
                        console.log(currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + " is in check!");
                    }
                } else {
                    selectedSquare = null;
                    console.log("Invalid move");
                }
            }
        } else {
            const piece = boardState[row][col];
            if (piece && getPieceColor(piece) === currentPlayer) {
                selectedSquare = { row, col };
            }
        }
        renderBoard();
    }

    function isValidMove(piece, fromRow, fromCol, toRow, toCol) {
        const pieceType = piece.toLowerCase();
        const pieceColor = getPieceColor(piece);
        const destinationPiece = boardState[toRow][toCol];

        // A piece cannot capture a piece of the same color. This is already checked in handleSquareClick,
        // but it's good practice to have it here as well.
        if (destinationPiece && getPieceColor(destinationPiece) === pieceColor) {
            return false;
        }

        switch (pieceType) {
            case 'p': // Pawn
                const direction = pieceColor === 'white' ? -1 : 1;
                const startRow = pieceColor === 'white' ? 6 : 1;

                // 1. One square forward
                if (fromCol === toCol && destinationPiece === '' && toRow === fromRow + direction) {
                    return true;
                }

                // 2. Two squares forward from start
                if (fromCol === toCol && destinationPiece === '' && fromRow === startRow && toRow === fromRow + 2 * direction) {
                    if (isPathClear(fromRow, fromCol, toRow, toCol)) {
                        return true;
                    }
                }

                // 3. Diagonal capture
                if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction && destinationPiece) {
                    return true;
                }

                // 4. En passant capture
                if (enPassantTargetSquare && toRow === enPassantTargetSquare.row && toCol === enPassantTargetSquare.col) {
                    if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
                        return true;
                    }
                }

                return false;

            case 'n': // Knight
                const rowDiff = Math.abs(toRow - fromRow);
                const colDiff = Math.abs(toCol - fromCol);
                return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);

            case 'b': // Bishop
                if (Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol)) {
                    return isPathClear(fromRow, fromCol, toRow, toCol);
                }
                return false;

            case 'r': // Rook
                if (toRow === fromRow || toCol === fromCol) {
                    return isPathClear(fromRow, fromCol, toRow, toCol);
                }
                return false;

            case 'q': // Queen
                if (Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol) || toRow === fromRow || toCol === fromCol) {
                    return isPathClear(fromRow, fromCol, toRow, toCol);
                }
                return false;

            case 'k': // King
                const kingRowDiff = Math.abs(toRow - fromRow);
                const kingColDiff = Math.abs(toCol - fromCol);

                // Standard King Move
                if (kingRowDiff <= 1 && kingColDiff <= 1) {
                    return true;
                }

                // Castling
                if (kingRowDiff === 0 && kingColDiff === 2) {
                    if (isInCheck(pieceColor)) return false;

                    const direction = toCol > fromCol ? 1 : -1;
                    const rookSide = direction === 1 ? 'kingSide' : 'queenSide';

                    if (!castlingRights[pieceColor][rookSide]) return false;

                    const rookCol = direction === 1 ? 7 : 0;
                    if (!isPathClear(fromRow, fromCol, fromRow, rookCol)) return false;

                    const opponentColor = pieceColor === 'white' ? 'black' : 'white';
                    if (isSquareAttacked(fromRow, fromCol + direction, opponentColor)) return false;

                    return true;
                }

                return false;

            default:
                return false;
        }
    }

    function findKing(color) {
        const kingPiece = color === 'white' ? 'K' : 'k';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (boardState[i][j] === kingPiece) {
                    return { row: i, col: j };
                }
            }
        }
        return null; // Should not happen in a normal game
    }

    function isMoveLegal(piece, fromRow, fromCol, toRow, toCol) {
        // First, check for pseudo-legality.
        if (!isValidMove(piece, fromRow, fromCol, toRow, toCol)) {
            return false;
        }

        // Simulate the move
        const originalPiece = boardState[toRow][toCol];
        boardState[toRow][toCol] = piece;
        boardState[fromRow][fromCol] = '';

        // Check if the current player's king is in check after the move
        const playerColor = getPieceColor(piece);
        const inCheck = isInCheck(playerColor);

        // Undo the move
        boardState[fromRow][fromCol] = piece;
        boardState[toRow][toCol] = originalPiece;

        // The move is legal if it does not leave the king in check
        return !inCheck;
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

    function isSquareAttacked(row, col, attackerColor) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardState[i][j];
                if (piece && getPieceColor(piece) === attackerColor) {
                    if (isValidMove(piece, i, j, row, col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function isInCheck(color) {
        const kingPosition = findKing(color);
        if (!kingPosition) {
            return false;
        }

        const opponentColor = color === 'white' ? 'black' : 'white';

        // Check all opponent pieces
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardState[i][j];
                if (piece && getPieceColor(piece) === opponentColor) {
                    // Check if this piece can attack the king
                    if (isValidMove(piece, i, j, kingPosition.row, kingPosition.col)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    function isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;

        while (currentRow !== toRow || currentCol !== toCol) {
            if (boardState[currentRow][currentCol] !== '') {
                return false; // Path is blocked
            }
            currentRow += rowStep;
            currentCol += colStep;
        }

        return true; // Path is clear
    }

    function updateTurnDisplay() {
        playerTurnDisplay.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
    }

    function getPieceColor(piece) {
        if (!piece) return null;
        return piece === piece.toUpperCase() ? 'white' : 'black';
    }

    renderBoard();
});
