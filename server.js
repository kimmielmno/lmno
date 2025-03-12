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
const games = {};
const players = new Map();

io.on('connection', (socket) => {
    console.log('Server: Player connected:', socket.id);
    
    socket.on('createGame', () => {
        const gameId = generateEmojiGameId();
        console.log('Server: Creating game with code:', gameId);
        
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
        console.log('Server: Join attempt for game:', gameId);
        
        if (games[gameId] && games[gameId].players.length === 1) {
            games[gameId].players.push(socket.id);
            games[gameId].status = 'ready';
            
            socket.join(gameId);
            players.set(socket.id, gameId);
            
            console.log('Server: Broadcasting game start to room:', gameId);
            io.in(gameId).emit('gameStarted', {
                gameId: gameId,
                players: games[gameId].players,
                state: games[gameId]
            });
        } else {
            io.to(socket.id).emit('errorMessage', { message: 'Game not found or already full' });
        }
    });

    // Video chat signaling
    socket.on('video-ready', (data) => {
        console.log('Server: Video ready signal from:', socket.id, 'for room:', data.roomId);
        // Broadcast to all clients in the room
        io.to(data.roomId).emit('video-ready', {
            roomId: data.roomId,
            userId: data.userId
        });
    });

    socket.on('video-offer', (data) => {
        console.log('Server: Video offer from:', data.sender, 'to:', data.target);
        // Send to all clients in the room
        io.to(data.roomId).emit('video-offer', {
            sender: data.sender,
            target: data.target,
            offer: data.offer
        });
    });

    socket.on('video-answer', (data) => {
        console.log('Server: Video answer from:', data.sender, 'to:', data.target);
        // Send to all clients in the room
        io.to(data.roomId).emit('video-answer', {
            sender: data.sender,
            target: data.target,
            answer: data.answer
        });
    });

    socket.on('video-ice-candidate', (data) => {
        // Send to all clients in the room
        io.to(data.roomId).emit('video-ice-candidate', {
            sender: data.sender,
            target: data.target,
            candidate: data.candidate
        });
    });
    
    socket.on('makeMove', (data) => {
        const gameId = players.get(socket.id);
        console.log('Server: Move received:', {
            type: data.type,
            action: data.action,
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
    
    socket.on('playerName', (data) => {
        if (data.gameId) {
            console.log('Server: Player name update:', data.name, 'for', socket.id);
            io.to(data.gameId).emit('playerName', {
                playerId: socket.id,
                name: data.name
            });
        }
    });
    
    socket.on('syncRequest', (data) => {
        const gameId = players.get(socket.id);
        if (gameId) {
            socket.to(gameId).emit('syncRequest', {
                ...data,
                playerId: socket.id
            });
        }
    });
    
    socket.on('syncDrawPile', (data) => {
        const gameId = players.get(socket.id);
        if (gameId) {
            socket.to(gameId).emit('syncDrawPile', {
                ...data,
                playerId: socket.id,
                gameId: gameId
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Server: Player disconnected:', socket.id);
        const gameId = players.get(socket.id);
        if (gameId) {
            const game = games[gameId];
            if (game) {
                // Notify other players in the room
                socket.to(gameId).emit('player-disconnected', { 
                    userId: socket.id,
                    gameId: gameId
                });
                
                if (game.players.length <= 1) {
                    delete games[gameId];
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server ready to accept connections');
});
