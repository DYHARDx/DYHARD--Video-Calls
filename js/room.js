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

    // Initialize PeerJS
    const peer = new Peer(roomId, {
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                }
            ]
        }
    });

    // Update status
    const updateStatus = (status) => {
        callStatusText.textContent = status;
        console.log('Status:', status);
    };

    // Setup media stream
    async function setupStream() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            localVideo.srcObject = localStream;
            updateStatus('Waiting for partner...');
        } catch (err) {
            updateStatus('Camera/Mic access denied');
            console.error('Media error:', err);
        }
    }

    // Handle call
    function handleCall(call) {
        currentCall = call;
        
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
            remoteContainer.classList.add('connected');
            updateStatus('Connected');
        });

        call.on('close', () => {
            remoteContainer.classList.remove('connected');
            updateStatus('Call ended');
            window.location.href = 'index.html';
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
            updateStatus('Connection failed');
            remoteContainer.classList.remove('connected');
        });
    }

    // Handle incoming call
    peer.on('call', (call) => {
        if (localStream) {
            call.answer(localStream);
            handleCall(call);
        } else {
            setupStream().then(() => {
                call.answer(localStream);
                handleCall(call);
            });
        }
    });

    // Connect to peer
    if (peer.id !== roomId) {
        updateStatus('Connecting...');
        peer.connect(roomId).on('open', () => {
            setupStream().then(() => {
                const call = peer.call(roomId, localStream);
                handleCall(call);
            });
        });
    }

    // Toggle controls
    toggleMicBtn.addEventListener('click', () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            toggleMicBtn.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
            toggleMicBtn.classList.toggle('muted', !audioTrack.enabled);
        }
    });

    toggleCameraBtn.addEventListener('click', () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            toggleCameraBtn.innerHTML = videoTrack.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
            toggleCameraBtn.classList.toggle('camera-off', !videoTrack.enabled);
        }
    });

    // End call
    endCallBtn.addEventListener('click', () => {
        if (currentCall) currentCall.close();
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        peer.destroy();
        window.location.href = 'index.html';
    });

    // Connection handling
    peer.on('open', () => {
        console.log('Peer ready');
        setupStream();
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        updateStatus('Connection error');
        if (err.type === 'peer-unavailable') {
            alert('Room not available');
            window.location.href = 'index.html';
        }
    });

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (currentCall) currentCall.close();
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        peer.destroy();
    });
}); 