const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Game state storage
const games = new Map();
const players = new Map();

io.on('connection', (socket) => {
    console.log('Server: Player connected:', socket.id);

    socket.on('createGame', () => {
        const gameCode = generateGameCode();
        console.log('Server: Creating game:', gameCode);
        games.set(gameCode, { 
            players: [socket.id], 
            currentPlayer: socket.id,
            status: 'waiting'
        });
        players.set(socket.id, gameCode);
        socket.join(gameCode);
        socket.emit('gameCreated', { 
            gameId: gameCode, 
            playerId: socket.id 
        });
        console.log('Server: Games currently active:', Array.from(games.keys()));
    });

    socket.on('joinGame', (gameCode) => {
        console.log('Server: Join attempt for game:', gameCode);
        const game = games.get(gameCode);
        console.log('Server: Game found:', game);
        
        if (game && game.players.length < 2) {
            game.players.push(socket.id);
            game.status = 'ready';
            socket.join(gameCode);
            players.set(socket.id, gameCode);
            
            console.log('Server: Broadcasting game start to room:', gameCode);
            io.in(gameCode).emit('gameStarted', {
                gameId: gameCode,
                players: game.players,
                state: game
            });
        } else {
            socket.emit('error', game ? 'Game is full' : 'Game not found');
        }
    });

    socket.on('makeMove', (data) => {
    const gameCode = players.get(socket.id);
    console.log('Server: Move received:', {
        type: data.type,
        from: socket.id,
        gameCode: gameCode,
        tile: data.tile,
        position: data.position
    });
    
    if (gameCode) {
        const game = games.get(gameCode);
        if (game) {
            // Handle discard offer and choice specifically
            if (data.type === 'discardOffer' || data.type === 'discardChoice') {
                socket.to(gameCode).emit('gameMove', {
                    type: data.type,
                    playerId: socket.id,
                    tile: data.tile,
                    accepted: data.accepted,
                    currentPlayer: data.currentPlayer,
                    players: game.players
                });
            } else {
                // Handle all other moves
                io.to(gameCode).emit('gameMove', {
                    ...data,
                    playerId: socket.id,
                    players: game.players
                });
            }
        }
    }
});

    socket.on('disconnect', () => {
        console.log('Server: Player disconnected:', socket.id);
        const gameCode = players.get(socket.id);
        if (gameCode) {
            const game = games.get(gameCode);
            if (game) {
                socket.to(gameCode).emit('playerDisconnected', { playerId: socket.id });
                if (game.players.length <= 1) {
                    games.delete(gameCode);
                }
            }
            players.delete(socket.id);
        }
    });
});

function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server ready to accept connections');
});
