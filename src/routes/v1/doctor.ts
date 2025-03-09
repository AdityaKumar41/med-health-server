import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";
import {
  RegisterDoctorSchema,
  UpdateDoctorSchema,
  RatingSchema,
} from "../../types";

const doctorRouter = Router();

doctorRouter.get("/specializations", async (_req: Request, res: Response) => {
  try {
    const specializations = await prismaClient.specialty.findMany();
    res.status(200).json(specializations);
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Bad Request",
    });
  }
});

// get specializations by doctor id
doctorRouter.get(
  "/specializations/:id",
  async (req: Request, res: Response) => {
    const { id } = req.body;

    try {
      const speciality = await prismaClient.doctorSpecialty.findMany({
        where: {
          doctor_id: id,
        },
        include: {
          specialty: true,
        },
      });

      res.status(200).json({
        status: "success",
        message: speciality,
      });
    } catch (error) {
      res.status(404).json({
        status: "error",
        message: "not found",
      });
    }
  }
);

// register a new doctor
doctorRouter.post("/doctor", async (req: Request, res: Response) => {
  const body = req.body;

  const parsedData = RegisterDoctorSchema.safeParse(body);
  if (!parsedData.success) {
    console.log(parsedData.error);
    res.status(400).json({
      status: "error",
      message: "Invalid data",
    });
    return;
  }

  try {
    // Check if doctor already exists
    const existingDoctor = await prismaClient.doctor.findFirst({
      where: {
        OR: [
          { email: parsedData.data.email },
          { doctor_id: parsedData.data.doctor_id },
        ],
      },
    });

    if (existingDoctor) {
      res.status(400).json({
        status: "error",
        message: "Doctor with this email or ID already exists",
      });
      return;
    }

    const doctor = await prismaClient.doctor.create({
      data: {
        name: parsedData.data.name,
        email: parsedData.data.email,
        age: parsedData.data.age,
        doctor_id: parsedData.data.doctor_id,
        hospital: parsedData.data.hospital,
        experience: parsedData.data.experience,
        qualification: parsedData.data.qualification,
        bio: parsedData.data.bio,
        specialties: {
          create: parsedData.data.specialties.map((specialty) => ({
            specialty: {
              connect: { id: specialty },
            },
          })),
        },
        location_lat: parsedData.data.locationwork.latitude,
        location_lng: parsedData.data.locationwork.longitude,
        wallet_address: parsedData.data.wallet_address,
        profile_picture: parsedData.data.profile_picture,
        available_days: parsedData.data.available_days,
        available_time: {
          create: parsedData.data.available_time.map((time) => ({
            start_time: time.start_time,
            end_time: time.end_time,
          })),
        },
        consultancy_fees: parsedData.data.consultancy_fees,
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
      },
    });

    res.status(201).json({
      status: "success",
      data: doctor,
    });
  } catch (error) {
    console.error("Error creating doctor:", error);
    res.status(400).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to create doctor",
    });
  }
});

// get all appointments and patients
doctorRouter.get(
  "/doctor/appointments",
  async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
      return;
    }

    console.log("auth", auth);

    try {
      const appointment = await prismaClient.appointment.findMany({
        where: {
          doctor_id: auth,
        },
        include: {
          patient: true,
        },
      });

      if (!appointment) {
        res.status(404).json({
          status: "error",
          message: "Doctor not found",
        });
        return;
      }

      res.status(200).json({
        status: "success",
        data: appointment,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: "Bad Request",
      });
    }
  }
);

