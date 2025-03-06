import express, { Request, Response } from "express";
import { Router } from "express";
import { ReportSchema } from "../../types";
import { prismaClient } from "../../client";

const reportsRouter = Router();

// post the report
reportsRouter.post("/report", async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized",
        });
        return;
    }

    const body = req.body;
    const parsedData = ReportSchema.safeParse(body);
    if (!parsedData.success) {
        console.log(parsedData.error.errors);

        res.status(400).json({
            status: "error",
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return;
    }

    try {
        // Check if patient_id exists
        const patient = await prismaClient.patient.findUnique({
            where: { id: parsedData.data.patient_id },
        });

        console.log(patient);

        if (!patient) {
            res.status(404).json({
                status: "error",
                message: "Patient not found",
            });
            return;
        }
        const report = await prismaClient.report.create({
            data: {
                patient_id: parsedData.data.patient_id,
                appointment_id: parsedData.data.appointment_id,
                title: parsedData.data.title,
                description: parsedData.data.description,
                file_url: parsedData.data.file_url,
                file_type: parsedData.data.file_type,
                file_size: parsedData.data.file_size,
                report_type: parsedData.data.report_type,
                report_date: parsedData.data.report_date,
                is_verified: parsedData.data.is_verified,
            },
        });

        res.status(201).json({
            status: "success",
            data: report,
        });
    } catch (error) {
        console.error("Error creating report:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to create report",
        });
    }
});

// grant access to a report
reportsRouter.post("/report/access", async (req: Request, res: Response) => {
    const { report_id, doctor_id } = req.body;
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized",
        });
        return;
    }

    try {
        const user = await prismaClient.patient.findUnique({
            where: {
                wallet_address: auth,
            },
        });

        if (!user) {
            res.status(404).json({
                status: "error",
                message: "User not found",
            });
            return;
        }

        const report = await prismaClient.report.findUnique({
            where: {
                id: report_id,
            },
        });

        if (!report || report.patient_id !== user.id) {
            res.status(403).json({
                status: "error",
                message: "You do not have permission to grant access to this report",
            });
            return;
        }

        const access = await prismaClient.reportAccess.create({
            data: {
                report_id,
                doctor_id,
            },
        });

        res.status(201).json({
            status: "success",
            data: access,
        });
    } catch (error) {
        console.error("Error granting access:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to grant access",
        });
    }
});

// get the report by user
reportsRouter.get("/report", async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized",
        });
        return;
    }
    try {
        const user = await prismaClient.patient.findUnique({
            where: {
                wallet_address: auth,
            },
        });

        if (!user) {
            res.status(404).json({
                status: "error",
                message: "User not found",
            });
            return;
        }

        const reports = await prismaClient.report.findMany({
            where: {
                patient_id: user.id,
            },
        });

        res.status(200).json({
            status: "success",
            data: reports,
        });
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch reports",
        });
    }
});

export default reportsRouter;
