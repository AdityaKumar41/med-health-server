import { Server, Socket } from 'socket.io';

interface ChatMessage {
    sender: string;
    receiver: string;
    message: string;
    timestamp: Date;
}

export const setupChatSocket = (io: Server) => {
    const connectedUsers = new Map<string, Socket>();

    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        // Handle user joinz
        socket.on('join', (userId: string) => {
            connectedUsers.set(userId, socket);
            console.log(`User ${userId} joined chat`);
        });

        // Handle private messages
        socket.on('private-message', (data: ChatMessage) => {
            const receiverSocket = connectedUsers.get(data.receiver);
            console.log(`Sending message from ${data.sender} to ${data.receiver}`, data.message);
            if (receiverSocket) {
                receiverSocket.emit('receive-message', {
                    sender: data.sender,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            for (const [userId, userSocket] of connectedUsers.entries()) {
                if (userSocket === socket) {
                    connectedUsers.delete(userId);
                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    io.on('disconnect', (socket: Socket) => {
        console.log('User disconnected:', socket.id);
    });
};