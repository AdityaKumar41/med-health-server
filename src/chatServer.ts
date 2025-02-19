import { Server } from "socket.io";
import http from "node:http";
import express from "express";
import { setupChatSocket } from "./routes/v1/chat";

const chatApp = express();
const chatServer = http.createServer(chatApp);
const CHAT_PORT = process.env.CHAT_PORT || 4000;

export const io = new Server(chatServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

export const startChatServer = () => {
    setupChatSocket(io);

    chatServer.listen(CHAT_PORT, () => {
        console.log(`Chat server running on port ${CHAT_PORT}`);
    });
};
