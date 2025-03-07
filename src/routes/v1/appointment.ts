import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";
import { CreateAppointmentWithTicketSchema } from "../../types";
import {
  generateTicketNumber,
  generateQRCode,
  calculateExpiryDate,
} from "../../utils/ticket";

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

  // check if patient already has an appointment with the same doctor on the same day
  const appointmentExists = await prismaClient.appointment.findFirst({
    where: {
      patient_id: parsedData.data.patient_id,
      doctor_id: parsedData.data.doctor_id,
      date: new Date(parsedData.data.date),
    },
  });

  if (appointmentExists) {
    res.status(400).json({
      status: "error",
      message:
        "Appointment already exists for patient with the same doctor on the same day",
    });
    return;
  }

  try {
    // First verify that both patient and doctor exist
    const patient = await prismaClient.patient.findUnique({
      where: { id: parsedData.data.patient_id },
    });

    if (!patient) {
      res.status(404).json({
        status: "error",
        message: "Patient not found",
      });
      return;
    }

    const doctor = await prismaClient.doctor.findUnique({
      where: { id: parsedData.data.doctor_id },
    });

    if (!doctor) {
      res.status(404).json({
        status: "error",
        message: "Doctor not found",
      });
      return;
    }

    // Extract ticket notes and remove from appointment data
    const { ticket_notes, ...appointmentData } = parsedData.data;

    // Get appointment date for expiry calculation
    const appointmentDate = new Date(appointmentData.date);

    // Start a transaction to ensure both appointment and ticket are created
    const result = await prismaClient.$transaction(
      async (prisma: {
        appointment: {
          create: (arg0: {
            data: {
              patient: { connect: { id: string } };
              doctor: { connect: { id: string } };
              date: Date;
              appointment_fee: number;
              amount_paid: number;
              tx_hash: string;
              status: string; // Initial status is pending
              is_active: boolean;
            };
            include: { patient: boolean; doctor: boolean };
          }) => any;
        };
        ticket: {
          create: (arg0: {
            data: {
              ticket_number: string;
              appointment_id: any;
              notes: string | undefined;
              qr_code: string;
              status: string; // Initial status is pending
              expires_at: Date;
            };
            include: {
              appointment: { include: { patient: boolean; doctor: boolean } };
            };
          }) => any;
        };
      }) => {
        // Create appointment with full data validation
        const appointment = await prisma.appointment.create({
          data: {
            patient: {
              connect: { id: appointmentData.patient_id }, // Changed from id to wallet_address
            },
            doctor: {
              connect: { id: appointmentData.doctor_id }, // Changed from id to doctor_id
            },
            date: appointmentDate,
            appointment_fee: appointmentData.appointment_fee,
            amount_paid: appointmentData.amount_paid,
            tx_hash: appointmentData.tx_hash,
            status: "pending", // Initial status is pending
            is_active: true,
          },
          include: {
            patient: true,
            doctor: true,
          },
        });

        // Generate ticket number
        const ticketNumber = await generateTicketNumber();

        // Generate QR code
        const qrCodeUrl = await generateQRCode(ticketNumber, appointment.id);

        // Calculate expiry date based on appointment date, not the booking date
        const expiryDate = calculateExpiryDate(appointmentDate);

        // Create ticket for the appointment
        const ticket = await prisma.ticket.create({
          data: {
            ticket_number: ticketNumber,
            appointment_id: appointment.id,
            notes: ticket_notes,
            qr_code: qrCodeUrl,
            status: "pending", // Initial status is pending
            expires_at: expiryDate,
          },
          include: {
            appointment: {
              include: {
                patient: true,
                doctor: true,
              },
            },
          },
        });

        return { appointment, ticket };
      }
    );

    console.log("Created appointment with ticket:", result);

    res.status(201).json({
      status: "success",
      data: {
        ...result,
        ticket: {
          ...result.ticket,
          expires_in_days: 3,
        },
      },
    });
  } catch (error) {
    console.error("Error creating appointment with ticket:", error);
    res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to create appointment",
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Add endpoint for doctors to update appointment status
appointmentRouter.patch(
  "/:appointmentId/status",
  async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!["scheduled", "cancelled", "completed", "pending"].includes(status)) {
      res.status(400).json({
        status: "error",
        message:
          "Invalid status value. Must be 'scheduled', 'cancelled', 'completed', or 'pending'.",
      });
      return;
    }

    try {
      // Update both appointment and ticket status in a transaction
      const result = await prismaClient.$transaction(
        async (prisma: {
          appointment: {
            update: (arg0: {
              where: { id: string };
              data: { status: any };
              include: { ticket: boolean };
            }) => any;
          };
          ticket: {
            update: (arg0: {
              where: { id: any };
              data: { status: any };
            }) => any;
          };
        }) => {
          // Update appointment status
          const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status },
            include: { ticket: true },
          });

          // Also update the ticket status to match
          if (appointment.ticket) {
            let ticketStatus = status;
            // If appointment is completed, ticket becomes used
            if (status === "completed") {
              ticketStatus = "used";
            }

            await prisma.ticket.update({
              where: { id: appointment.ticket.id },
              data: { status: ticketStatus },
            });
          }

          return appointment;
        }
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to update appointment status",
      });
    }
  }
);

// Get appointment by patinet
appointmentRouter.get("/appointments", async (req: Request, res: Response) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) {
    res.status(401).json({
      status: "error",
      message: "Unauthorized",
    });
    return;
  }

  try {
    const patient = await prismaClient.patient.findUnique({
      where: { wallet_address: auth },
    });

    if (!patient) {
      res.status(404).json({
        status: "error",
        message: "Patient not found",
      });
      return;
    }

    const appointments = await prismaClient.appointment.findMany({
      where: { patient_id: patient.id },
      include: {
        doctor: {
          include: {
            specialties: true,
          },
        },
        ticket: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch appointments",
    });
  }
});

// Get appointment by doctor
appointmentRouter.get(
  "/appointments/doctor",
  async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
      return;
    }

    try {
      const doctor = await prismaClient.doctor.findUnique({
        where: { wallet_address: auth },
      });

      if (!doctor) {
        res.status(404).json({
          status: "error",
          message: "Doctor not found",
        });
        return;
      }

      const appointments = await prismaClient.appointment.findMany({
        where: { doctor_id: doctor.id },
        include: {
          patient: true,
          ticket: true,
        },
      });

      res.status(200).json({
        status: "success",
        data: appointments,
      });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch appointments",
      });
    }
  }
);

export default appointmentRouter;
