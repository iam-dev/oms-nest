// Zod validation schemas for form inputs and API data
import { z } from 'zod';

// User validation schemas
export const loginSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .max(255, 'Username must be less than 255 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'),
  password: z.string()
    .min(1, 'Password is required')
    .max(255, 'Password must be less than 255 characters'),
});

export const userSchema = z.object({
  id: z.number().int('User ID must be an integer').positive('User ID must be positive').optional(),
  username: z.string()
    .min(1, 'Username is required')
    .max(255, 'Username must be less than 255 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .optional(),
  firstName: z.string()
    .max(255, 'First name must be less than 255 characters')
    .optional(),
  lastName: z.string()
    .max(255, 'Last name must be less than 255 characters')
    .optional(),
  role: z.enum(['admin', 'user', 'fitter', 'factory', 'supervisor'], {
    errorMap: () => ({ message: 'Invalid role' })
  }).optional(),
});

// Order validation schemas
export const orderFilterSchema = z.object({
  id: z.string()
    .max(20, 'Order ID must be less than 20 characters')
    .regex(/^\d*$/, 'Order ID must be a number')
    .optional(),
  orderId: z.string()
    .max(20, 'Order ID must be less than 20 characters')
    .regex(/^\d*$/, 'Order ID must be a number')
    .optional(),
  searchTerm: z.string()
    .max(255, 'Search term must be less than 255 characters')
    .optional(),
  reference: z.string()
    .max(255, 'Reference must be less than 255 characters')
    .optional(),
  saddle: z.string()
    .max(255, 'Saddle must be less than 255 characters')
    .optional(),
  customer: z.string()
    .max(255, 'Customer name must be less than 255 characters')
    .optional(),
  fitter: z.string()
    .max(255, 'Fitter name must be less than 255 characters')
    .optional(),
  factory: z.string()
    .max(255, 'Factory name must be less than 255 characters')
    .optional(),
  supplier: z.string()
    .max(255, 'Supplier name must be less than 255 characters')
    .optional(),
  status: z.string()
    .max(50, 'Status must be less than 50 characters')
    .optional(),
  urgent: z.string()
    .regex(/^(true|false|)$/, 'Urgent must be true, false, or empty')
    .optional(),
  seatSize: z.string()
    .max(50, 'Seat size must be less than 50 characters')
    .regex(/^[\d.,\s]*$/, 'Seat size can only contain numbers, commas, dots, and spaces')
    .optional(),
  orderIds: z.string()
    .max(2000, 'Order IDs must be less than 2000 characters')
    .regex(/^[\d,\s]*$/, 'Order IDs can only contain numbers, commas, and spaces')
    .optional(),
});

export const orderCreateSchema = z.object({
  reference: z.string()
    .min(1, 'Reference is required')
    .max(255, 'Reference must be less than 255 characters'),
  customerId: z.number()
    .int('Customer ID must be an integer')
    .positive('Customer ID must be positive'),
  fitterId: z.number()
    .int('Fitter ID must be an integer')
    .positive('Fitter ID must be positive')
    .optional(),
  factoryId: z.number()
    .int('Factory ID must be an integer')
    .positive('Factory ID must be positive')
    .optional(),
  orderStatus: z.string()
    .min(1, 'Order status is required')
    .max(50, 'Order status must be less than 50 characters'),
  urgent: z.boolean().default(false),
  seatSize: z.string()
    .max(50, 'Seat size must be less than 50 characters')
    .regex(/^[\d.,\s]*$/, 'Seat size can only contain numbers, commas, dots, and spaces')
    .optional(),
  notes: z.string()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional(),
});

export const orderUpdateSchema = orderCreateSchema.partial().extend({
  id: z.number().int('Order ID must be an integer').positive('Order ID must be positive'),
});

// Customer validation schemas
export const customerSchema = z.object({
  name: z.string()
    .min(1, 'Customer name is required')
    .max(255, 'Customer name must be less than 255 characters'),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .optional(),
  phone: z.string()
    .max(50, 'Phone number must be less than 50 characters')
    .regex(/^[\d\s\-\+\(\)]*$/, 'Phone number can only contain numbers, spaces, hyphens, plus signs, and parentheses')
    .optional(),
  address: z.string()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
});

// Search and pagination validation
export const searchSchema = z.object({
  searchTerm: z.string()
    .max(255, 'Search term must be less than 255 characters')
    .optional(),
  page: z.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page must be less than 10000')
    .default(1),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit must be less than 1000')
    .default(20),
  sortBy: z.string()
    .max(50, 'Sort field must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Sort field can only contain letters, numbers, and underscores')
    .optional(),
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Sort order must be asc or desc' })
  }).default('desc'),
});

// Date range validation
export const dateRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
}).refine((data) => {
  if (data.from && data.to) {
    return data.from <= data.to;
  }
  return true;
}, {
  message: 'From date must be before or equal to to date',
});

// API response validation
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  errors: z.array(z.string()).optional(),
});

// JWT payload validation
export const jwtPayloadSchema = z.object({
  sub: z.union([z.string(), z.number()]).optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  username: z.string().optional(),
  role: z.string().optional(),
  roles: z.array(z.string()).optional(),
  type: z.string().optional(),
  exp: z.number().int('Invalid expiration time').optional(),
  iat: z.number().int('Invalid issued at time').optional(),
});

// Environment variable validation
export const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('Invalid API URL').default('http://localhost:3001'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Helper function to safely validate data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return { 
      success: false, 
      errors: ['Unknown validation error']
    };
  }
}

// Helper function to sanitize string input
export function sanitizeString(input: string): string {
  let result = input.trim().slice(0, 10000); // Limit length to prevent DoS
  result = result.replace(/[<>]/g, ''); // Remove potential HTML/XML tags
  result = result.replace(/javascript:/gi, ''); // Remove javascript: protocols
  result = result.replace(/data:/gi, ''); // Remove data: URIs
  result = result.replace(/vbscript:/gi, ''); // Remove vbscript: protocols
  // Loop to prevent bypass via nested patterns (e.g. "oonnclick=" → "onclick=")
  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }
  return result;
}

// Helper function to sanitize object with string values
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Export types for TypeScript
export type LoginSchema = z.infer<typeof loginSchema>;
export type UserSchema = z.infer<typeof userSchema>;
export type OrderFilterSchema = z.infer<typeof orderFilterSchema>;
export type OrderCreateSchema = z.infer<typeof orderCreateSchema>;
export type OrderUpdateSchema = z.infer<typeof orderUpdateSchema>;
export type CustomerSchema = z.infer<typeof customerSchema>;
export type SearchSchema = z.infer<typeof searchSchema>;
export type DateRangeSchema = z.infer<typeof dateRangeSchema>;
export type ApiResponseSchema = z.infer<typeof apiResponseSchema>;
export type JwtPayloadSchema = z.infer<typeof jwtPayloadSchema>;
export type EnvSchema = z.infer<typeof envSchema>;