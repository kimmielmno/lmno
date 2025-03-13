// Enhanced Video Chat Component that fixes both laptop and iPad issues
const VideoChat = {
    // Variables
    localStream: null,
    peerConnection: null,
    gameId: null,
    socket: null,
    isInitialized: false,
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    // Initialize the video chat
    init: function(gameId, socketInstance) {
        if (this.isInitialized) {
            console.log('Video chat already initialized, cleaning up first');
            this.cleanup();
        }
        
        console.log('Initializing video chat component...');
        console.log('Device detection - iOS:', this.isIOS, 'Safari:', this.isSafari);
        
        this.gameId = gameId;
        this.socket = socketInstance;
        this.reconnectAttempts = 0;
        
        // Create the UI
        this.createUI();
        
        // Set up socket event listeners for WebRTC signaling
        this.setupSocketListeners();
        
        // Handle orientation changes (especially important for iPad)
        window.addEventListener('orientationchange', () => {
            console.log('Orientation changed, adjusting video chat UI');
            // Give time for the orientation change to complete
            setTimeout(() => {
                // Refresh the container positioning
                const container = document.getElementById('video-chat-container');
                if (container) {
                    // Adjust position based on orientation
                    if (window.orientation === 90 || window.orientation === -90) {
                        // Landscape
                        container.style.bottom = '20px';
                        container.style.right = '20px';
                    } else {
                        // Portrait
                        container.style.bottom = '60px';
                        container.style.right = '20px';
                    }
                }
            }, 300);
        });
        
        this.isInitialized = true;
        console.log('Video chat component initialized');
    },
    
    // Create the UI elements
    createUI: function() {
        console.log('Creating video chat UI');
        
        // Remove existing container if it exists
        const existingContainer = document.getElementById('video-chat-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Create container
        const container = document.createElement('div');
        container.id = 'video-chat-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            width: 200px;
            background: rgba(255,255,255,0.9);
            border-radius: 10px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
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
            font-size: 14px;
        `;
        
        // Create restart button (initially hidden)
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-video-chat';
        restartButton.textContent = 'Restart Connection';
        restartButton.style.cssText = `
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            background: #FFC107;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            display: none;
            font-size: 14px;
        `;
        
        // Create status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'video-status';
        statusIndicator.textContent = 'Video inactive';
        statusIndicator.style.cssText = `
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-bottom: 10px;
            padding: 5px;
        `;
        
        // Create video elements (initially hidden)
        const localVideoContainer = document.createElement('div');
        localVideoContainer.style.cssText = `
            position: relative;
            margin-bottom: 10px;
            display: none;
            border-radius: 8px;
            overflow: hidden;
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
        
        const localLabel = document.createElement('div');
        localLabel.textContent = 'You';
        localLabel.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            background: rgba(0,0,0,0.5);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
        `;
        
        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.style.cssText = `
            position: relative;
            margin-bottom: 10px;
            display: none;
            border-radius: 8px;
            overflow: hidden;
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
        
        const remoteLabel = document.createElement('div');
        remoteLabel.textContent = 'Friend';
        remoteLabel.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            background: rgba(0,0,0,0.5);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
        `;
        
        // Create an audio element for iOS compatibility
        const audioElement = document.createElement('audio');
        audioElement.id = 'remote-audio';
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        audioElement.style.display = 'none';
        
        // Create video controls (initially hidden)
        const videoControls = document.createElement('div');
        videoControls.style.cssText = `
            display: none;
            gap: 10px;
            justify-content: center;
        `;
        
        const toggleVideoButton = document.createElement('button');
        toggleVideoButton.id = 'toggle-video';
        toggleVideoButton.innerHTML = '🎥';
        toggleVideoButton.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid #ddd;
            cursor: pointer;
            font-size: 18px;
        `;
        
        const toggleAudioButton = document.createElement('button');
        toggleAudioButton.id = 'toggle-audio';
        toggleAudioButton.innerHTML = '🎤';
        toggleAudioButton.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid #ddd;
            cursor: pointer;
            font-size: 18px;
        `;
        
        // iPad-specific styling
        const iPadStyles = document.createElement('style');
        iPadStyles.id = 'ipad-video-styles';
        iPadStyles.textContent = `
            @supports (-webkit-touch-callout: none) {
                /* iOS/iPadOS specific styles */
                #video-chat-container {
                    bottom: 60px !important;
                    right: 20px !important;
                    width: 240px !important; /* Slightly larger for touch */
                }
                
                #start-video-chat, #restart-video-chat {
                    padding: 15px 10px !important; /* Larger touch target */
                    font-size: 16px !important;
                }
                
                #local-video, #remote-video {
                    height: 180px !important; /* Larger video */
                }
                
                #toggle-video, #toggle-audio {
                    width: 44px !important;
                    height: 44px !important;
                    font-size: 20px !important;
                }
            }
        `;
        
        // Remove existing iPad styles if they exist
        const existingStyles = document.getElementById('ipad-video-styles');
        if (existingStyles) {
            existingStyles.remove();
        }
        
        // Assemble the UI
        document.head.appendChild(iPadStyles);
        
        localVideoContainer.appendChild(localVideo);
        localVideoContainer.appendChild(localLabel);
        
        remoteVideoContainer.appendChild(remoteVideo);
        remoteVideoContainer.appendChild(remoteLabel);
        
        videoControls.appendChild(toggleVideoButton);
        videoControls.appendChild(toggleAudioButton);
        
        container.appendChild(startButton);
        container.appendChild(restartButton);
        container.appendChild(statusIndicator);
        container.appendChild(localVideoContainer);
        container.appendChild(remoteVideoContainer);
        container.appendChild(audioElement);
        container.appendChild(videoControls);
        
        // Add to document
        document.body.appendChild(container);
        
        // Add event listeners
        startButton.addEventListener('click', () => this.startVideoChat());
        restartButton.addEventListener('click', () => this.restartConnection());
        toggleVideoButton.addEventListener('click', () => this.toggleVideo());
        toggleAudioButton.addEventListener('click', () => this.toggleAudio());
        
        console.log('Video chat UI created');
    },
    
    // Add a manual audio fix button for iPad users
    addAudioFixButton: function() {
        // Only add once
        if (document.getElementById('fix-audio-button')) return;
        
        const container = document.getElementById('video-chat-container');
        if (!container) return;
        
        const fixButton = document.createElement('button');
        fixButton.id = 'fix-audio-button';
        fixButton.textContent = 'Fix Audio';
        fixButton.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            background: #FFC107;
            color: black;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        
        fixButton.addEventListener('click', () => {
            // Create and play an audio element to trigger audio system
            const audio = new Audio();
            audio.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
            audio.volume = 0.1;
            
            // Force a play attempt
            audio.play().then(() => {
                fixButton.textContent = 'Audio Activated ✓';
                fixButton.style.background = '#4CAF50';
                
                // Re-enable any audio tracks
                if (this.localStream) {
                    const audioTracks = this.localStream.getAudioTracks();
                    audioTracks.forEach(track => {
                        track.enabled = true;
                        console.log('Re-enabled audio track');
                    });
                }
                
                if (this.peerConnection) {
                    // Get any remote streams and ensure their audio is enabled
                    this.peerConnection.getReceivers().forEach(receiver => {
                        if (receiver.track && receiver.track.kind === 'audio') {
                            receiver.track.enabled = true;
                            console.log('Enabled remote audio track');
                        }
                    });
                }
            }).catch(err => {
                console.warn('Audio activation failed:', err);
                fixButton.textContent = 'Try Again';
            });
        });
        
        // Insert before the video containers
        const firstVideoContainer = container.querySelector('.video-container');
        container.insertBefore(fixButton, firstVideoContainer);
    },
    
    // Setup iOS audio - specific handling for iOS audio issues
    setupIOSAudio: function() {
        console.log('Setting up audio handling...');
        
        // For iOS, we need to handle audio in a special way
        if (this.isIOS) {
            // Create an audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const audioContext = new AudioContext();
                
                // Unmute audio context if suspended
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        console.log('AudioContext resumed successfully');
                    }).catch(err => {
                        console.warn('Failed to resume AudioContext:', err);
                    });
                }
                
                // This forces the audio system to activate
                const silentAudio = audioContext.createOscillator();
                const destination = audioContext.createMediaStreamDestination();
                silentAudio.connect(destination);
                silentAudio.start();
                silentAudio.stop(audioContext.currentTime + 0.001);
                
                console.log('iOS audio system activated');
            }
        }
        
        // Force audio output to speaker using a temporary element (helpful for both platforms)
        const tempAudio = document.createElement('audio');
        tempAudio.volume = 0.01;
        tempAudio.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
        
        // Force this to try to play
        tempAudio.play().catch(err => console.warn('Expected audio init error:', err));
        
        // Force audio output to speaker - for all devices
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                // Check and log audio track constraints
                const audioTrack = audioTracks[0];
                console.log('Audio track:', audioTrack.label, 'enabled:', audioTrack.enabled);
                
                // Ensure audio is enabled
                audioTrack.enabled = true;
                
                // Try to force audio routing to speaker
                try {
                    // For newer browsers
                    if (typeof audioTrack.applyConstraints === 'function') {
                        audioTrack.applyConstraints({
                            echoCancellation: true,
                            autoGainControl: true,
                            noiseSuppression: true,
                        }).then(() => {
                            console.log('Applied audio constraints for better audio');
                        }).catch(err => {
                            console.warn('Could not apply audio constraints:', err);
                        });
                    }
                } catch (e) {
                    console.warn('Error applying audio constraints:', e);
                }
            } else {
                console.warn('No audio tracks found in local stream');
            }
        }
        
        // Add the audio fix button for all devices, not just iPad
        this.addAudioFixButton();
    },
    
    // Start the video chat
    startVideoChat: async function() {
        const startButton = document.getElementById('start-video-chat');
        const statusIndicator = document.getElementById('video-status');
        const localVideo = document.getElementById('local-video');
        const localVideoContainer = localVideo?.parentElement;
        const videoControls = document.querySelector('#video-chat-container div:last-child');
        
        if (!startButton || !statusIndicator || !localVideo || !localVideoContainer || !videoControls) {
            console.error('Required DOM elements not found');
            return;
        }
        
        // Check browser support
        if (!navigator.mediaDevices || !RTCPeerConnection) {
            alert('Your browser does not support video chat. Please try using Chrome, Firefox, or Safari.');
            statusIndicator.textContent = 'Browser not supported';
            statusIndicator.style.color = 'red';
            startButton.textContent = 'Not Supported';
            startButton.disabled = true;
            return;
        }
        
        try {
            console.log('Starting video chat...');
            startButton.textContent = 'Requesting camera...';
            startButton.disabled = true;
            statusIndicator.textContent = 'Requesting permissions...';
            
            // Request media devices
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Set up audio specifically - works for both iPad and laptop
            this.setupIOSAudio();
            
            // Display local video
            localVideo.srcObject = this.localStream;
            localVideoContainer.style.display = 'block';
            
            // Handle autoplay issues
            try {
                await localVideo.play();
                console.log('Local video playing automatically');
            } catch (err) {
                console.warn('Autoplay prevented:', err);
                this.createPlayOverlay(localVideoContainer, localVideo);
            }
            
            // Display video controls
            videoControls.style.display = 'flex';
            
            // Set up WebRTC
            this.setupPeerConnection();
            
            // Update UI
            startButton.style.display = 'none';
            statusIndicator.textContent = 'Connecting to peer...';
            statusIndicator.style.color = '#2196F3';
            console.log('Video chat started successfully');
            
        } catch (error) {
            console.error('Failed to start video chat:', error);
            startButton.textContent = 'Start Video Chat';
            startButton.disabled = false;
            statusIndicator.textContent = 'Error: ' + (error.name || error.message);
            statusIndicator.style.color = 'red';
            
            // Show a more helpful error message
            if (error.name === 'NotAllowedError') {
                alert('Please allow camera and microphone access to use video chat.');
            } else if (error.name === 'NotFoundError') {
                alert('No camera or microphone found. Please connect these devices and try again.');
            } else if (error.name === 'NotReadableError') {
                alert('Cannot access your camera or microphone. They might be in use by another application.');
            } else {
                alert('Error accessing camera: ' + error.message);
            }
        }
    },
    
    // Create a play overlay for autoplay prevention
    createPlayOverlay: function(container, videoElement) {
        const playOverlay = document.createElement('div');
        playOverlay.style.cssText = `
            position: absolute; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        `;
        
        const playButton = document.createElement('button');
        playButton.textContent = 'Tap to Play';
        playButton.style.cssText = `
            padding: 10px 15px;
            background: white;
            border: none;
            border-radius: 5px;
            font-size: ${this.isIOS ? '16px' : '14px'};
        `;
        
        playOverlay.appendChild(playButton);
        container.appendChild(playOverlay);
        
        // Play both videos when clicked
        playButton.addEventListener('click', () => {
            videoElement.play();
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo && remoteVideo.srcObject) {
                remoteVideo.play();
            }
            
            // Also play the audio element
            const remoteAudio = document.getElementById('remote-audio');
            if (remoteAudio && remoteAudio.srcObject) {
                remoteAudio.play();
            }
            
            playOverlay.remove();
        });
    },
    
    // Toggle video on/off
    toggleVideo: function() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                const enabled = !videoTracks[0].enabled;
                videoTracks[0].enabled = enabled;
                
                const toggleButton = document.getElementById('toggle-video');
                if (toggleButton) {
                    toggleButton.innerHTML = enabled ? '🎥' : '❌';
                    toggleButton.style.background = enabled ? '#fff' : '#ffcccc';
                }
                
                const localVideo = document.getElementById('local-video');
                if (localVideo) {
                    localVideo.style.backgroundColor = enabled ? '' : '#333';
                }
            }
        }
    },
    
    // Toggle audio on/off
    toggleAudio: function() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const enabled = !audioTracks[0].enabled;
                audioTracks[0].enabled = enabled;
                
                const toggleButton = document.getElementById('toggle-audio');
                if (toggleButton) {
                    toggleButton.innerHTML = enabled ? '🎤' : '❌';
                    toggleButton.style.background = enabled ? '#fff' : '#ffcccc';
                }
            }
        }
    },
    
    // Restart the connection if it fails
    restartConnection: function() {
        const restartButton = document.getElementById('restart-video-chat');
        const statusIndicator = document.getElementById('video-status');
        
        if (restartButton && statusIndicator) {
            restartButton.textContent = 'Reconnecting...';
            statusIndicator.textContent = 'Reconnecting...';
            statusIndicator.style.color = '#2196F3';
        }
        
        // Close existing connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Set up a new connection
        setTimeout(() => {
            this.setupPeerConnection();
            
            if (restartButton) {
                restartButton.textContent = 'Restart Connection';
            }
        }, 1000);
    },
    
    // Set up the WebRTC peer connection
    setupPeerConnection: function() {
        console.log('Setting up peer connection...');
        
        if (this.peerConnection) {
            console.log('Closing existing peer connection first');
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Create RTCPeerConnection with improved ICE servers
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Free TURN server from Twilio
                {
                    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
                    username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
                    credential: 'w1uxM55V9yVoqyVFjt+mxDBV0F87AUCemaYVQGxsPLw='
                },
                {
                    urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
                    username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
                    credential: 'w1uxM55V9yVoqyVFjt+mxDBV0F87AUCemaYVQGxsPLw='
                },
                // Backup free TURN server
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10
        });
        
        // Add local tracks to connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                try {
                    const sender = this.peerConnection.addTrack(track, this.localStream);
                    console.log(`Added ${track.kind} track to peer connection`);
                    
                    // For audio tracks, ensure they're enabled
                    if (track.kind === 'audio') {
                        track.enabled = true;
                    }
                } catch (error) {
                    console.error(`Error adding ${track.kind} track:`, error);
                }
            });
        } else {
            console.error('No local stream when setting up peer connection');
            return;
        }
        
        // Set up connection state monitoring with detailed logs
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state change:', this.peerConnection.iceConnectionState);
            
            const statusIndicator = document.getElementById('video-status');
            const restartButton = document.getElementById('restart-video-chat');
            
            // Update UI based on connection state
            if (this.peerConnection.iceConnectionState === 'checking') {
                if (statusIndicator) statusIndicator.textContent = 'Connecting...';
                if (statusIndicator) statusIndicator.style.color = '#2196F3';
                
            } else if (this.peerConnection.iceConnectionState === 'connected' || 
                      this.peerConnection.iceConnectionState === 'completed') {
                if (statusIndicator) {
                    statusIndicator.textContent = 'Connected';
                    statusIndicator.style.color = '#4CAF50';
                }
                if (restartButton) restartButton.style.display = 'none';
                
                // Reset reconnect attempts on successful connection
                this.reconnectAttempts = 0;
                
            } else if (this.peerConnection.iceConnectionState === 'failed' || 
                      this.peerConnection.iceConnectionState === 'disconnected') {
                if (statusIndicator) {
                    statusIndicator.textContent = 'Connection failed';
                    statusIndicator.style.color = '#f44336';
                }
                if (restartButton) restartButton.style.display = 'block';
                
                // Auto-reconnect if not too many attempts
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Auto-reconnecting (attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})...`);
                    
                    setTimeout(() => {
                        if (this.peerConnection && 
                            (this.peerConnection.iceConnectionState === 'failed' || 
                             this.peerConnection.iceConnectionState === 'disconnected')) {
                            this.restartConnection();
                        }
                    }, 2000);
                } else {
                    // Show connection failure message
                    console.log('Max reconnection attempts reached');
                    this.handleConnectionFailure();
                }
            }
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state change:', this.peerConnection.connectionState);
        };
        
        this.peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state change:', this.peerConnection.signalingState);
        };
        
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state change:', this.peerConnection.iceGatheringState);
        };
        
        // Handle received remote tracks
        this.peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.track.kind);
            
            // When we receive tracks from the remote peer
            const remoteVideo = document.getElementById('remote-video');
            const remoteVideoContainer = remoteVideo?.parentElement;
            const remoteAudio = document.getElementById('remote-audio');
            
            if (!remoteVideo || !remoteVideoContainer) {
                console.error('Remote video elements not found');
                return;
            }
            
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                
                // For video tracks, use the remote video element
                if (event.track.kind === 'video') {
                    remoteVideo.srcObject = remoteStream;
                    remoteVideoContainer.style.display = 'block';
                    
                    // Handle autoplay issues
                    try {
                        remoteVideo.play()
                            .then(() => console.log('Remote video playing'))
                            .catch(err => {
                                console.warn('Remote video autoplay prevented:', err);
                                this.createPlayOverlay(remoteVideoContainer, remoteVideo);
                            });
                    } catch (error) {
                        console.error('Error starting remote video:', error);
                    }
                }
                
                // For audio tracks, set on both elements to ensure it works across devices
                if (event.track.kind === 'audio') {
                    // Set audio on video element for most browsers
                    if (!remoteVideo.srcObject) {
                        remoteVideo.srcObject = remoteStream;
                    }
                    
                    // Also set audio on a separate audio element (helps for some browsers)
                    if (remoteAudio) {
                        remoteAudio.srcObject = remoteStream;
                        
                        try {
                            remoteAudio.play()
                                .then(() => console.log('Remote audio playing in dedicated audio element'))
                                .catch(err => console.warn('Remote audio autoplay prevented:', err));
                        } catch (error) {
                            console.error('Error starting remote audio:', error);
                        }
                    }
                    
                    // Update status
                    const statusIndicator = document.getElementById('video-status');
                    if (statusIndicator) {
                        statusIndicator.textContent = 'Connected with Audio';
                        statusIndicator.style.color = '#4CAF50';
                    }
                }
            }
        };
        
        // Make ICE candidate logging more verbose
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Generated ICE candidate:', event.candidate.type);
                
                this.socket.emit('video-ice-candidate', {
                    gameId: this.gameId,
                    candidate: event.candidate
                });
            } else {
                console.log('All ICE candidates have been generated');
            }
        };
        
        // Add special handling for Safari
        if (this.isSafari) {
            console.log('Safari detected, applying special handling');
            
            // Safari sometimes needs a delay after certain operations
            const originalSetRemoteDescription = this.peerConnection.setRemoteDescription.bind(this.peerConnection);
            this.peerConnection.setRemoteDescription = async function(desc) {
                await originalSetRemoteDescription(desc);
                
                // Small delay to ensure stability on Safari
                return new Promise(resolve => {
                    setTimeout(resolve, 200);
                });
            };
        }
        
        // Determine if we should create an offer
        if (this.socket && this.gameId) {
            // Wait a bit to ensure everything is set up
            setTimeout(() => {
                // If we are player 2, we initiate the offer
                if (window.players && this.socket.id === window.players.second) {
                    console.log('I am player 2, creating offer...');
                    this.createOffer();
                } else {
                    console.log('I am player 1, waiting for offer...');
                }
            }, 1500);
        } else {
            console.error('Socket or gameId not available, cannot determine when to create offer');
        }
    },
    
    // Create an offer
    createOffer: async function() {
        try {
            console.log('Creating offer...');
            if (!this.peerConnection) {
                console.error('Cannot create offer: peer connection not initialized');
                return;
            }
            
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            console.log('Sending offer to peer');
            this.socket.emit('video-offer', {
                gameId: this.gameId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            
            // Show the error in the UI
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Offer error: ' + error.message;
                statusIndicator.style.color = '#f44336';
            }
            
            // Retry after a delay
            setTimeout(() => {
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Retrying offer (attempt ${this.reconnectAttempts})...`);
                    this.createOffer();
                }
            }, 3000);
        }
    },
    
    // Handle an incoming offer
    handleOffer: async function(offer) {
        try {
            console.log('Handling offer...');
            
            // Create and play a silent audio clip to initialize audio
            const tempAudio = document.createElement('audio');
            tempAudio.autoplay = true;
            tempAudio.volume = 0.1; // Low but not zero
            tempAudio.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
            await tempAudio.play().catch(err => console.warn('Audio init error:', err));
            
            // Make sure audio is enabled in the stream if available
            if (this.localStream) {
                const audioTracks = this.localStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks[0].enabled = true;
                    console.log('Enabled local audio track');
                }
            }
            
            if (!this.peerConnection) {
                console.error('Cannot handle offer: peer connection not initialized');
                
                // Try initializing video chat first
                await this.startVideoChat();
                
                // If still no peer connection, we can't proceed
                if (!this.peerConnection) {
                    return;
                }
            }
            
            // Add a manual audio fix button for all devices
            this.addAudioFixButton();
            
            // If we're in the process of creating our own offer, rollback
            if (this.peerConnection.signalingState !== 'stable') {
                console.log('Signaling state not stable, rolling back');
                await Promise.all([
                    this.peerConnection.setLocalDescription({type: 'rollback'}),
                    this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                ]);
            } else {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            }
            
            console.log('Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('Sending answer to peer');
            this.socket.emit('video-answer', {
                gameId: this.gameId,
                answer: answer
            });
            
            // Update UI
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Connected';
                statusIndicator.style.color = '#4CAF50';
            }
        } catch (error) {
            console.error('Error handling offer:', error);
            
            // Show the error in the UI
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Answer error: ' + error.message;
                statusIndicator.style.color = '#f44336';
            }
            
            // Try to restart the connection after a delay
            setTimeout(() => {
                this.restartConnection();
            }, 3000);
        }
    },
    
    // Handle an incoming answer
    handleAnswer: async function(answer) {
        try {
            console.log('Handling answer...');
            if (!this.peerConnection) {
                console.error('Cannot handle answer: peer connection not initialized');
                return;
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Remote description set successfully from answer');
            
            // Update UI
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Connected';
                statusIndicator.style.color = '#4CAF50';
            }
        } catch (error) {
            console.error('Error handling answer:', error);
            
            // Show the error in the UI
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Connection error: ' + error.message;
                statusIndicator.style.color = '#f44336';
            }
            
            // Try to restart after a delay
            setTimeout(() => {
                this.restartConnection();
            }, 3000);
        }
    },
    
    // Handle an incoming ICE candidate
    handleIceCandidate: async function(candidate) {
        try {
            console.log('Adding ICE candidate...');
            if (!this.peerConnection) {
                console.error('Cannot add ICE candidate: peer connection not initialized');
                return;
            }
            
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('ICE candidate added successfully');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    },
    
    // Handle connection failures
    handleConnectionFailure: function() {
        const container = document.getElementById('video-chat-container');
        const statusIndicator = document.getElementById('video-status');
        
        if (statusIndicator) {
            statusIndicator.textContent = 'Video connection failed';
            statusIndicator.style.color = '#f44336';
        }
        
        // Only add the message once
        if (!document.getElementById('connection-failed-message')) {
            const failedMessage = document.createElement('div');
            failedMessage.id = 'connection-failed-message';
            failedMessage.style.cssText = `
                color: #f44336;
                padding: 10px;
                margin-top: 10px;
                text-align: center;
                font-size: 12px;
                background: #ffebee;
                border-radius: 5px;
            `;
            failedMessage.textContent = 'Could not establish video connection. Try clicking "Fix Audio" or "Restart Connection".';
            container.appendChild(failedMessage);
        }
    },
    
    // Set up socket event listeners
    setupSocketListeners: function() {
        // Remove any existing listeners to avoid duplicates
        this.socket.off('video-offer');
        this.socket.off('video-answer');
        this.socket.off('video-ice-candidate');
        
        // Add new listeners
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
        
        // Handle disconnection
        this.socket.on('playerDisconnected', () => {
            console.log('Other player disconnected');
            const statusIndicator = document.getElementById('video-status');
            if (statusIndicator) {
                statusIndicator.textContent = 'Other player disconnected';
                statusIndicator.style.color = '#f44336';
            }
            
            // Clean up remote video
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = null;
            }
            
            const remoteVideoContainer = document.getElementById('remote-video')?.parentElement;
            if (remoteVideoContainer) {
                remoteVideoContainer.style.display = 'none';
            }
        });
    },
    
    // Clean up
    cleanup: function() {
        console.log('Cleaning up video chat resources');
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind);
            });
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        const remoteAudio = document.getElementById('remote-audio');
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        if (remoteAudio) remoteAudio.srcObject = null;
        
        const container = document.getElementById('video-chat-container');
        if (container) {
            container.remove();
        }
        
        this.isInitialized = false;
        console.log('Video chat cleaned up');
    }
};
