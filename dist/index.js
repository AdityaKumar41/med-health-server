"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app_1 = __importDefault(require("./routes/v1/app"));
const patient_1 = __importDefault(require("./routes/v1/patient"));
const cors_1 = __importDefault(require("cors"));
const chatServer_1 = require("./chatServer");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: "*"
}));
app.use(express_1.default.json());
app.use("/v1", app_1.default);
app.use("/v1", patient_1.default);
// Start the main API server
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});
// Start the chat server
(0, chatServer_1.startChatServer)();
