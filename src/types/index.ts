import z from 'zod';

export const PatientSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().nonempty(),
    age: z.number().int().positive(),
    gender: z.string().nonempty(),
    blood_group: z.string(),
    wallet_address: z.string().nonempty(),
});

export const DoctorSchema = z.object({
    name: z.string().nonempty()
})

// update patient details schema
export const UpdatePatientSchema = z.object({
    name: z.string().nonempty().optional(),
    email: z.string().nonempty().optional(),
    age: z.number().int().positive(),
    profile_picture: z.string().nonempty().optional()
})