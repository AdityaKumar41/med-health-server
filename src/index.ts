import express from "express";
import appRouter from "./routes/v1/app";
import patientRouter from "./routes/v1/patient";
import cors from "cors";
import { startChatServer } from "./chatServer";
import doctorRouter from "./routes/v1/doctor";
import awsRouter from "./routes/v1/aws";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "*"
}));
app.use(express.json());

app.use("/v1", appRouter);
app.use("/v1", patientRouter);
app.use("/v1", doctorRouter);
app.use('/aws', awsRouter);

// Start the main API server
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});

// Start the chat server
startChatServer();