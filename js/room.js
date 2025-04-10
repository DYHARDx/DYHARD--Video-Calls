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
        alert('No room ID provided!');
        window.location.href = 'index.html';
        return;
    }

    // Display room ID
    roomIdDisplay.textContent = roomId;

    // Copy room ID button
    copyRoomIdBtn.addEventListener('click', () => {
        const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        navigator.clipboard.writeText(roomLink)
            .then(() => {
                copyRoomIdBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyRoomIdBtn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            })
            .catch(err => console.error('Failed to copy:', err));
    });

    // Media state
    let localStream = null;
    let isMuted = false;
    let isCameraOff = false;
    let isConnected = false;

    // Initialize PeerJS
    const peer = new Peer(roomId, {
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        },
        debug: 3
    });

    // Update call status
    function updateCallStatus(status) {
        callStatusText.textContent = status;
    }

    // Get user media
    async function setupLocalStream() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideo.srcObject = localStream;
            updateCallStatus('Waiting for your partner to join...');
        } catch (err) {
            console.error('Failed to get local stream:', err);
            updateCallStatus('Camera/Microphone access denied');
            alert('Failed to access camera/microphone. Please ensure permissions are granted.');
        }
    }

    // Handle incoming calls
    peer.on('call', (call) => {
        call.answer(localStream);
        handleCall(call);
    });

    function handleCall(call) {
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
            isConnected = true;
            remoteContainer.classList.add('connected');
            updateCallStatus('Connected');
        });

        call.on('close', () => {
            isConnected = false;
            remoteContainer.classList.remove('connected');
            updateCallStatus('Call ended');
            setTimeout(() => window.location.href = 'index.html', 2000);
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
            updateCallStatus('Call error occurred');
            remoteContainer.classList.remove('connected');
        });
    }

    // Connect to peer if we're the joiner
    if (peer.id !== roomId) {
        updateCallStatus('Connecting to room...');
        const conn = peer.connect(roomId);
        
        conn.on('open', () => {
            const call = peer.call(roomId, localStream);
            handleCall(call);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            updateCallStatus('Failed to connect');
            remoteContainer.classList.remove('connected');
        });
    }

    // Toggle microphone
    toggleMicBtn.addEventListener('click', () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
                isMuted = !track.enabled;
            });
            toggleMicBtn.innerHTML = isMuted ? 
                '<i class="fas fa-microphone-slash"></i>' : 
                '<i class="fas fa-microphone"></i>';
            toggleMicBtn.classList.toggle('muted', isMuted);
        }
    });

    // Toggle camera
    toggleCameraBtn.addEventListener('click', () => {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
                isCameraOff = !track.enabled;
            });
            toggleCameraBtn.innerHTML = isCameraOff ? 
                '<i class="fas fa-video-slash"></i>' : 
                '<i class="fas fa-video"></i>';
            toggleCameraBtn.classList.toggle('camera-off', isCameraOff);
        }
    });

    // End call
    endCallBtn.addEventListener('click', () => {
        updateCallStatus('Ending call...');
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        peer.destroy();
        setTimeout(() => window.location.href = 'index.html', 1000);
    });

    // Handle peer connection
    peer.on('open', () => {
        console.log('Peer connection established');
        setupLocalStream();
    });

    peer.on('disconnected', () => {
        updateCallStatus('Disconnected');
        remoteContainer.classList.remove('connected');
        setTimeout(() => {
            if (!isConnected) {
                window.location.href = 'index.html';
            }
        }, 2000);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        updateCallStatus('Connection error');
        remoteContainer.classList.remove('connected');
        alert('Connection error. Please try again.');
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        peer.destroy();
    });
}); 
