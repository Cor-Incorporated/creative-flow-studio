import { describe, it, expect } from 'vitest';
import {
    getAuthErrorConfig,
    getAuthErrorMessage,
    isEnhancedError,
    formatErrorTimestamp,
    type AuthErrorConfig,
    type AuthErrorAction,
} from '@/lib/auth-errors';

describe('auth-errors', () => {
    describe('getAuthErrorConfig', () => {
        describe('Configuration error', () => {
            it('should return correct config for Configuration error', () => {
                const config = getAuthErrorConfig('Configuration');

                expect(config.message).toBe(
                    'サーバー設定にエラーがあります。管理者にお問い合わせください。'
                );
                expect(config.title).toBe('サーバーエラー');
            });

            it('should have home and support actions', () => {
                const config = getAuthErrorConfig('Configuration');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('home');
                expect(actionTypes).toContain('support');
            });

            it('should have supportInfo field', () => {
                const config = getAuthErrorConfig('Configuration');

                expect(config.supportInfo).toBeDefined();
                expect(config.supportInfo).toContain('support@creative-flow.studio');
            });
        });

        describe('AccessDenied error', () => {
            it('should return correct config for AccessDenied error', () => {
                const config = getAuthErrorConfig('AccessDenied');

                expect(config.message).toBe('アクセスが拒否されました。');
                expect(config.title).toBe('アクセス拒否');
            });

            it('should have signin and home actions', () => {
                const config = getAuthErrorConfig('AccessDenied');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('signin');
                expect(actionTypes).toContain('home');
            });

            it('should not have supportInfo field', () => {
                const config = getAuthErrorConfig('AccessDenied');

                expect(config.supportInfo).toBeUndefined();
            });
        });

        describe('Verification error', () => {
            it('should return correct config for Verification error', () => {
                const config = getAuthErrorConfig('Verification');

                expect(config.message).toBe(
                    '認証トークンの有効期限が切れているか、既に使用されています。'
                );
                expect(config.title).toBe('トークンエラー');
            });

            it('should have single signin action', () => {
                const config = getAuthErrorConfig('Verification');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
                expect(config.actions![0].href).toBe('/auth/signin');
            });
        });

        describe('OAuthSignin error', () => {
            it('should return correct config for OAuthSignin error', () => {
                const config = getAuthErrorConfig('OAuthSignin');

                expect(config.message).toBe(
                    'OAuth認証の開始中にエラーが発生しました。時間をおいて再度お試しください。'
                );
                expect(config.title).toBe('OAuth エラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('OAuthSignin');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('OAuthCallback error', () => {
            it('should return correct config for OAuthCallback error', () => {
                const config = getAuthErrorConfig('OAuthCallback');

                expect(config.message).toBe(
                    'OAuth認証のコールバック処理中にエラーが発生しました。'
                );
                expect(config.title).toBe('OAuth エラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('OAuthCallback');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('OAuthCreateAccount error', () => {
            it('should return correct config for OAuthCreateAccount error', () => {
                const config = getAuthErrorConfig('OAuthCreateAccount');

                expect(config.message).toBe(
                    'OAuthアカウントの作成中にエラーが発生しました。'
                );
                expect(config.title).toBe('アカウント作成エラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('OAuthCreateAccount');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('OAuthAccountNotLinked error (critical)', () => {
            it('should return correct config for OAuthAccountNotLinked error', () => {
                const config = getAuthErrorConfig('OAuthAccountNotLinked');

                expect(config.message).toBe(
                    'このメールアドレスは別の認証方法で登録されています。最初に登録した方法でログインしてください。'
                );
                expect(config.title).toBe('アカウントリンクエラー');
            });

            it('should have google and email actions', () => {
                const config = getAuthErrorConfig('OAuthAccountNotLinked');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('google');
                expect(actionTypes).toContain('email');
            });

            it('should have supportInfo explaining authentication options', () => {
                const config = getAuthErrorConfig('OAuthAccountNotLinked');

                expect(config.supportInfo).toBeDefined();
                expect(config.supportInfo).toContain('Googleで登録した場合');
                expect(config.supportInfo).toContain('メールで登録した場合');
            });

            it('should have correct action hrefs', () => {
                const config = getAuthErrorConfig('OAuthAccountNotLinked');

                const googleAction = config.actions!.find((a) => a.type === 'google');
                const emailAction = config.actions!.find((a) => a.type === 'email');

                expect(googleAction?.href).toBe('/api/auth/signin/google');
                expect(emailAction?.href).toBe('/auth/signin');
            });
        });

        describe('EmailCreateAccount error', () => {
            it('should return correct config for EmailCreateAccount error', () => {
                const config = getAuthErrorConfig('EmailCreateAccount');

                expect(config.message).toBe(
                    'メールアカウントの作成中にエラーが発生しました。'
                );
                expect(config.title).toBe('アカウント作成エラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('EmailCreateAccount');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('EmailSignin error', () => {
            it('should return correct config for EmailSignin error', () => {
                const config = getAuthErrorConfig('EmailSignin');

                expect(config.message).toBe('メール認証の送信に失敗しました。');
                expect(config.title).toBe('メール送信エラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('EmailSignin');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('Callback error', () => {
            it('should return correct config for Callback error', () => {
                const config = getAuthErrorConfig('Callback');

                expect(config.message).toBe(
                    '認証コールバック中にエラーが発生しました。'
                );
                expect(config.title).toBe('コールバックエラー');
            });

            it('should have signin action', () => {
                const config = getAuthErrorConfig('Callback');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
            });
        });

        describe('CredentialsSignin error', () => {
            it('should return correct config for CredentialsSignin error', () => {
                const config = getAuthErrorConfig('CredentialsSignin');

                expect(config.message).toBe(
                    'メールアドレスまたはパスワードが正しくありません。'
                );
                expect(config.title).toBe('ログインエラー');
            });

            it('should have signin action with re-login label', () => {
                const config = getAuthErrorConfig('CredentialsSignin');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
                expect(config.actions![0].label).toBe('再度ログイン');
            });
        });

        describe('EmailNormalizationConflict error (critical)', () => {
            it('should return correct config for EmailNormalizationConflict error', () => {
                const config = getAuthErrorConfig('EmailNormalizationConflict');

                expect(config.message).toBe(
                    'このメールアドレスは既に別ユーザーで使用されています。別の認証方法でログインしている可能性があります。'
                );
                expect(config.title).toBe('メールアドレス競合');
            });

            it('should have support and signin actions', () => {
                const config = getAuthErrorConfig('EmailNormalizationConflict');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('support');
                expect(actionTypes).toContain('signin');
            });

            it('should have supportInfo with contact details', () => {
                const config = getAuthErrorConfig('EmailNormalizationConflict');

                expect(config.supportInfo).toBeDefined();
                expect(config.supportInfo).toContain('support@creative-flow.studio');
                expect(config.supportInfo).toContain('お伝えいただく情報');
            });

            it('should have showTimestamp enabled', () => {
                const config = getAuthErrorConfig('EmailNormalizationConflict');

                expect(config.showTimestamp).toBe(true);
            });

            it('should have mailto link with subject in support action', () => {
                const config = getAuthErrorConfig('EmailNormalizationConflict');

                const supportAction = config.actions!.find((a) => a.type === 'support');
                expect(supportAction?.href).toContain('mailto:');
                expect(supportAction?.href).toContain('subject=');
            });
        });

        describe('SubscriptionInitFailed error (critical)', () => {
            it('should return correct config for SubscriptionInitFailed error', () => {
                const config = getAuthErrorConfig('SubscriptionInitFailed');

                expect(config.message).toBe(
                    '初期設定に失敗しました。時間をおいて再度お試しください。'
                );
                expect(config.title).toBe('初期設定エラー');
            });

            it('should have signin and support actions', () => {
                const config = getAuthErrorConfig('SubscriptionInitFailed');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('signin');
                expect(actionTypes).toContain('support');
            });

            it('should have supportInfo with contact details', () => {
                const config = getAuthErrorConfig('SubscriptionInitFailed');

                expect(config.supportInfo).toBeDefined();
                expect(config.supportInfo).toContain('support@creative-flow.studio');
            });

            it('should have showTimestamp enabled', () => {
                const config = getAuthErrorConfig('SubscriptionInitFailed');

                expect(config.showTimestamp).toBe(true);
            });
        });

        describe('SessionRequired error', () => {
            it('should return correct config for SessionRequired error', () => {
                const config = getAuthErrorConfig('SessionRequired');

                expect(config.message).toBe(
                    'この操作を行うにはログインが必要です。'
                );
                expect(config.title).toBe('セッションが必要');
            });

            it('should have single signin action', () => {
                const config = getAuthErrorConfig('SessionRequired');

                expect(config.actions).toHaveLength(1);
                expect(config.actions![0].type).toBe('signin');
                expect(config.actions![0].label).toBe('ログイン');
            });
        });

        describe('Default error', () => {
            it('should return correct config for Default error', () => {
                const config = getAuthErrorConfig('Default');

                expect(config.message).toBe('認証中にエラーが発生しました。');
                expect(config.title).toBe('認証エラー');
            });

            it('should have signin and home actions', () => {
                const config = getAuthErrorConfig('Default');

                expect(config.actions).toBeDefined();
                expect(config.actions).toHaveLength(2);

                const actionTypes = config.actions!.map((a) => a.type);
                expect(actionTypes).toContain('signin');
                expect(actionTypes).toContain('home');
            });
        });

        describe('unknown error codes', () => {
            it('should return Default config for unknown error code', () => {
                const config = getAuthErrorConfig('UnknownErrorCode');

                expect(config.message).toBe('認証中にエラーが発生しました。');
                expect(config.title).toBe('認証エラー');
            });

            it('should return Default config for empty string', () => {
                const config = getAuthErrorConfig('');

                expect(config.message).toBe('認証中にエラーが発生しました。');
            });

            it('should return Default config for random string', () => {
                const config = getAuthErrorConfig('RandomString123');

                expect(config.message).toBe('認証中にエラーが発生しました。');
            });

            it('should return Default config for case-sensitive mismatch', () => {
                // Error codes are case-sensitive
                const config = getAuthErrorConfig('credentialssignin');

                expect(config.message).toBe('認証中にエラーが発生しました。');
            });
        });
    });

    describe('getAuthErrorMessage', () => {
        it('should return message for known error code', () => {
            const message = getAuthErrorMessage('CredentialsSignin');

            expect(message).toBe(
                'メールアドレスまたはパスワードが正しくありません。'
            );
        });

        it('should return message for OAuthAccountNotLinked', () => {
            const message = getAuthErrorMessage('OAuthAccountNotLinked');

            expect(message).toBe(
                'このメールアドレスは別の認証方法で登録されています。最初に登録した方法でログインしてください。'
            );
        });

        it('should return default message for unknown error code', () => {
            const message = getAuthErrorMessage('UnknownCode');

            expect(message).toBe('認証中にエラーが発生しました。');
        });

        it('should return default message for empty string', () => {
            const message = getAuthErrorMessage('');

            expect(message).toBe('認証中にエラーが発生しました。');
        });

        it('should return only the message string, not the full config', () => {
            const message = getAuthErrorMessage('Configuration');

            expect(typeof message).toBe('string');
            expect(message).not.toContain('title');
            expect(message).not.toContain('actions');
        });

        it('should return message for all defined error codes', () => {
            const errorCodes = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'OAuthAccountNotLinked',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'EmailNormalizationConflict',
                'SubscriptionInitFailed',
                'SessionRequired',
                'Default',
            ];

            errorCodes.forEach((code) => {
                const message = getAuthErrorMessage(code);
                expect(typeof message).toBe('string');
                expect(message.length).toBeGreaterThan(0);
            });
        });
    });

    describe('isEnhancedError', () => {
        it('should return true for OAuthAccountNotLinked', () => {
            expect(isEnhancedError('OAuthAccountNotLinked')).toBe(true);
        });

        it('should return true for EmailNormalizationConflict', () => {
            expect(isEnhancedError('EmailNormalizationConflict')).toBe(true);
        });

        it('should return true for SubscriptionInitFailed', () => {
            expect(isEnhancedError('SubscriptionInitFailed')).toBe(true);
        });

        it('should return false for Configuration', () => {
            expect(isEnhancedError('Configuration')).toBe(false);
        });

        it('should return false for AccessDenied', () => {
            expect(isEnhancedError('AccessDenied')).toBe(false);
        });

        it('should return false for CredentialsSignin', () => {
            expect(isEnhancedError('CredentialsSignin')).toBe(false);
        });

        it('should return false for Default', () => {
            expect(isEnhancedError('Default')).toBe(false);
        });

        it('should return false for unknown error codes', () => {
            expect(isEnhancedError('UnknownCode')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isEnhancedError('')).toBe(false);
        });

        it('should be case-sensitive', () => {
            expect(isEnhancedError('oauthaccountnotlinked')).toBe(false);
            expect(isEnhancedError('OAUTHACCOUNTNOTLINKED')).toBe(false);
        });

        it('should return false for all non-enhanced error codes', () => {
            const nonEnhancedCodes = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'SessionRequired',
                'Default',
            ];

            nonEnhancedCodes.forEach((code) => {
                expect(isEnhancedError(code)).toBe(false);
            });
        });
    });

    describe('formatErrorTimestamp', () => {
        it('should return a string', () => {
            const timestamp = formatErrorTimestamp();

            expect(typeof timestamp).toBe('string');
        });

        it('should return non-empty string', () => {
            const timestamp = formatErrorTimestamp();

            expect(timestamp.length).toBeGreaterThan(0);
        });

        it('should format date with year, month, day, hour, and minute', () => {
            const timestamp = formatErrorTimestamp();

            // The format should contain year, month, day, and time components
            // Format: "YYYY/MM/DD HH:MM"
            expect(timestamp).toMatch(/\d{4}\/\d{2}\/\d{2}/);
            expect(timestamp).toMatch(/\d{2}:\d{2}/);
        });

        it('should not include seconds', () => {
            const timestamp = formatErrorTimestamp();

            // The format should be like "2025/06/15 19:30" not "2025/06/15 19:30:00"
            // Count the colons - should only be one (for hours:minutes)
            const colonCount = (timestamp.match(/:/g) || []).length;
            expect(colonCount).toBe(1);
        });

        it('should use Japanese locale format with slash separators', () => {
            const timestamp = formatErrorTimestamp();

            // Japanese locale typically uses "/" separators for date
            expect(timestamp).toMatch(/\d{4}\/\d{2}\/\d{2}/);
        });

        it('should include current year', () => {
            const timestamp = formatErrorTimestamp();
            const currentYear = new Date().getFullYear().toString();

            expect(timestamp).toContain(currentYear);
        });

        it('should produce consistent format length', () => {
            const timestamp = formatErrorTimestamp();

            // Format: "YYYY/MM/DD HH:MM" should be 16 characters
            expect(timestamp.length).toBe(16);
        });

        it('should have padded month (2 digits)', () => {
            const timestamp = formatErrorTimestamp();

            // Extract month part (position 5-7 in "YYYY/MM/DD HH:MM")
            const monthPart = timestamp.slice(5, 7);
            expect(monthPart).toMatch(/^\d{2}$/);
        });

        it('should have padded day (2 digits)', () => {
            const timestamp = formatErrorTimestamp();

            // Extract day part (position 8-10 in "YYYY/MM/DD HH:MM")
            const dayPart = timestamp.slice(8, 10);
            expect(dayPart).toMatch(/^\d{2}$/);
        });

        it('should have padded hour (2 digits)', () => {
            const timestamp = formatErrorTimestamp();

            // Extract hour part (position 11-13 in "YYYY/MM/DD HH:MM")
            const hourPart = timestamp.slice(11, 13);
            expect(hourPart).toMatch(/^\d{2}$/);
        });

        it('should have padded minute (2 digits)', () => {
            const timestamp = formatErrorTimestamp();

            // Extract minute part (position 14-16 in "YYYY/MM/DD HH:MM")
            const minutePart = timestamp.slice(14, 16);
            expect(minutePart).toMatch(/^\d{2}$/);
        });
    });

    describe('AuthErrorAction interface', () => {
        it('should have correct action types in configs', () => {
            const validTypes: AuthErrorAction['type'][] = [
                'google',
                'email',
                'signin',
                'home',
                'support',
            ];

            const allCodes = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'OAuthAccountNotLinked',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'EmailNormalizationConflict',
                'SubscriptionInitFailed',
                'SessionRequired',
                'Default',
            ];

            allCodes.forEach((code) => {
                const config = getAuthErrorConfig(code);
                if (config.actions) {
                    config.actions.forEach((action) => {
                        expect(validTypes).toContain(action.type);
                    });
                }
            });
        });

        it('should have label and href for all actions', () => {
            const config = getAuthErrorConfig('OAuthAccountNotLinked');

            config.actions!.forEach((action) => {
                expect(action.label).toBeDefined();
                expect(typeof action.label).toBe('string');
                expect(action.label.length).toBeGreaterThan(0);
                expect(action.href).toBeDefined();
                expect(typeof action.href).toBe('string');
            });
        });
    });

    describe('supportInfo field presence', () => {
        it('should have supportInfo for Configuration error', () => {
            const config = getAuthErrorConfig('Configuration');
            expect(config.supportInfo).toBeDefined();
        });

        it('should have supportInfo for OAuthAccountNotLinked error', () => {
            const config = getAuthErrorConfig('OAuthAccountNotLinked');
            expect(config.supportInfo).toBeDefined();
        });

        it('should have supportInfo for EmailNormalizationConflict error', () => {
            const config = getAuthErrorConfig('EmailNormalizationConflict');
            expect(config.supportInfo).toBeDefined();
        });

        it('should have supportInfo for SubscriptionInitFailed error', () => {
            const config = getAuthErrorConfig('SubscriptionInitFailed');
            expect(config.supportInfo).toBeDefined();
        });

        it('should not have supportInfo for non-critical errors', () => {
            const nonCriticalCodes = [
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'SessionRequired',
                'Default',
            ];

            nonCriticalCodes.forEach((code) => {
                const config = getAuthErrorConfig(code);
                expect(config.supportInfo).toBeUndefined();
            });
        });
    });

    describe('showTimestamp field', () => {
        it('should have showTimestamp for EmailNormalizationConflict', () => {
            const config = getAuthErrorConfig('EmailNormalizationConflict');
            expect(config.showTimestamp).toBe(true);
        });

        it('should have showTimestamp for SubscriptionInitFailed', () => {
            const config = getAuthErrorConfig('SubscriptionInitFailed');
            expect(config.showTimestamp).toBe(true);
        });

        it('should not have showTimestamp for other errors', () => {
            const codesWithoutTimestamp = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'OAuthAccountNotLinked',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'SessionRequired',
                'Default',
            ];

            codesWithoutTimestamp.forEach((code) => {
                const config = getAuthErrorConfig(code);
                expect(config.showTimestamp).toBeUndefined();
            });
        });
    });

    describe('error message content', () => {
        it('should have Japanese messages for all error codes', () => {
            const allCodes = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'OAuthAccountNotLinked',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'EmailNormalizationConflict',
                'SubscriptionInitFailed',
                'SessionRequired',
                'Default',
            ];

            allCodes.forEach((code) => {
                const message = getAuthErrorMessage(code);
                // Japanese messages should contain at least some hiragana/katakana/kanji
                expect(message).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
            });
        });

        it('should have Japanese titles for all error codes', () => {
            const allCodes = [
                'Configuration',
                'AccessDenied',
                'Verification',
                'OAuthSignin',
                'OAuthCallback',
                'OAuthCreateAccount',
                'OAuthAccountNotLinked',
                'EmailCreateAccount',
                'EmailSignin',
                'Callback',
                'CredentialsSignin',
                'EmailNormalizationConflict',
                'SubscriptionInitFailed',
                'SessionRequired',
                'Default',
            ];

            allCodes.forEach((code) => {
                const config = getAuthErrorConfig(code);
                if (config.title) {
                    // Japanese titles should contain at least some hiragana/katakana/kanji
                    expect(config.title).toMatch(
                        /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
                    );
                }
            });
        });
    });
});
