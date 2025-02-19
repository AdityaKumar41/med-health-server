"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const types_1 = require("../../types");
const client_1 = require("../../client");
const useRouter = (0, express_1.Router)();
useRouter.get("/patient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // check if the patient is authenticated
        const auth = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        if (!auth) {
            res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
            return;
        }
        const responose = yield client_1.prismaClient.patient.findUnique({
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
    }
    catch (error) {
        res.status(404).json({
            status: "error",
            message: "Not Found",
        });
    }
}));
useRouter.post("/patient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const parsedData = types_1.PatientSchema.safeParse(body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" });
        return;
    }
    const profileImage = `${process.env.PROFILE_IMG_URL}${parsedData.data.name.split(" ")[0]}`;
    try {
        yield client_1.prismaClient.patient.create({
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
    }
    catch (error) {
        res.status(400).json({
            status: "error",
            message: "Invalid Data",
        });
    }
}));
// update patient details
useRouter.put("/patient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const auth = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    if (!auth) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized",
        });
        return;
    }
    const body = req.body;
    const parsedData = types_1.UpdatePatientSchema.safeParse(body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" });
        return;
    }
    try {
        yield client_1.prismaClient.patient.update({
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
    }
    catch (error) {
        res.status(400).json({
            status: "error",
            message: "Invalid Data",
        });
    }
}));
exports.default = useRouter;