doctorRouter.get("/doctor", async (req: Request, res: Response) => {
  const auth = req.headers.authorization?.split(" ")[1];
  console.log(auth);
  if (!auth) {
    res.status(401).json({
      status: "error",
      message: "Unauthorized",
    });
    return;
  }

  try {
    const doctor = await prismaClient.doctor.findUnique({
      where: {
        wallet_address: auth,
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
        appointments: true,
      },
    });

    if (!doctor) {
      res.status(404).json({
        status: "error",
        message: "Doctor not found",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: doctor,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Bad Request",
    });
  }
});

// Update doctor details
doctorRouter.patch("/doctor", async (req: Request, res: Response) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) {
    res.status(401).json({
      status: "error",
      message: "Unauthorized",
    });
    return;
  }

  const body = req.body;
  const parsedData = UpdateDoctorSchema.safeParse(body);

  if (!parsedData.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid data",
      errors: parsedData.error.errors,
    });
    return;
  }

  try {
    const updateData: any = { ...parsedData.data };

    // Handle nested objects
    if (updateData.locationwork) {
      updateData.location_lat = updateData.locationwork.latitude;
      updateData.location_lng = updateData.locationwork.longitude;
      delete updateData.locationwork;
    }

    // Handle specialties if provided
    let specialtiesUpdate = {};
    if (updateData.specialties) {
      // First disconnect all existing specialties
      await prismaClient.doctorSpecialty.deleteMany({
        where: {
          doctor: { doctor_id: auth },
        },
      });

      // Then create new connections
      specialtiesUpdate = {
        specialties: {
          create: updateData.specialties.map((specialty_id: string) => ({
            specialty: {
              connect: { id: specialty_id },
            },
          })),
        },
      };
      delete updateData.specialties;
    }

    // Handle available_time if provided
    let availableTimeUpdate = {};
    if (updateData.available_time) {
      availableTimeUpdate = {
        available_time: {
          deleteMany: {},
          create: updateData.available_time.map((time: any) => ({
            start_time: time.start_time,
            end_time: time.end_time,
          })),
        },
      };
      delete updateData.available_time;
    }

    const updatedDoctor = await prismaClient.doctor.update({
      where: { doctor_id: auth },
      data: {
        ...updateData,
        ...specialtiesUpdate,
        ...availableTimeUpdate,
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: updatedDoctor,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      status: "error",
      message: "Failed to update doctor details",
    });
  }
});

// Get all doctors
doctorRouter.get("/doctors", async (req: Request, res: Response) => {
  try {
    const doctors = await prismaClient.doctor.findMany({
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: doctors,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Failed to fetch doctors",
    });
  }
});

// Get doctor by ID
doctorRouter.get("/doctor/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const doctor = await prismaClient.doctor.findFirst({
      where: {
        OR: [{ doctor_id: id }, { id: id }],
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
        ratings: true,
        appointments: true,
      },
    });

    if (!doctor) {
      res.status(404).json({
        status: "error",
        message: "Doctor not found",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: doctor,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Failed to fetch doctor details",
    });
  }
});

// get doctors by specializations
doctorRouter.get(
  "/doctors/specialization/:id",
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const doctors = await prismaClient.doctor.findMany({
        where: {
          specialties: {
            some: {
              specialty_id: id,
            },
          },
        },
        include: {
          specialties: {
            include: {
              specialty: true,
            },
          },
          available_time: true,
        },
      });

      res.status(200).json({
        status: "success",
        data: doctors,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: "Failed to fetch doctors",
      });
    }
  }
);

// query for search doctor
doctorRouter.get("/doctors/search", async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query) {
    res.status(400).json({
      status: "error",
      message: "Search query is required",
    });
  }
  console.log(query);

  try {
    const doctors = await prismaClient.doctor.findMany({
      where: {
        OR: [
          { name: { contains: query as string } },
          { hospital: { contains: query as string } },
          { bio: { contains: query as string } },
        ],
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: doctors,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Failed to fetch doctors",
    });
  }
});

// doctorRouter.get("/doctor/:id/ratings", async (req: Request, res: Response) => {
//     const { id } = req.params;
//     console.log(id)
// });

// find doctors by ids
doctorRouter.post("/doctors/bulk", async (req: Request, res: Response) => {
  const body = req.body;
  console.log(body);

  try {
    const doctors = await prismaClient.doctor.findMany({
      where: {
        doctor_id: {
          in: body.doctor_ids,
        },
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        available_time: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: doctors,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Failed to fetch doctors",
    });
  }
});

// get doctor specializations by id
// doctorRouter.get("/")

export default doctorRouter;
