/**
 * Zod Validators for JSON fields in Prisma schema
 *
 * These schemas validate the structure of JSON fields like Plan.features,
 * UsageLog.metadata, and Message.content to ensure type safety at runtime.
 */

import { z } from 'zod';

// ============================================
// Plan.features Schema
// ============================================

export const PlanFeaturesSchema = z.object({
    maxRequestsPerMonth: z.number().nullable(),
    maxFileSize: z.number().nullable(), // in bytes
    maxConcurrentRequests: z.number().default(3),
    allowImageGeneration: z.boolean().default(true),
    allowVideoGeneration: z.boolean().default(false),
    allowProMode: z.boolean().default(false),
    allowSearchMode: z.boolean().default(true),
    prioritySupport: z.boolean().default(false),
    customBranding: z.boolean().default(false),
});

export type PlanFeatures = z.infer<typeof PlanFeaturesSchema>;

// ============================================
// UsageLog.metadata Schema
// ============================================

export const UsageLogMetadataSchema = z.object({
    model: z.string().optional(), // e.g., 'gemini-2.5-flash', 'imagen-4.0'
    mode: z.enum(['chat', 'pro', 'search', 'image', 'video']).optional(),
    tokensUsed: z.number().optional(),
    imageSize: z.string().optional(), // e.g., '1024x1024'
    videoLength: z.number().optional(), // in seconds
    aspectRatio: z.string().optional(),
    success: z.boolean().default(true),
    errorMessage: z.string().optional(),
});

export type UsageLogMetadata = z.infer<typeof UsageLogMetadataSchema>;

// ============================================
// Message.content Schema
// ============================================

export const MessageContentSchema = z.object({
    text: z.string().optional(),
    media: z
        .object({
            type: z.enum(['image', 'video']),
            url: z.string(),
            mimeType: z.string(),
        })
        .optional(),
    sources: z
        .array(
            z.object({
                uri: z.string(),
                title: z.string(),
            })
        )
        .optional(),
    isLoading: z.boolean().optional(),
    status: z.string().optional(),
    isError: z.boolean().optional(),
    originalMedia: z
        .object({
            type: z.enum(['image', 'video']),
            url: z.string(),
            mimeType: z.string(),
        })
        .optional(),
});

export type MessageContent = z.infer<typeof MessageContentSchema>;

// ============================================
// PaymentEvent.metadata Schema
// ============================================

export const PaymentEventMetadataSchema = z
    .object({
        invoiceId: z.string().optional(),
        customerId: z.string().optional(),
        subscriptionId: z.string().optional(),
        paymentIntentId: z.string().optional(),
        productId: z.string().optional(),
        priceId: z.string().optional(),
        currency: z.string().optional(),
        failureCode: z.string().optional(),
        failureMessage: z.string().optional(),
    })
    .passthrough(); // Allow additional Stripe metadata

export type PaymentEventMetadata = z.infer<typeof PaymentEventMetadataSchema>;

// ============================================
// AuditLog.metadata Schema
// ============================================

export const AuditLogMetadataSchema = z
    .object({
        before: z.any().optional(), // Previous state (can be any type)
        after: z.any().optional(), // New state (can be any type)
        reason: z.string().optional(),
        changes: z.record(z.any()).optional(), // Key-value pairs of changes
    })
    .passthrough(); // Allow additional audit metadata

export type AuditLogMetadata = z.infer<typeof AuditLogMetadataSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Safely parse and validate JSON data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed data if valid, null if invalid
 */
export function safeParseJson<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown
): z.infer<T> | null {
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
}

/**
 * Parse and validate JSON data, throwing error if invalid
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed data
 * @throws ZodError if validation fails
 */
export function parseJson<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    return schema.parse(data);
}
