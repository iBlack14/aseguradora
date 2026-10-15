import {z} from 'zod';
export const vehicleSchema=z.object({plate:z.string().trim().toUpperCase().min(5).max(8),vehicleType:z.enum(['AUTO','MOTO','MOTOTAXI','CARGO']),department:z.string().min(2),startsAt:z.coerce.date()});
export const customerSchema=z.object({firstName:z.string().min(2),lastName:z.string().min(2),documentType:z.enum(['DNI','CE','RUC']),documentNumber:z.string().min(8).max(11),email:z.string().email(),phone:z.string().min(9).max(12)});
export type VehicleInput=z.infer<typeof vehicleSchema>;export type CustomerInput=z.infer<typeof customerSchema>;
