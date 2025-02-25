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
});


// register a new doctor schema
export const RegisterDoctorSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().nonempty(),
    age: z.number().int().positive(),
    doctor_id: z.string().nonempty(),
    hospital: z.string().nonempty(),
    experience: z.number().int().positive(),
    qualification: z.string().nonempty(),
    bio: z.string().nonempty(),
    specialties: z.array(z.string().nonempty()),
    profile_picture: z.string().nonempty(),
    wallet_address: z.string().nonempty(),
    verified: z.boolean(),
    locationwork: z.object({
        latitude: z.number(),
        longitude: z.number()
    }),
    available_days: z.array(z.string().nonempty()),
    available_time: z.array(z.object({
        start_time: z.string().nonempty(),
        end_time: z.string().nonempty()
    }))
});


export const SignedUrlSchema = z.object({
    filename: z.string().nonempty(),
    filetype: z.string().refine((val) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        return allowedTypes.includes(val);
    }, {
        message: "File type must be jpeg, jpg, or png"
    })
})