import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid official email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be a valid 10-digit number'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  confirm_password: z.string(),
  personnel_id: z.string().optional(),
  district_id: z.string().min(1, 'Please select your District'),
  unit_id: z.string().optional(),
  emergency_contact: z.string().optional(),
  blood_group: z.string().optional(),
  terms: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the Tamil Nadu Home Guards service code of conduct' }),
  }),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const checkInSchema = z.object({
  duty_assignment_id: z.string().optional().nullable(),
  location_id: z.string().min(1, 'Duty location is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  event_type: z.enum(['check_in', 'check_out']),
  device_info: z.string().optional(),
  remarks: z.string().optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const taskSchema = z.object({
  title: z.string().min(3, 'Task title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['new', 'assigned', 'in_progress', 'completed', 'cancelled']).default('new'),
  assigned_to: z.string().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  duty_assignment_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

export const dutyAssignmentSchema = z.object({
  title: z.string().min(3, 'Duty title is required'),
  description: z.string().optional(),
  duty_location_id: z.string().min(1, 'Duty location must be selected'),
  district_id: z.string().min(1, 'District is required'),
  unit_id: z.string().optional().nullable(),
  assigned_personnel_id: z.string().min(1, 'Home Guard personnel must be selected'),
  duty_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid duty date (YYYY-MM-DD) required'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Valid start time (HH:MM) required'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Valid end time (HH:MM) required'),
  reporting_instructions: z.string().optional(),
});

export type DutyAssignmentInput = z.infer<typeof dutyAssignmentSchema>;

export const eventSchema = z.object({
  title: z.string().min(3, 'Event title is required'),
  description: z.string().optional(),
  event_type: z.enum(['bandobast', 'crowd_control', 'traffic_management', 'emergency', 'ceremonial', 'training']),
  venue: z.string().min(2, 'Venue is required'),
  duty_location_id: z.string().optional().nullable(),
  district_id: z.string().min(1, 'District is required'),
  commander_id: z.string().optional().nullable(),
  required_personnel: z.number().int().min(1, 'At least 1 personnel required'),
  start_time: z.string().min(1, 'Start date & time required'),
  end_time: z.string().min(1, 'End date & time required'),
  status: z.enum(['planned', 'active', 'concluded', 'cancelled']).default('planned'),
  duty_instructions: z.string().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;
