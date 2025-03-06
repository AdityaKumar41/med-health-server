import express from "express";
import arcjet, { validateEmail } from "@arcjet/node";
import appRouter from "./routes/v1/app";
import patientRouter from "./routes/v1/patient";
import cors from "cors";
import { startChatServer } from "./chatServer";
import doctorRouter from "./routes/v1/doctor";
import awsRouter from "./routes/v1/aws";
import { setupTicketExpirationJob } from "./jobs/ticketExpiration";
import appointmentRouter from "./routes/v1/appointment";
import ticketRouter from "./routes/v1/ticket";
import reportsRouter from "./routes/v1/reports";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "*"
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const aj = arcjet({
    // Get your site key from https://app.arcjet.com and set it as an environment
    // variable rather than hard coding.
    key: process.env.ARCJET_KEY || "test_key", // Added fallback for development
    rules: [
        validateEmail({
            mode: process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN", // Only use LIVE in production
            deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
        }),
    ],
});

// Apply Arcjet middleware to routes that need email validation
// app.use("/v1/auth", aj); // Uncomment and add to routes that need email validation

app.use("/v1", appRouter);
app.use("/v1", patientRouter);
app.use("/v1", doctorRouter);
app.use('/aws', awsRouter);
app.use("/v1", appointmentRouter);
app.use('/v1/ticket', ticketRouter);
app.use('/v1', reportsRouter);

// Start the scheduled jobs
setupTicketExpirationJob();

// Start the main API server
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});

// Start the chat server
startChatServer();