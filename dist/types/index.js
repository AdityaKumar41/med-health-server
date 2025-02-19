"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePatientSchema = exports.DoctorSchema = exports.PatientSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.PatientSchema = zod_1.default.object({
    name: zod_1.default.string().nonempty(),
    email: zod_1.default.string().nonempty(),
    age: zod_1.default.number().int().positive(),
    gender: zod_1.default.string().nonempty(),
    blood_group: zod_1.default.string(),
    wallet_address: zod_1.default.string().nonempty(),
});
exports.DoctorSchema = zod_1.default.object({
    name: zod_1.default.string().nonempty()
});
// update patient details schema
exports.UpdatePatientSchema = zod_1.default.object({
    name: zod_1.default.string().nonempty().optional(),
    email: zod_1.default.string().nonempty().optional(),
    age: zod_1.default.number().int().positive(),
    profile_picture: zod_1.default.string().nonempty().optional()
});
