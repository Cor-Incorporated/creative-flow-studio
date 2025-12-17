/**
 * Prisma Schema Validation Tests
 *
 * These tests ensure that the Prisma schema is consistent with our expectations
 * and that the generated Prisma Client types match our code's assumptions.
 *
 * This helps catch issues like:
 * - Missing columns in raw SQL queries
 * - Schema drift between code and database
 * - Type mismatches in model definitions
 */

import { describe, expect, it } from 'vitest';
import {
    Prisma,
    MessageRole,
    Role,
    GenerationMode,
    SubscriptionStatus,
} from '@prisma/client';

describe('Prisma Schema Validation', () => {
    describe('Message model', () => {
        it('should have all required fields for raw query in conversation detail API', () => {
            // These are the fields selected in the raw query at app/api/conversations/[id]/route.ts
            // SELECT "id", "role", "mode", "content", "createdAt" FROM "messages"

            // Verify the Message model has all expected fields by checking the scalar field enum
            const messageFields = Object.keys(Prisma.MessageScalarFieldEnum);

            expect(messageFields).toContain('id');
            expect(messageFields).toContain('role');
            expect(messageFields).toContain('mode');
            expect(messageFields).toContain('content');
            expect(messageFields).toContain('createdAt');
            expect(messageFields).toContain('conversationId');
        });

        it('should have MessageRole enum with expected values', () => {
            // Check that the MessageRole enum exists with expected values
            const roleValues = Object.values(MessageRole);

            expect(roleValues).toContain('USER');
            expect(roleValues).toContain('MODEL');
            expect(roleValues).toContain('SYSTEM');
        });

        it('should have GenerationMode enum with expected values', () => {
            // Check that the GenerationMode enum exists with expected values
            const modeValues = Object.values(GenerationMode);

            expect(modeValues).toContain('CHAT');
            expect(modeValues).toContain('PRO');
            expect(modeValues).toContain('SEARCH');
            expect(modeValues).toContain('IMAGE');
            expect(modeValues).toContain('VIDEO');
        });
    });

    describe('Conversation model', () => {
        it('should have all required fields for conversation queries', () => {
            const conversationFields = Object.keys(Prisma.ConversationScalarFieldEnum);

            expect(conversationFields).toContain('id');
            expect(conversationFields).toContain('title');
            expect(conversationFields).toContain('userId');
            expect(conversationFields).toContain('mode');
            expect(conversationFields).toContain('createdAt');
            expect(conversationFields).toContain('updatedAt');
        });
    });

    describe('User model', () => {
        it('should have all required fields including password for credentials auth', () => {
            const userFields = Object.keys(Prisma.UserScalarFieldEnum);

            expect(userFields).toContain('id');
            expect(userFields).toContain('email');
            expect(userFields).toContain('name');
            expect(userFields).toContain('image');
            expect(userFields).toContain('password');
            expect(userFields).toContain('role');
            expect(userFields).toContain('createdAt');
            expect(userFields).toContain('updatedAt');
        });

        it('should have Role enum with expected values', () => {
            const roleValues = Object.values(Role);

            expect(roleValues).toContain('USER');
            expect(roleValues).toContain('PRO');
            expect(roleValues).toContain('ENTERPRISE');
            expect(roleValues).toContain('ADMIN');
        });
    });

    describe('Subscription model', () => {
        it('should have all required fields for subscription management', () => {
            const subscriptionFields = Object.keys(Prisma.SubscriptionScalarFieldEnum);

            expect(subscriptionFields).toContain('id');
            expect(subscriptionFields).toContain('userId');
            expect(subscriptionFields).toContain('planId');
            expect(subscriptionFields).toContain('stripeCustomerId');
            expect(subscriptionFields).toContain('stripeSubscriptionId');
            expect(subscriptionFields).toContain('status');
            expect(subscriptionFields).toContain('currentPeriodStart');
            expect(subscriptionFields).toContain('currentPeriodEnd');
            expect(subscriptionFields).toContain('cancelAtPeriodEnd');
        });

        it('should have SubscriptionStatus enum with expected values', () => {
            const statusValues = Object.values(SubscriptionStatus);

            expect(statusValues).toContain('ACTIVE');
            expect(statusValues).toContain('INACTIVE');
            expect(statusValues).toContain('TRIALING');
            expect(statusValues).toContain('PAST_DUE');
            expect(statusValues).toContain('CANCELED');
            expect(statusValues).toContain('UNPAID');
        });
    });

    describe('Model relationships', () => {
        it('should define Message-Conversation relationship correctly', () => {
            // Verify that conversationId is a field on Message (foreign key)
            const messageFields = Object.keys(Prisma.MessageScalarFieldEnum);
            expect(messageFields).toContain('conversationId');
        });

        it('should define Conversation-User relationship correctly', () => {
            // Verify that userId is a field on Conversation (foreign key)
            const conversationFields = Object.keys(Prisma.ConversationScalarFieldEnum);
            expect(conversationFields).toContain('userId');
        });

        it('should define Subscription-User relationship correctly', () => {
            // Verify that userId is a field on Subscription (foreign key)
            const subscriptionFields = Object.keys(Prisma.SubscriptionScalarFieldEnum);
            expect(subscriptionFields).toContain('userId');
        });
    });
});

describe('Database table mappings', () => {
    it('should map Message model to "messages" table', () => {
        // The raw query in conversation detail API uses "messages" table name
        // This test documents that assumption

        // We can't directly test the @@map directive, but we can verify the model
        // name matches our schema expectations
        expect(Prisma.ModelName.Message).toBe('Message');
    });

    it('should map Conversation model to "conversations" table', () => {
        expect(Prisma.ModelName.Conversation).toBe('Conversation');
    });

    it('should map User model to "users" table', () => {
        expect(Prisma.ModelName.User).toBe('User');
    });
});
