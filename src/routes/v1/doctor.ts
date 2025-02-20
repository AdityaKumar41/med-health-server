import { Router, Request, Response } from "express";
import { prismaClient } from "../../client";

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
})

export default doctorRouter;