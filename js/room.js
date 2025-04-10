document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const remoteContainer = remoteVideo.closest('.video-container');
    const toggleMicBtn = document.getElementById('toggleMic');
    const toggleCameraBtn = document.getElementById('toggleCamera');
    const endCallBtn = document.getElementById('endCall');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    const copyRoomIdBtn = document.getElementById('copyRoomId');
    const callStatusText = document.getElementById('callStatusText');

    // Get room ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (!roomId) {
        window.location.href = 'index.html';
        return;
    }

    // Display room ID
    roomIdDisplay.textContent = roomId;

    // Copy room link
    copyRoomIdBtn.addEventListener('click', () => {
        const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        navigator.clipboard.writeText(roomLink).then(() => {
            copyRoomIdBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => copyRoomIdBtn.innerHTML = '<i class="fas fa-copy"></i>', 1000);
        });
    });

    // State
    let localStream = null;
    let currentCall = null;
    let isConnectionAttemptInProgress = false;
    let connectionAttempts = 0;
    const MAX_CONNECTION_ATTEMPTS = 3;

    // Generate a unique peer ID
    const peerId = roomId + (Math.random().toString(36).substring(2, 15));

    // Initialize PeerJS with multiple STUN/TURN servers
    const peer = new Peer(peerId, {
        config: {
            iceServers: [
                // Google's public STUN servers
                { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
                // Free STUN servers
                { urls: ['stun:stun.stunprotocol.org:3478', 'stun:stun.voip.blackberry.com:3478'] },
                // Twilio's STUN server
                { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
                // Free TURN servers (backup)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            sdpSemantics: 'unified-plan'
        },
        host: 'free.metered.ca',
        port: 443,
        path: '/webrtc',
        secure: true,
        debug: 2
    });

    // Update status with retry info
    const updateStatus = (status) => {
        callStatusText.textContent = status;
        console.log('Status:', status);
    };

    // Setup media stream with fallback
    async function setupStream() {
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            }
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            localVideo.srcObject = localStream;
            updateStatus('Waiting for partner...');
            return true;
        } catch (err) {
            console.error('Failed to get media:', err);
            
            // Try fallback constraints
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                    audio: true
                });
                localVideo.srcObject = localStream;
                updateStatus('Connected with basic quality...');
                return true;
            } catch (fallbackErr) {
                console.error('Fallback also failed:', fallbackErr);
                updateStatus('Camera/Mic access denied');
                alert('Please ensure camera and microphone permissions are granted and no other app is using them.');
                return false;
            }
        }
    }

    // Handle call with retry mechanism
    function handleCall(call) {
        if (currentCall) {
            currentCall.close();
        }
        
        currentCall = call;
        
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
            remoteContainer.classList.add('connected');
            updateStatus('Connected');
            connectionAttempts = 0;
            isConnectionAttemptInProgress = false;
        });

        call.on('close', () => {
            remoteVideo.srcObject = null;
            remoteContainer.classList.remove('connected');
            updateStatus('Call ended');
            currentCall = null;
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
            retryConnection();
        });
    }

    // Retry connection logic
    function retryConnection() {
        if (isConnectionAttemptInProgress || connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
            updateStatus('Connection failed. Please try again.');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        connectionAttempts++;
        isConnectionAttemptInProgress = true;
        updateStatus(`Retrying connection (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);

        setTimeout(() => {
            if (peer.id !== roomId) {
                initiateCall();
            }
        }, 2000);
    }

    // Initiate call function
    function initiateCall() {
        if (!localStream) {
            setupStream().then(success => {
                if (success) {
                    const call = peer.call(roomId, localStream);
                    handleCall(call);
                }
            });
        } else {
            const call = peer.call(roomId, localStream);
            handleCall(call);
        }
    }

    // Handle incoming call
    peer.on('call', (call) => {
        if (localStream) {
            call.answer(localStream);
            handleCall(call);
        } else {
            setupStream().then(success => {
                if (success) {
                    call.answer(localStream);
                    handleCall(call);
                }
            });
        }
    });

    // Connect to peer with retry
    if (peer.id !== roomId) {
        updateStatus('Connecting...');
        peer.on('open', () => {
            const conn = peer.connect(roomId, {
                reliable: true,
                serialization: 'json'
            });

            conn.on('open', () => {
                initiateCall();
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                retryConnection();
            });
        });
    }

    // Toggle controls with error handling
    toggleMicBtn.addEventListener('click', () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                toggleMicBtn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
                toggleMicBtn.classList.toggle('muted', !audioTrack.enabled);
            }
        }
    });

    toggleCameraBtn.addEventListener('click', () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                toggleCameraBtn.innerHTML = videoTrack.enabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
                toggleCameraBtn.classList.toggle('camera-off', !videoTrack.enabled);
            }
        }
    });

    // End call with proper cleanup
    endCallBtn.addEventListener('click', () => {
        if (currentCall) currentCall.close();
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
        }
        peer.destroy();
        window.location.href = 'index.html';
    });

    // Enhanced connection handling
    peer.on('open', () => {
        console.log('Peer ready:', peer.id);
        setupStream();
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected');
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            updateStatus('Connection lost. Reconnecting...');
            peer.reconnect();
        }
    });

    // Enhanced peer error handling
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
            updateStatus('Room not available');
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else if (err.type === 'network' || err.type === 'disconnected') {
            if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
                retryConnection();
            } else {
                updateStatus('Network connection failed. Please check your internet and try again.');
                setTimeout(() => window.location.href = 'index.html', 3000);
            }
        } else if (err.type === 'server-error') {
            updateStatus('Server error. Please try again in a few minutes.');
            setTimeout(() => window.location.href = 'index.html', 3000);
        }
    });

    // Improved connection monitoring
    setInterval(() => {
        if (currentCall && currentCall.peerConnection) {
            const state = currentCall.peerConnection.iceConnectionState;
            if (state === 'failed' || state === 'disconnected') {
                retryConnection();
            }
        }
    }, 5000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (currentCall) currentCall.close();
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
        }
        peer.destroy();
    });
}); 
