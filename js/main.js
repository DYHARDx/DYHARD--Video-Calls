document.addEventListener('DOMContentLoaded', () => {
    const createRoomBtn = document.getElementById('createRoom');
    const joinRoomBtn = document.getElementById('joinRoom');

    // Generate a random room ID
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 12);
    }

    // Create a new room and redirect to internal page
    createRoomBtn.addEventListener('click', () => {
        const roomId = generateRoomId();
        window.location.href = `room.html?room=${roomId}`;
    });

    // Join Zoom room
    joinRoomBtn.addEventListener('click', () => {
        const roomId = prompt('Enter Zoom Meeting ID:');
        if (roomId) {
            // Redirect to Zoom meeting join page
            window.location.href = `https://app.zoom.us/wc/join/${roomId}`;
        }
    });
});
