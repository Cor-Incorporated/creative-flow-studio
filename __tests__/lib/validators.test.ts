import { describe, it, expect } from 'vitest';
import {
    PlanFeaturesSchema,
    UsageLogMetadataSchema,
    MessageContentSchema,
    PaymentEventMetadataSchema,
    AuditLogMetadataSchema,
    createConversationSchema,
    updateConversationSchema,
    createMessageSchema,
    updateUserRoleSchema,
    adminUsersQuerySchema,
    adminUsageQuerySchema,
    safeParseJson,
    parseJson,
} from '@/lib/validators';

describe('Validators', () => {
    describe('PlanFeaturesSchema', () => {
        it('should validate valid plan features', () => {
            const data = {
                maxRequestsPerMonth: 1000,
                maxFileSize: 10485760,
                maxConcurrentRequests: 5,
                allowImageGeneration: true,
                allowVideoGeneration: true,
                allowProMode: true,
                allowSearchMode: true,
                prioritySupport: true,
                customBranding: true,
            };

            const result = PlanFeaturesSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should apply defaults for missing fields', () => {
            const data = {
                maxRequestsPerMonth: 100,
                maxFileSize: null,
            };

            const result = PlanFeaturesSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxConcurrentRequests).toBe(3);
                expect(result.data.allowImageGeneration).toBe(true);
                expect(result.data.allowVideoGeneration).toBe(false);
            }
        });

        it('should allow null values for nullable fields', () => {
            const data = {
                maxRequestsPerMonth: null,
                maxFileSize: null,
            };

            const result = PlanFeaturesSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe('UsageLogMetadataSchema', () => {
        it('should validate valid usage log metadata', () => {
            const data = {
                model: 'gemini-2.5-flash',
                mode: 'chat',
                tokensUsed: 150,
                success: true,
            };

            const result = UsageLogMetadataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate all mode values', () => {
            const modes = ['chat', 'search', 'image', 'video'];
            for (const mode of modes) {
                const result = UsageLogMetadataSchema.safeParse({ mode });
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid mode', () => {
            const result = UsageLogMetadataSchema.safeParse({ mode: 'invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('MessageContentSchema', () => {
        it('should validate text-only content', () => {
            const data = { text: 'Hello world' };
            const result = MessageContentSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate content with media', () => {
            const data = {
                text: 'Check this image',
                media: {
                    type: 'image',
                    url: 'https://example.com/image.png',
                    mimeType: 'image/png',
                },
            };
            const result = MessageContentSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate content with sources', () => {
            const data = {
                text: 'From search',
                sources: [
                    { uri: 'https://example.com', title: 'Example' },
                    { uri: 'https://another.com', title: 'Another' },
                ],
            };
            const result = MessageContentSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject invalid media type', () => {
            const data = {
                media: {
                    type: 'audio',
                    url: 'https://example.com/audio.mp3',
                    mimeType: 'audio/mp3',
                },
            };
            const result = MessageContentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('PaymentEventMetadataSchema', () => {
        it('should validate payment event metadata', () => {
            const data = {
                invoiceId: 'in_123',
                customerId: 'cus_456',
                currency: 'usd',
            };
            const result = PaymentEventMetadataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should allow additional stripe fields (passthrough)', () => {
            const data = {
                customField: 'value',
                anotherField: 123,
            };
            const result = PaymentEventMetadataSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.customField).toBe('value');
            }
        });
    });

    describe('AuditLogMetadataSchema', () => {
        it('should validate audit log metadata', () => {
            const data = {
                before: { role: 'USER' },
                after: { role: 'ADMIN' },
                reason: 'Promotion',
            };
            const result = AuditLogMetadataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate with changes object', () => {
            const data = {
                changes: {
                    role: 'ADMIN',
                    email: 'new@example.com',
                },
            };
            const result = AuditLogMetadataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe('createConversationSchema', () => {
        it('should validate with title and mode', () => {
            const data = { title: 'Test Conversation', mode: 'CHAT' };
            const result = createConversationSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate without optional fields', () => {
            const data = {};
            const result = createConversationSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject title over 200 chars', () => {
            const data = { title: 'a'.repeat(201) };
            const result = createConversationSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should validate all mode values', () => {
            const modes = ['CHAT', 'SEARCH', 'IMAGE', 'VIDEO'];
            for (const mode of modes) {
                const result = createConversationSchema.safeParse({ mode });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('updateConversationSchema', () => {
        it('should validate title update', () => {
            const data = { title: 'Updated Title' };
            const result = updateConversationSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject missing title', () => {
            const data = {};
            const result = updateConversationSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('createMessageSchema', () => {
        it('should validate message with text content', () => {
            const data = {
                role: 'USER',
                content: [{ text: 'Hello' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate message with media', () => {
            const data = {
                role: 'MODEL',
                content: [
                    {
                        media: {
                            type: 'image',
                            url: 'https://example.com/img.png',
                            mimeType: 'image/png',
                        },
                    },
                ],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject empty content array', () => {
            const data = { role: 'USER', content: [] };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should validate all role values', () => {
            const roles = ['USER', 'MODEL', 'SYSTEM'];
            for (const role of roles) {
                const result = createMessageSchema.safeParse({
                    role,
                    content: [{ text: 'test' }],
                });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('createMessageSchema - mode parameter', () => {
        it('should accept mode="CHAT"', () => {
            const data = {
                role: 'USER',
                mode: 'CHAT',
                content: [{ text: 'Hello' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept mode="SEARCH"', () => {
            const data = {
                role: 'USER',
                mode: 'SEARCH',
                content: [{ text: 'Hello' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept mode="IMAGE"', () => {
            const data = {
                role: 'USER',
                mode: 'IMAGE',
                content: [{ text: 'Generate an image' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept mode="VIDEO"', () => {
            const data = {
                role: 'USER',
                mode: 'VIDEO',
                content: [{ text: 'Generate a video' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept message without mode (optional)', () => {
            const data = {
                role: 'USER',
                content: [{ text: 'Hello' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.mode).toBeUndefined();
            }
        });

        it('should reject invalid mode value', () => {
            const data = {
                role: 'USER',
                mode: 'INVALID_MODE',
                content: [{ text: 'Hello' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should accept mode with text content', () => {
            const data = {
                role: 'MODEL',
                mode: 'SEARCH',
                content: [{ text: 'This is a search mode response' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept mode with media content', () => {
            const data = {
                role: 'MODEL',
                mode: 'IMAGE',
                content: [
                    {
                        media: {
                            type: 'image',
                            url: 'https://example.com/generated.png',
                            mimeType: 'image/png',
                        },
                    },
                ],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should preserve mode in parsed output', () => {
            const data = {
                role: 'USER',
                mode: 'SEARCH',
                content: [{ text: 'Search for something' }],
            };
            const result = createMessageSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.mode).toBe('SEARCH');
                expect(result.data.role).toBe('USER');
                expect(result.data.content).toHaveLength(1);
                expect(result.data.content[0].text).toBe('Search for something');
            }
        });
    });

    describe('updateUserRoleSchema', () => {
        it('should validate all role values', () => {
            const roles = ['USER', 'PRO', 'ENTERPRISE', 'ADMIN'];
            for (const role of roles) {
                const result = updateUserRoleSchema.safeParse({ role });
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid role', () => {
            const result = updateUserRoleSchema.safeParse({ role: 'SUPERADMIN' });
            expect(result.success).toBe(false);
        });
    });

    describe('adminUsersQuerySchema', () => {
        it('should apply defaults', () => {
            const data = {};
            const result = adminUsersQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(20);
                expect(result.data.offset).toBe(0);
            }
        });

        it('should coerce string numbers', () => {
            const data = { limit: '50', offset: '10' };
            const result = adminUsersQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(50);
                expect(result.data.offset).toBe(10);
            }
        });

        it('should cap limit at 100', () => {
            const data = { limit: '150' };
            const result = adminUsersQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(100);
            }
        });

        it('should validate status values', () => {
            const statuses = ['ACTIVE', 'INACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'];
            for (const status of statuses) {
                const result = adminUsersQuerySchema.safeParse({ status });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('adminUsageQuerySchema', () => {
        it('should validate date strings', () => {
            const data = {
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-12-31T23:59:59Z',
            };
            const result = adminUsageQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate userId as cuid', () => {
            const data = { userId: 'clp1234567890abcdef' };
            const result = adminUsageQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe('Helper Functions', () => {
        describe('safeParseJson', () => {
            it('should return parsed data for valid input', () => {
                const data = { title: 'Test' };
                const result = safeParseJson(createConversationSchema, data);
                expect(result).toEqual({ title: 'Test' });
            });

            it('should return null for invalid input', () => {
                const data = { title: 'a'.repeat(201) };
                const result = safeParseJson(createConversationSchema, data);
                expect(result).toBeNull();
            });
        });

        describe('parseJson', () => {
            it('should return parsed data for valid input', () => {
                const data = { role: 'ADMIN' };
                const result = parseJson(updateUserRoleSchema, data);
                expect(result).toEqual({ role: 'ADMIN' });
            });

            it('should throw for invalid input', () => {
                const data = { role: 'INVALID' };
                expect(() => parseJson(updateUserRoleSchema, data)).toThrow();
            });
        });
    });
});
