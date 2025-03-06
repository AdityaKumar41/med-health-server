import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";
import { CreateTicketSchema, UpdateTicketSchema } from "../../types";
import {
    generateTicketNumber,
    generateQRCode,
    calculateExpiryDate,
    checkAndUpdateExpiredTickets,
} from "../../utils/ticket";

const ticketRouter = Router();

// Create a new ticket
ticketRouter.post("/", async (req: Request, res: Response) => {
    const body = req.body;
    const parsedData = CreateTicketSchema.safeParse(body);

    if (!parsedData.success) {
        res.status(400).json({
            status: "error",
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return;
    }

    try {
        // Check if appointment exists
        const appointment = await prismaClient.appointment.findUnique({
            where: { id: parsedData.data.appointment_id },
            include: { ticket: true },
        });

        if (!appointment) {
            res.status(404).json({
                status: "error",
                message: "Appointment not found",
            });
            return;
        }

        // Check if ticket already exists for this appointment
        if (appointment.ticket) {
            res.status(400).json({
                status: "error",
                message: "Ticket already exists for this appointment",
                ticket: appointment.ticket,
            });
            return;
        }

        // Get appointment date for expiry calculation
        const appointmentDate = appointment.date;

        // Generate unique ticket number
        const ticketNumber = await generateTicketNumber();

        // Generate QR code containing ticket information
        const qrCodeUrl = await generateQRCode(
            ticketNumber,
            parsedData.data.appointment_id
        );

        // Calculate expiry date (3 days from appointment date, not creation date)
        const expiryDate = calculateExpiryDate(appointmentDate);

        // Create ticket with initial status matching appointment
        const ticket = await prismaClient.ticket.create({
            data: {
                ticket_number: ticketNumber,
                appointment_id: parsedData.data.appointment_id,
                notes: parsedData.data.notes,
                qr_code: qrCodeUrl,
                status: appointment.status, // Match appointment status
                expires_at: expiryDate,
            },
        });

        res.status(201).json({
            status: "success",
            data: {
                ...ticket,
                expires_in_days: 3,
            },
        });
    } catch (error) {
        console.error("Error creating ticket:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to create ticket",
        });
    }
});

// Get ticket by ticket number
ticketRouter.get("/:ticketNumber", async (req: Request, res: Response) => {
    const { ticketNumber } = req.params;

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
            res.status(404).json({
                status: "error",
                message: "Ticket not found",
            });
            return;
        }

        res.status(200).json({
            status: "success",
            data: ticket,
        });
    } catch (error) {
        console.error("Error fetching ticket:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch ticket",
        });
        return;
    }
});

// Get all tickets (with optional filtering)
ticketRouter.get("/", async (req: Request, res: Response) => {
    const { status, patient_id, doctor_id } = req.query;

    try {
        const filters: any = {};

        if (status) {
            filters.status = status;
        }

        if (patient_id || doctor_id) {
            filters.appointment = {};

            if (patient_id) {
                filters.appointment.patient_id = patient_id;
            }

            if (doctor_id) {
                filters.appointment.doctor_id = doctor_id;
            }
        }

        const tickets = await prismaClient.ticket.findMany({
            where: filters,
            include: {
                appointment: {
                    include: {
                        doctor: true,
                        patient: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({
            status: "success",
            count: tickets.length,
            data: tickets,
        });
    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch tickets",
        });
    }
});

// Update ticket status
ticketRouter.patch("/:ticketNumber", async (req: Request, res: Response) => {
    const { ticketNumber } = req.params;
    const body = req.body;

    const parsedData = UpdateTicketSchema.safeParse(body);

    if (!parsedData.success) {
        res.status(400).json({
            status: "error",
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return;
    }

    try {
        const updatedTicket = await prismaClient.ticket.update({
            where: { ticket_number: ticketNumber },
            data: parsedData.data,
            include: {
                appointment: true,
            },
        });

        res.status(200).json({
            status: "success",
            data: updatedTicket,
        });
    } catch (error) {
        console.error("Error updating ticket:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to update ticket",
        });
    }
});

// Check ticket validity
ticketRouter.get(
    "/validate/:ticketNumber",
    async (req: Request, res: Response) => {
        const { ticketNumber } = req.params;

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
                res.status(404).json({
                    status: "error",
                    message: "Ticket not found",
                });
                return;
            }

            // Check if appointment date has passed and ticket is still pending
            const now = new Date();
            const appointmentDate = ticket.appointment.date;

            // Check if ticket is expired (only if appointment date has passed)
            if (appointmentDate < now && now > ticket.expires_at) {
                // Update ticket status to cancelled if expired
                await prismaClient.ticket.update({
                    where: { id: ticket.id },
                    data: { status: "cancelled" },
                });

                res.status(400).json({
                    status: "error",
                    message: "Ticket has expired",
                    ticket: {
                        ...ticket,
                        status: "cancelled",
                    },
                });
                return;
            }

            // Check if ticket status is not active
            if (ticket.status !== "active" && ticket.status !== "scheduled") {
                if (ticket.status === "pending") {
                    res.status(202).json({
                        status: "pending",
                        message: "Ticket is pending doctor approval",
                        ticket,
                    });
                    return;
                }

                res.status(400).json({
                    status: "error",
                    message: `Ticket is ${ticket.status}`,
                    ticket,
                });
                return;
            }

            // Calculate remaining time (only if appointment date has passed)
            let remainingHours = 0;
            let remainingMinutes = 0;

            if (appointmentDate < now) {
                const remainingMs = ticket.expires_at.getTime() - now.getTime();
                remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                remainingMinutes = Math.floor(
                    (remainingMs % (1000 * 60 * 60)) / (1000 * 60)
                );
            }

            res.status(200).json({
                status: "success",
                message: "Ticket is valid",
                data: {
                    ticket,
                    validity: {
                        expires_at: ticket.expires_at,
                        appointment_date: appointmentDate,
                        remaining_hours: remainingHours,
                        remaining_minutes: remainingMinutes,
                    },
                },
            });
        } catch (error) {
            console.error("Error validating ticket:", error);
            res.status(500).json({
                status: "error",
                message: "Failed to validate ticket",
            });
        }
    }
);

// Admin endpoint to check and update all expired tickets
ticketRouter.post("/check-expired", async (req: Request, res: Response) => {
    try {
        const updatedCount = await checkAndUpdateExpiredTickets();

        res.status(200).json({
            status: "success",
            message: `${updatedCount} expired tickets have been updated`,
        });
    } catch (error) {
        console.error("Error checking expired tickets:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to check expired tickets",
        });
    }
});

export default ticketRouter;
