import { Router, Request, Response } from "express";
import { PatientSchema, UpdatePatientSchema } from "../../types";
import { prismaClient } from "../../client";

const useRouter = Router();

useRouter.get("/patient", async (req: Request, res: Response) => {
    try {
        // check if the patient is authenticated
        const auth = req.headers.authorization?.split(" ")[1];
        if (!auth) {
            res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
            return;
        }

        const responose = await prismaClient.patient.findUnique({
            where: { wallet_address: auth },
            include: {
                appointments: true,
                reports: true,
                prescriptions: true,
            }
        });

        if (!responose) {
            res.status(404).json({
                status: "error",
                message: "Not Found",
            });
            return;
        }

        res.status(200).send(responose);
    } catch (error) {
        res.status(404).json({
            status: "error",
            message: "Not Found",
        });
    }
});

useRouter.post("/patient", async (req: Request, res: Response) => {
    const body = req.body;
    const parsedData = PatientSchema.safeParse(body);

    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" });
        return;
    }
    const profileImage = `${process.env.PROFILE_IMG_URL}${parsedData.data.name.split(" ")[0]
        }`;

    try {
        await prismaClient.patient.create({
            data: {
                name: parsedData.data.name,
                email: parsedData.data.email,
                age: parsedData.data.age,
                gender: parsedData.data.gender,
                wallet_address: parsedData.data.wallet_address,
                profile_picture: profileImage,
                blood_group: parsedData.data.blood_group,
            },
        });
        res.status(201).json({
            status: "success",
            message: "Patient Created",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: "Invalid Data",
        });
    }
});

// update patient details
useRouter.put("/patient", async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized",
        });
        return;
    }
    const body = req.body;
    const parsedData = UpdatePatientSchema.safeParse(body);

    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" });
        return;
    }

    try {
        await prismaClient.patient.update({
            where: { wallet_address: auth },
            data: {
                name: parsedData.data.name,
                email: parsedData.data.email,
                age: parsedData.data.age,
                profile_picture: parsedData.data.profile_picture,
            },
        });

        res.status(200).json({
            status: "success",
            message: "Patient Updated",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: "Invalid Data",
        });
    }
});

export default useRouter;
