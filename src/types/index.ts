import z from 'zod';

export const PatientSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().nonempty(),
    age: z.number().int().positive(),
    gender: z.string().nonempty(),
    blood_group: z.string(),
    wallet_address: z.string().nonempty(),
    profile_picture: z.string().optional(),
});

export const DoctorSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().nonempty(),
    age: z.number().int().positive(),
    doctor_id: z.string().nonempty(),
    wallet_address: z.string().nonempty(),
    profile_picture: z.string().optional(),
    hospital: z.string().nonempty(),
    experience: z.number().int().positive(),
    qualification: z.string().nonempty(),
    bio: z.string().nonempty(),
    location_lat: z.number(),
    location_lng: z.number(),
    available_days: z.array(z.string().nonempty()),
    specialties: z.array(z.string().nonempty()),
    average_rating: z.number().optional(),
    consultancy_fees: z.number().positive(),
});

// update patient details schema
export const UpdatePatientSchema = z.object({
    name: z.string().nonempty().optional(),
    email: z.string().nonempty().optional(),
    age: z.number().int().positive().optional(),
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
    locationwork: z.object({
        latitude: z.number(),
        longitude: z.number()
    }),
    available_days: z.array(z.string().nonempty()),
    available_time: z.array(z.object({
        start_time: z.string().nonempty(),
        end_time: z.string().nonempty()
    })),
    consultancy_fees: z.number().nonnegative()
});

// Add schema for updating doctor details
export const UpdateDoctorSchema = z.object({
    name: z.string().nonempty().optional(),
    email: z.string().nonempty().optional(),
    age: z.number().int().positive().optional(),
    hospital: z.string().nonempty().optional(),
    experience: z.number().int().positive().optional(),
    qualification: z.string().nonempty().optional(),
    bio: z.string().nonempty().optional(),
    profile_picture: z.string().nonempty().optional(),
    locationwork: z.object({
        latitude: z.number(),
        longitude: z.number()
    }).optional(),
    available_days: z.array(z.string().nonempty()).optional(),
    available_time: z.array(z.object({
        start_time: z.string().nonempty(),
        end_time: z.string().nonempty()
    })).optional(),
    specialties: z.array(z.string().nonempty()).optional()
});

// Rating schema
export const RatingSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
    appointment_id: z.string().nonempty()
});

export const SignedUrlSchema = z.object({
    filename: z.string().nonempty(),
    filetype: z.string().refine((val) => {
        const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        return allowedTypes.includes(val);
    }, {
        message: "File type must be jpeg, jpg, png, pdf, or word document"
    })
});

// Ticket schema
export const TicketSchema = z.object({
    ticket_number: z.string().nonempty(),
    appointment_id: z.string().nonempty(),
    status: z.enum(["active", "resolved", "cancelled"]).default("active"),
    notes: z.string().optional(),
    qr_code: z.string().optional(),
    expires_at: z.string().nonempty(), // New field: when the ticket expires
});

// Create ticket schema (when creating a new ticket)
export const CreateTicketSchema = z.object({
    appointment_id: z.string().nonempty(),
    notes: z.string().optional(),
});

// Update ticket schema
export const UpdateTicketSchema = z.object({
    status: z.enum(["active", "resolved", "cancelled"]).optional(),
    notes: z.string().optional(),
});

// Create appointment with ticket schema 
export const CreateAppointmentWithTicketSchema = z.object({
    patient_id: z.string().nonempty(),
    doctor_id: z.string().nonempty(),
    date: z.string().nonempty(), // Will be parsed to DateTime
    appointment_fee: z.number().positive(),
    amount_paid: z.number().positive(),
    ticket_notes: z.string().optional(),
    tx_hash: z.string().nonempty()
});

export const ReportSchema = z.object({
    patient_id: z.string(),
    appointment_id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    file_url: z.string(),
    file_type: z.string(),
    file_size: z.number(),
    report_type: z.string(),
    report_date: z.string(),
    is_verified: z.boolean().optional()
});

export type Report = z.infer<typeof ReportSchema>;