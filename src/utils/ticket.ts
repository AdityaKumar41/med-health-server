import { prismaClient } from "../client";
import QRCode from "qrcode";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";

// Calculate expiration date (3 days from now)
export const calculateExpiryDate = (): Date => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3); // Add 3 days
    return expiryDate;
};

// Generate unique ticket number
export const generateTicketNumber = async (): Promise<string> => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateString = `${year}${month}${day}`;

    // Get count of tickets created today to generate sequential number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const ticketsToday = await prismaClient.ticket.count({
        where: {
            createdAt: {
                gte: todayStart,
                lte: todayEnd,
            },
        },
    });

    // Format: TCK-YYYYMMDD-001 (incrementing number)
    const sequentialNumber = String(ticketsToday + 1).padStart(3, "0");
    return `TCK-${dateString}-${sequentialNumber}`;
};

// Generate QR code for ticket
export const generateQRCode = async (ticketNumber: string, appointmentId: string): Promise<string> => {
    try {
        // Generate QR code data
        const qrData = JSON.stringify({
            ticket: ticketNumber,
            appointment: appointmentId,
            timestamp: new Date().toISOString(),
        });

        // Generate QR code as a buffer
        const qrCodeBuffer = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: "H",
            width: 300
        });

        // Upload QR code to AWS S3
        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            }
        });

        const qrCodeFileName = `${ticketNumber}-${Date.now()}.png`;
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: `qrcodes/${qrCodeFileName}`,
            Body: qrCodeBuffer,
            ContentType: 'image/png'
        };

        const command = new PutObjectCommand(uploadParams);
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        // Make a PUT request with the QR code buffer to the signed URL
        await axios.put(signedUrl, qrCodeBuffer, {
            headers: {
                'Content-Type': 'image/png'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        // Return the URL
        return signedUrl.split('?')[0];
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
};

// Validate ticket
export const validateTicket = async (ticketNumber: string): Promise<{ valid: boolean; message: string; ticket?: any }> => {
    try {
        const ticket = await prismaClient.ticket.findUnique({
            where: { ticket_number: ticketNumber },
            include: {
                appointment: {
                    include: {
                        doctor: true,
                        patient: true,
                    },
                },
            },
        });

        if (!ticket) {
            return { valid: false, message: "Ticket not found" };
        }

        // Check if ticket is expired
        if (new Date() > ticket.expires_at) {
            await prismaClient.ticket.update({
                where: { id: ticket.id },
                data: { status: "cancelled" }
            });
            return { valid: false, message: "Ticket has expired" };
        }

        if (ticket.status !== "active") {
            return { valid: false, message: `Ticket is ${ticket.status}` };
        }

        // Check if appointment is still valid
        const appointment = ticket.appointment;
        if (!appointment.is_active || appointment.status === "cancelled") {
            return { valid: false, message: "Associated appointment is no longer active" };
        }

        return { valid: true, message: "Valid ticket", ticket };
    } catch (error) {
        console.error("Error validating ticket:", error);
        return { valid: false, message: "Error validating ticket" };
    }
};

// Check and update expired tickets (can be run as a scheduled job)
export const checkAndUpdateExpiredTickets = async (): Promise<number> => {
    const now = new Date();

    try {
        const expiredTickets = await prismaClient.ticket.updateMany({
            where: {
                expires_at: { lt: now },
                status: "active"
            },
            data: {
                status: "cancelled"
            }
        });

        return expiredTickets.count;
    } catch (error) {
        console.error("Error updating expired tickets:", error);
        return 0;
    }
};
