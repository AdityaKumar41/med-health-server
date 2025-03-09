import { Server, Socket } from "socket.io";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ChatMessage {
  sender: string;
  receiver: string;
  message: string;
  file_url?: string;
  file_type?: string;
  timestamp: Date;
  sender_name?: string; // Add this for notifications
  patient_id?: string; // Add new field for patient identification
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
          doctor_id: msg.receiver,
        },
      });
      await prisma.message.create({
        data: {
          chat_id: chatId,
          sender_id: msg.sender,
          content: msg.message,
          file_url: msg.file_url,
          file_type: msg.file_type,
          sentAt: msg.timestamp,
        },
      });
    }
  }
};

const generateChatId = (sender: string, receiver: string) => {
  return [sender, receiver].sort().join("-");
};

setInterval(processMessageQueue, BATCH_INTERVAL);

export const setupChatSocket = (io: Server) => {
  const connectedUsers = new Map<string, Socket>();

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // Handle user join - Updated to support both simple userId and complex object
    socket.on(
      "join",
      async (data: string | { patientId?: string; doctorId?: string }) => {
        let userId: string;
        let specificQuery = false;
        let patientId: string | undefined;
        let doctorId: string | undefined;

        // Handle the case when data is an object with patientId and doctorId
        if (typeof data === "object" && data !== null) {
          patientId = data.patientId;
          doctorId = data.doctorId;
          userId = patientId || "";
          specificQuery = !!(patientId && doctorId);
          console.log(
            `User ${userId} joined chat with specific doctor ${doctorId}`
          );
        } else {
          // Original case: data is just the userId string
          userId = data;
          console.log(`User ${userId} joined chat`);
        }

        connectedUsers.set(userId, socket);

        try {
          let previousMessages;

          if (specificQuery && patientId && doctorId) {
            // If we have both patient and doctor IDs, get messages for their specific conversation
            const chatId = generateChatId(patientId, doctorId);

            previousMessages = await prisma.message.findMany({
              where: {
                chat_id: chatId,
              },
              orderBy: {
                sentAt: "asc",
              },
              include: {
                chat: true,
              },
            });
          } else {
            // Get all messages for this user (as either sender or receiver)
            previousMessages = await prisma.message.findMany({
              where: {
                OR: [
                  {
                    chat: {
                      patient_id: userId,
                    },
                  },
                  {
                    chat: {
                      doctor_id: userId,
                    },
                  },
                ],
              },
              orderBy: {
                sentAt: "asc",
              },
              include: {
                chat: true,
              },
            });
          }

          console.log(`Found ${previousMessages.length} previous messages`);
          socket.emit("previous-messages", previousMessages);
        } catch (error) {
          console.error("Error loading previous messages:", error);
          socket.emit("error", { message: "Failed to load previous messages" });
        }
      }
    );

    // Handle specific request for messages between a patient and doctor
    socket.on(
      "get-previous-messages",
      async (data: { patientId: string; doctorId: string }) => {
        try {
          const { patientId, doctorId } = data;
          const chatId = generateChatId(patientId, doctorId);

          const previousMessages = await prisma.message.findMany({
            where: {
              chat_id: chatId,
            },
            orderBy: {
              sentAt: "asc",
            },
            include: {
              chat: true,
            },
          });

          console.log(
            `Sending ${previousMessages.length} messages for chat ${chatId}`
          );
          socket.emit("previous-messages", previousMessages);
        } catch (error) {
          console.error("Error loading specific conversation messages:", error);
          socket.emit("error", {
            message: "Failed to load conversation history",
          });
        }
      }
    );

    // Handle private messages
    socket.on("private-message", (data: ChatMessage) => {
      const receiverSocket = connectedUsers.get(data.receiver);
      console.log(
        `Sending message from ${data.sender} to ${data.receiver}`,
        data.message
      );
      if (receiverSocket) {
        receiverSocket.emit("receive-message", {
          sender: data.sender,
          message: data.message,
          file_url: data.file_url,
          file_type: data.file_type,
          timestamp: new Date(),
          sender_name: data.sender_name, // Pass along the sender name
          patient_id: data.patient_id, // Pass along the patient ID
        });
      }
      pub.publish("chat", JSON.stringify(data));

      // Add message to the queue
      messageQueue.push(data);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      for (const [userId, userSocket] of connectedUsers.entries()) {
        if (userSocket === socket) {
          connectedUsers.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  sub.subscribe("chat", (err, count) => {
    if (err) {
      console.error("Failed to subscribe: ", err.message);
    } else {
      console.log(
        `Subscribed successfully! This client is currently subscribed to ${count} channels.`
      );
    }
  });

  sub.on("message", (channel, message) => {
    if (channel === "chat") {
      const data: ChatMessage = JSON.parse(message);
      const receiverSocket = connectedUsers.get(data.receiver);
      if (receiverSocket) {
        receiverSocket.emit("receive-message", {
          sender: data.sender,
          message: data.message,
          file_url: data.file_url,
          file_type: data.file_type,
          timestamp: new Date(),
          sender_name: data.sender_name, // Pass along the sender name
          patient_id: data.patient_id, // Pass along the patient ID
        });
      }
    }
  });

  io.on("disconnect", (socket: Socket) => {
    console.log("User disconnected:", socket.id);
  });
};
