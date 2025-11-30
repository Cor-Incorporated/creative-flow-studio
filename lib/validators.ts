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
        changes: z.record(z.string(), z.any()).optional(), // Key-value pairs of changes
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
export function safeParseJson<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> | null {
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

// ============================================
// Conversation API Request Schemas
// ============================================

/**
 * Schema for creating a new conversation
 * POST /api/conversations
 */
export const createConversationSchema = z.object({
    title: z.string().max(200).optional(),
    mode: z.enum(['CHAT', 'PRO', 'SEARCH', 'IMAGE', 'VIDEO']).optional(),
});

export type CreateConversationRequest = z.infer<typeof createConversationSchema>;

/**
 * Schema for updating a conversation
 * PATCH /api/conversations/[id]
 */
export const updateConversationSchema = z.object({
    title: z.string().max(200),
});

export type UpdateConversationRequest = z.infer<typeof updateConversationSchema>;

/**
 * Schema for creating a new message in a conversation
 * POST /api/conversations/[id]/messages
 */
export const createMessageSchema = z.object({
    role: z.enum(['USER', 'MODEL', 'SYSTEM']),
    content: z
        .array(
            z.object({
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
                            title: z.string().optional(),
                        })
                    )
                    .optional(),
                isLoading: z.boolean().optional(),
                status: z.string().optional(),
                isError: z.boolean().optional(),
                isEditing: z.boolean().optional(),
                originalMedia: z
                    .object({
                        type: z.enum(['image', 'video']),
                        url: z.string(),
                        mimeType: z.string(),
                    })
                    .optional(),
            })
        )
        .min(1, 'Content array must have at least one item'),
});

export type CreateMessageRequest = z.infer<typeof createMessageSchema>;

// ============================================
// Admin API Request Schemas (Phase 6)
// ============================================

/**
 * Schema for updating user role
 * PATCH /api/admin/users/[id]
 */
export const updateUserRoleSchema = z.object({
    role: z.enum(['USER', 'PRO', 'ENTERPRISE', 'ADMIN']),
});

export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleSchema>;

/**
 * Schema for admin users list query parameters
 * GET /api/admin/users
 */
export const adminUsersQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .transform(val => Math.min(val, 100))
        .nullish()
        .default(20),
    offset: z.coerce.number().int().min(0).nullish().default(0),
    search: z.string().max(100).nullish(),
    role: z.enum(['USER', 'PRO', 'ENTERPRISE', 'ADMIN']).nullish(),
    plan: z.string().max(50).nullish(),
    status: z
        .enum(['ACTIVE', 'INACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'])
        .nullish(),
});

export type AdminUsersQueryParams = z.infer<typeof adminUsersQuerySchema>;

/**
 * Schema for admin usage logs query parameters
 * GET /api/admin/usage
 */
export const adminUsageQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .transform(val => Math.min(val, 100))
        .nullish()
        .default(50),
    offset: z.coerce.number().int().min(0).nullish().default(0),
    userId: z.string().cuid().nullish(),
    action: z.string().max(50).nullish(),
    resourceType: z.string().max(50).nullish(),
    startDate: z.string().datetime().nullish(),
    endDate: z.string().datetime().nullish(),
});

export type AdminUsageQueryParams = z.infer<typeof adminUsageQuerySchema>;
