import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";
import { CreateAppointmentWithTicketSchema } from "../../types";
import { generateTicketNumber, generateQRCode, calculateExpiryDate } from "../../utils/ticket";

const appointmentRouter = Router();

// Create new appointment with ticket
appointmentRouter.post("/book", async (req: Request, res: Response) => {
    const body = req.body;
    const parsedData = CreateAppointmentWithTicketSchema.safeParse(body);

    if (!parsedData.success) {
        res.status(400).json({
            status: "error",
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return;
    }

    try {
        // First verify that both patient and doctor exist
        const patient = await prismaClient.patient.findUnique({
            where: { wallet_address: parsedData.data.patient_id }
        });

        if (!patient) {
            res.status(404).json({
                status: "error",
                message: "Patient not found"
            });
            return;
        }

        const doctor = await prismaClient.doctor.findUnique({
            where: { doctor_id: parsedData.data.doctor_id }
        });

        if (!doctor) {
            res.status(404).json({
                status: "error",
                message: "Doctor not found"
            });
            return;
        }

        // Extract ticket notes and remove from appointment data
        const { ticket_notes, ...appointmentData } = parsedData.data;

        // Start a transaction to ensure both appointment and ticket are created
        const result = await prismaClient.$transaction(async (prisma) => {
            // Create appointment with full data validation
            const appointment = await prisma.appointment.create({
                data: {
                    patient: {
                        connect: { wallet_address: appointmentData.patient_id } // Changed from id to wallet_address
                    },
                    doctor: {
                        connect: { doctor_id: appointmentData.doctor_id } // Changed from id to doctor_id
                    },
                    date: new Date(appointmentData.date),
                    appointment_fee: appointmentData.appointment_fee,
                    amount_paid: appointmentData.amount_paid,
                    status: "pending",
                    is_active: true,
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });

            // Generate ticket number
            const ticketNumber = await generateTicketNumber();

            // Generate QR code
            const qrCodeUrl = await generateQRCode(ticketNumber, appointment.id);

            // Calculate expiry date
            const expiryDate = calculateExpiryDate();

            // Create ticket for the appointment
            const ticket = await prisma.ticket.create({
                data: {
                    ticket_number: ticketNumber,
                    appointment_id: appointment.id,
                    notes: ticket_notes,
                    qr_code: qrCodeUrl,
                    expires_at: expiryDate,
                },
                include: {
                    appointment: {
                        include: {
                            patient: true,
                            doctor: true
                        }
                    }
                }
            });

            return { appointment, ticket };
        });

        res.status(201).json({
            status: "success",
            data: {
                ...result,
                ticket: {
                    ...result.ticket,
                    expires_in_days: 3,
                }
            }
        });
    } catch (error) {
        console.error("Error creating appointment with ticket:", error);
        res.status(500).json({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to create appointment",
            details: error instanceof Error ? error.stack : undefined
        });
    }
});

// ...other appointment routes...

export default appointmentRouter;
