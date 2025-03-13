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
    
    // In your server.js file, update the makeMove handler to properly handle special events
socket.on('makeMove', (data) => {
    const gameId = players.get(socket.id);
    console.log('Server: Move received:', {
        type: data.type,
        action: data.action, // Log the action for special tiles
        from: socket.id,
        gameId: gameId,
        tile: data.tile,
        position: data.position
    });
    
    if (gameId) {
        const game = games[gameId];
        if (game) {
            // Special handling for specific event types that should
            // only be sent to other players, not back to sender
            if (data.type === 'discardOffer' || 
                data.type === 'discardChoice' || 
                data.type === 'potionRevealTile' ||
                (data.type === 'specialTile' && 
                 (data.action === 'potionBubbles' || 
                  data.action === 'skip' || 
                  data.action === 'reverse'))) {
                
                console.log('Server: Sending special event to other players:', data.type, data.action);
                
                socket.to(gameId).emit('gameMove', {
                    ...data,
                    playerId: socket.id,
                    players: game.players
                });
            } else {
                // All other moves go to everyone (including sender)
                io.to(gameId).emit('gameMove', {
                    ...data,
                    playerId: socket.id,
                    players: game.players
                });
            }
        }
    }
});

// Video chat signaling
// Video chat signaling
socket.on('video-offer', (data) => {
    console.log('Server: Relaying video offer from:', socket.id);
    const gameId = players.get(socket.id);
    if (gameId && games[gameId]) {
        // Find the other player in the game
        const otherPlayers = games[gameId].players.filter(p => p !== socket.id);
        if (otherPlayers.length > 0) {
            console.log('Server: Sending offer to:', otherPlayers[0]);
            socket.to(otherPlayers[0]).emit('video-offer', {
                offer: data.offer
            });
        } else {
            console.log('Server: No other player found to relay offer to');
        }
    } else {
        console.log('Server: Game not found for offer relay');
    }
});

socket.on('video-answer', (data) => {
    console.log('Server: Relaying video answer from:', socket.id);
    const gameId = players.get(socket.id);
    if (gameId && games[gameId]) {
        // Find the other player in the game
        const otherPlayers = games[gameId].players.filter(p => p !== socket.id);
        if (otherPlayers.length > 0) {
            console.log('Server: Sending answer to:', otherPlayers[0]);
            socket.to(otherPlayers[0]).emit('video-answer', {
                answer: data.answer
            });
        } else {
            console.log('Server: No other player found to relay answer to');
        }
    } else {
        console.log('Server: Game not found for answer relay');
    }
});

socket.on('video-ice-candidate', (data) => {
    console.log('Server: Relaying ICE candidate from:', socket.id);
    const gameId = players.get(socket.id);
    if (gameId && games[gameId]) {
        // Find the other player in the game
        const otherPlayers = games[gameId].players.filter(p => p !== socket.id);
        if (otherPlayers.length > 0) {
            console.log('Server: Sending ICE candidate to:', otherPlayers[0]);
            socket.to(otherPlayers[0]).emit('video-ice-candidate', {
                candidate: data.candidate
            });
        } else {
            console.log('Server: No other player found to relay ICE candidate to');
        }
    } else {
        console.log('Server: Game not found for ICE candidate relay');
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
    // Create a 3-character code with NO DUPLICATES
    let result = '';
    const characters = 'ABCDEFGHI';
    const usedChars = new Set();
    
    while (result.length < 3) {
        const char = characters.charAt(Math.floor(Math.random() * characters.length));
        if (!usedChars.has(char)) {
            usedChars.add(char);
            result += char;
        }
    }
    
    // Make sure this game ID isn't already in use
    if (games[result]) {
        return generateEmojiGameId();
    }
    
    return result;
}

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server ready to accept connections');
});
