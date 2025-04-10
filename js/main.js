document.addEventListener('DOMContentLoaded', () => {
    const createRoomBtn = document.getElementById('createRoom');
    const joinRoomBtn = document.getElementById('joinRoom');

    // Generate a random room ID
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 12);
    }

    // Create a new room and redirect
    createRoomBtn.addEventListener('click', () => {
        const roomId = generateRoomId();
        window.location.href = `room.html?room=${roomId}`;
    });

    // Join an existing room
    joinRoomBtn.addEventListener('click', () => {
        const roomId = prompt('Enter Room ID or link:');
        if (roomId) {
            // Extract room ID if a full URL was pasted
            const extractedRoomId = roomId.includes('?room=') 
                ? roomId.split('?room=')[1] 
                : roomId;
            window.location.href = `room.html?room=${extractedRoomId}`;
        }
    });
}); 