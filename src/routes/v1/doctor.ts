import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";
import { RegisterDoctorSchema } from "../../types";

const doctorRouter = Router();


doctorRouter.get("/specializations", async (_req: Request, res: Response) => {
    try {
        const specializations = await prismaClient.specialty.findMany();
        res.status(200).json(specializations);

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: "Bad Request",
        })
    }
});


// register a new doctor
doctorRouter.post("/doctor", async (req: Request, res: Response) => {
    const body = req.body;
    const parsedData = RegisterDoctorSchema.safeParse(body);
    if (!parsedData.success) {
        res.status(400).json({
            status: "error",
            message: "Invalid data",
        });
        return;
    };

    try {

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
                    connect: parsedData.data.specialties.map((specialty) => ({ id: specialty }))
                },
                location_lat: parsedData.data.locationwork.latitude,
                location_lng: parsedData.data.locationwork.longitude,
                wallet_address: parsedData.data.wallet_address,
                profile_picture: parsedData.data.profile_picture,
                available_days: parsedData.data.available_days,
                available_time: {
                    create: parsedData.data.available_time.map((time) => ({
                        start_time: time.start_time,
                        end_time: time.end_time
                    }))
                }
            }
        });

        res.status(201).json({
            status: "success",
            data: doctor
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: "Bad Request",
        })
    }
});


doctorRouter.get("/doctor", async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized"
        });
        return;
    }

    try {
        const doctor = await prismaClient.doctor.findUnique({
            where: {
                doctor_id: auth
            },
            include: {
                specialties: true,
                available_time: true
            }
        });

        if (!doctor) {
            res.status(404).json({
                status: "error",
                message: "Doctor not found"
            });
            return;
        }

        res.status(200).json({
            status: "success",
            data: doctor
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: "Bad Request",
        })
    }

})




export default doctorRouter;