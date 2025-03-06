import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ChatMessage {
    sender: string;
    receiver: string;
    message: string;
    file_url?: string;
    file_type?: string;
    timestamp: Date;
}

const redis = new Redis(process.env.REDIS_SERVICE_URI!);
const pub = new Redis(process.env.REDIS_SERVICE_URI!);
const sub = new Redis(process.env.REDIS_SERVICE_URI!);

const messageQueue: ChatMessage[] = [];
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 5000;

const processMessageQueue = async () => {
    if (messageQueue.length > 0) {
        const batch = messageQueue.splice(0, BATCH_SIZE);
        for (const msg of batch) {
            const chatId = generateChatId(msg.sender, msg.receiver);
            await prisma.chat.upsert({
                where: { id: chatId },
                update: {},
                create: {
                    id: chatId,
                    patient_id: msg.sender,
                    doctor_id: msg.receiver
                }
            });
            await prisma.message.create({
                data: {
                    chat_id: chatId,
                    sender_id: msg.sender,
                    content: msg.message,
                    file_url: msg.file_url,
                    file_type: msg.file_type,
                    sentAt: msg.timestamp
                }
            });
        }
    }
};

const generateChatId = (sender: string, receiver: string) => {
    return [sender, receiver].sort().join('-');
};

setInterval(processMessageQueue, BATCH_INTERVAL);

export const setupChatSocket = (io: Server) => {
    const connectedUsers = new Map<string, Socket>();

    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        // Handle user join
        socket.on('join', async (userId: string) => {
            connectedUsers.set(userId, socket);
            console.log(`User ${userId} joined chat`);

            // Load previous messages
            const previousMessages = await prisma.message.findMany({
                where: {
                    OR: [
                        {
                            chat: {
                                patient_id: userId
                            }
                        },
                        {
                            chat: {
                                doctor_id: userId
                            }
                        }
                    ]
                },
                orderBy: { sentAt: 'asc' },
            });
            console.log('Previous messages:', previousMessages);
            socket.emit('previous-messages', previousMessages);
        });

        // Handle private messages
        socket.on('private-message', (data: ChatMessage) => {
            const receiverSocket = connectedUsers.get(data.receiver);
            console.log(`Sending message from ${data.sender} to ${data.receiver}`, data.message);
            if (receiverSocket) {
                receiverSocket.emit('receive-message', {
                    sender: data.sender,
                    message: data.message,
                    file_url: data.file_url,
                    file_type: data.file_type,
                    timestamp: new Date()
                });
            }
            pub.publish('chat', JSON.stringify(data));

            // Add message to the queue
            messageQueue.push(data);
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

    sub.subscribe('chat', (err, count) => {
        if (err) {
            console.error('Failed to subscribe: ', err.message);
        } else {
            console.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`);
        }
    });

    sub.on('message', (channel, message) => {
        if (channel === 'chat') {
            const data: ChatMessage = JSON.parse(message);
            const receiverSocket = connectedUsers.get(data.receiver);
            if (receiverSocket) {
                receiverSocket.emit('receive-message', {
                    sender: data.sender,
                    message: data.message,
                    file_url: data.file_url,
                    file_type: data.file_type,
                    timestamp: new Date()
                });
            }
        }
    });

    io.on('disconnect', (socket: Socket) => {
        console.log('User disconnected:', socket.id);
    });
};