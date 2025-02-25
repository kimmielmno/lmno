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

// Game state storage - FIXED: Use one consistent data structure
// Either use Map or object, not both
const games = {};  // Changed to object for consistency
const players = new Map();

io.on('connection', (socket) => {
    console.log('Server: Player connected:', socket.id);
    
    socket.on('createGame', () => {
    const gameId = generateEmojiGameId();
    console.log('Server: Creating game with code:', gameId);  // Debug output
    
    games[gameId] = {
        players: [socket.id], 
        currentPlayer: socket.id,
        status: 'waiting'
    };
    
    players.set(socket.id, gameId);
    socket.join(gameId);
    io.to(socket.id).emit('gameCreated', { gameId, playerId: socket.id });
});
    
    socket.on('joinGame', (gameId) => {
        console.log('Server: Join attempt for game:', gameId);  // FIXED: Changed gameCode to gameId
        
        // FIXED: Use consistent access method for games object
        if (games[gameId] && games[gameId].players.length === 1) {
            games[gameId].players.push(socket.id);
            games[gameId].status = 'ready';
            
            socket.join(gameId);  // FIXED: Changed gameCode to gameId
            players.set(socket.id, gameId);  // FIXED: Changed gameCode to gameId
            
            console.log('Server: Broadcasting game start to room:', gameId);  // FIXED: Changed gameCode to gameId
            io.in(gameId).emit('gameStarted', {  // FIXED: Changed gameCode to gameId
                gameId: gameId,
                players: games[gameId].players,  // FIXED: Access players from games object
                state: games[gameId]  // FIXED: Pass the correct game object
            });
        } else {
            io.to(socket.id).emit('errorMessage', { message: 'Game not found or already full' });
        }
    });
    
    socket.on('makeMove', (data) => {
        const gameId = players.get(socket.id);  // FIXED: Changed gameCode to gameId
        console.log('Server: Move received:', {
            type: data.type,
            from: socket.id,
            gameId: gameId,  // FIXED: Changed gameCode to gameId
            tile: data.tile,
            position: data.position
        });
        
        if (gameId) {  // FIXED: Changed gameCode to gameId
            // FIXED: Use consistent access method for games object
            const game = games[gameId];
            if (game) {
                // Handle discard offer and choice specifically
                if (data.type === 'discardOffer' || data.type === 'discardChoice') {
                    socket.to(gameId).emit('gameMove', {  // FIXED: Changed gameCode to gameId
                        type: data.type,
                        playerId: socket.id,
                        tile: data.tile,
                        accepted: data.accepted,
                        currentPlayer: data.currentPlayer,
                        players: game.players
                    });
                } else {
                    // Handle all other moves
                    io.to(gameId).emit('gameMove', {  // FIXED: Changed gameCode to gameId
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
        const gameId = players.get(socket.id);  // FIXED: Changed gameCode to gameId
        if (gameId) {  // FIXED: Changed gameCode to gameId
            // FIXED: Use consistent access method for games object
            const game = games[gameId];
            if (game) {
                socket.to(gameId).emit('playerDisconnected', { playerId: socket.id });  // FIXED: Changed gameCode to gameId
                if (game.players.length <= 1) {
                    delete games[gameId];  // FIXED: Changed to object deletion syntax
                }
            }
            players.delete(socket.id);
        }
    });
});

function generateEmojiGameId() {
    // Create a 3-character code that will map to emojis
    let result = '';
    const characters = 'ABCDEFGHI'; // Maps to the 9 emoji positions
    
    for (let i = 0; i < 3; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Make sure this game ID isn't already in use
    if (games[result]) {
        return generateEmojiGameId(); // Try again if ID exists
    }
    
    return result;
}

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server ready to accept connections');
});
