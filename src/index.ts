import express from "express";
import appRouter from "./routes/v1/app";
import patientRouter from "./routes/v1/patient";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({
    origin: "*"
}));
app.use(express.json());

app.use("/v1", appRouter);
app.use("/v1", patientRouter);


app.listen(PORT, () => {
    console.log(`Server running ${PORT}`)
})


