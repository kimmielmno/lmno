// Video Chat Component
const VideoChat = {
    // Variables
    localStream: null,
    peerConnection: null,
    gameId: null,
    socket: null,
    isInitialized: false,
    
    // Initialize the video chat
    init: function(gameId, socketInstance) {
        if (this.isInitialized) return;
        
        this.gameId = gameId;
        this.socket = socketInstance;
        
        // Create the UI
        this.createUI();
        
        // Set up socket event listeners for WebRTC signaling
        this.setupSocketListeners();
        
        this.isInitialized = true;
        console.log('Video chat component initialized');
    },
    
    // Create the UI elements
    createUI: function() {
        // Create container
        const container = document.createElement('div');
        container.id = 'video-chat-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            width: 200px;
            background: rgba(255,255,255,0.8);
            border-radius: 10px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        // Create start button
        const startButton = document.createElement('button');
        startButton.id = 'start-video-chat';
        startButton.textContent = 'Start Video Chat';
        startButton.style.cssText = `
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        `;
        
        // Create video elements (initially hidden)
        const localVideoContainer = document.createElement('div');
        localVideoContainer.style.cssText = `
            margin-bottom: 10px;
            display: none;
        `;
        
        const localVideo = document.createElement('video');
        localVideo.id = 'local-video';
        localVideo.autoplay = true;
        localVideo.muted = true;
        localVideo.playsInline = true;
        localVideo.style.cssText = `
            width: 100%;
            border-radius: 5px;
            background: #f0f0f0;
            transform: scaleX(-1);
        `;
        
        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.style.cssText = `
            margin-bottom: 10px;
            display: none;
        `;
        
        const remoteVideo = document.createElement('video');
        remoteVideo.id = 'remote-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.style.cssText = `
            width: 100%;
            border-radius: 5px;
            background: #f0f0f0;
        `;
        
        // Assemble the UI
        localVideoContainer.appendChild(localVideo);
        remoteVideoContainer.appendChild(remoteVideo);
        
        container.appendChild(startButton);
        container.appendChild(localVideoContainer);
        container.appendChild(remoteVideoContainer);
        
        // Add to document
        document.body.appendChild(container);
        
        // Add event listener to start button
        startButton.addEventListener('click', () => this.startVideoChat());
    },
    
    // Start the video chat
    startVideoChat: async function() {
        const startButton = document.getElementById('start-video-chat');
        const localVideo = document.getElementById('local-video');
        const localVideoContainer = localVideo.parentElement;
        
        try {
            console.log('Starting video chat...');
            startButton.textContent = 'Requesting camera...';
            startButton.disabled = true;
            
            // Request media devices
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Display local video
            localVideo.srcObject = this.localStream;
            localVideoContainer.style.display = 'block';
            
            // Set up WebRTC
            this.setupPeerConnection();
            
            // Update UI
            startButton.textContent = 'Video chat active';
            console.log('Video chat started successfully');
            
        } catch (error) {
            console.error('Failed to start video chat:', error);
            startButton.textContent = 'Start Video Chat (Error)';
            startButton.disabled = false;
            alert('Could not access camera: ' + error.message);
        }
    },
    
    // Set up the WebRTC peer connection
    setupPeerConnection: function() {
        console.log('Setting up peer connection...');
        
        // Create RTCPeerConnection
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Add local tracks to connection
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // Set up event handlers
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.socket.emit('video-ice-candidate', {
                    gameId: this.gameId,
                    candidate: event.candidate
                });
            }
        };
        
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track');
            const remoteVideo = document.getElementById('remote-video');
            const remoteVideoContainer = remoteVideo.parentElement;
            
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideoContainer.style.display = 'block';
            }
        };
        
        // Determine if we should create offer
        if (this.socket.id === players.second) {
            console.log('I am player 2, creating offer...');
            this.createOffer();
        } else {
            console.log('I am player 1, waiting for offer...');
        }
    },
    
    // Create an offer
    createOffer: async function() {
        try {
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            console.log('Sending offer');
            this.socket.emit('video-offer', {
                gameId: this.gameId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    },
    
    // Handle an incoming offer
    handleOffer: async function(offer) {
        try {
            console.log('Handling offer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            console.log('Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('Sending answer');
            this.socket.emit('video-answer', {
                gameId: this.gameId,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    },
    
    // Handle an incoming answer
    handleAnswer: async function(answer) {
        try {
            console.log('Handling answer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    },
    
    // Handle an incoming ICE candidate
    handleIceCandidate: async function(candidate) {
        try {
            console.log('Adding ICE candidate...');
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    },
    
    // Set up socket event listeners
    setupSocketListeners: function() {
        this.socket.on('video-offer', (data) => {
            console.log('Received video offer');
            this.handleOffer(data.offer);
        });
        
        this.socket.on('video-answer', (data) => {
            console.log('Received video answer');
            this.handleAnswer(data.answer);
        });
        
        this.socket.on('video-ice-candidate', (data) => {
            console.log('Received ICE candidate');
            this.handleIceCandidate(data.candidate);
        });
    },
    
    // Clean up
    cleanup: function() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        const container = document.getElementById('video-chat-container');
        if (container) {
            container.remove();
        }
        
        this.isInitialized = false;
        console.log('Video chat cleaned up');
    }
};
