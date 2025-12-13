/**
 * Authentication Error Configuration Utility
 *
 * Centralizes NextAuth error code mapping to user-friendly Japanese messages
 * with optional CTA actions and support information.
 */

export type AuthErrorActionType = 'google' | 'email' | 'signin' | 'home' | 'support';

export interface AuthErrorAction {
    type: AuthErrorActionType;
    label: string;
    href?: string;
}

export interface AuthErrorConfig {
    message: string;
    title?: string;
    actions?: AuthErrorAction[];
    supportInfo?: string;
    showTimestamp?: boolean;
}

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@creative-flow.studio';

/**
 * NextAuth error code to configuration mapping
 */
const AUTH_ERROR_CONFIGS: Record<string, AuthErrorConfig> = {
    // Server/Configuration Errors
    Configuration: {
        message: 'サーバー設定にエラーがあります。管理者にお問い合わせください。',
        title: 'サーバーエラー',
        actions: [
            { type: 'home', label: 'ホームに戻る', href: '/' },
            { type: 'support', label: 'サポートに連絡', href: `mailto:${SUPPORT_EMAIL}` },
        ],
        supportInfo: `サポートへの連絡先: ${SUPPORT_EMAIL}`,
    },

    // Access Control Errors
    AccessDenied: {
        message: 'アクセスが拒否されました。',
        title: 'アクセス拒否',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
            { type: 'home', label: 'ホームに戻る', href: '/' },
        ],
    },

    // Token/Verification Errors
    Verification: {
        message: '認証トークンの有効期限が切れているか、既に使用されています。',
        title: 'トークンエラー',
        actions: [
            { type: 'signin', label: '再度ログイン', href: '/auth/signin' },
        ],
    },

    // OAuth Errors
    OAuthSignin: {
        message: 'OAuth認証の開始中にエラーが発生しました。時間をおいて再度お試しください。',
        title: 'OAuth エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    OAuthCallback: {
        message: 'OAuth認証のコールバック処理中にエラーが発生しました。',
        title: 'OAuth エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    OAuthCreateAccount: {
        message: 'OAuthアカウントの作成中にエラーが発生しました。',
        title: 'アカウント作成エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    // CRITICAL: Account linking error - needs enhanced guidance
    OAuthAccountNotLinked: {
        message:
            'このメールアドレスは別の認証方法で登録されています。最初に登録した方法でログインしてください。',
        title: 'アカウントリンクエラー',
        actions: [
            { type: 'google', label: 'Googleでログイン', href: '/api/auth/signin/google' },
            { type: 'email', label: 'メール/パスワードでログイン', href: '/auth/signin' },
        ],
        supportInfo:
            'Googleで登録した場合は「Googleでログイン」を、メールで登録した場合は「メール/パスワードでログイン」を選択してください。',
    },

    // Email Errors
    EmailCreateAccount: {
        message: 'メールアカウントの作成中にエラーが発生しました。',
        title: 'アカウント作成エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    EmailSignin: {
        message: 'メール認証の送信に失敗しました。',
        title: 'メール送信エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    // Callback Error
    Callback: {
        message: '認証コールバック中にエラーが発生しました。',
        title: 'コールバックエラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
    },

    // Credentials Errors
    CredentialsSignin: {
        message: 'メールアドレスまたはパスワードが正しくありません。',
        title: 'ログインエラー',
        actions: [
            { type: 'signin', label: '再度ログイン', href: '/auth/signin' },
        ],
    },

    // CRITICAL: Email normalization conflict - needs support guidance
    EmailNormalizationConflict: {
        message:
            'このメールアドレスは既に別ユーザーで使用されています。別の認証方法でログインしている可能性があります。',
        title: 'メールアドレス競合',
        actions: [
            { type: 'support', label: 'サポートに連絡', href: `mailto:${SUPPORT_EMAIL}?subject=メールアドレス競合について` },
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
        ],
        supportInfo: `サポートにお問い合わせください。\n連絡先: ${SUPPORT_EMAIL}\n\n【お伝えいただく情報】\n・ご利用のメールアドレス\n・登録に使用した認証方法（Google/メール）\n・エラー発生日時`,
        showTimestamp: true,
    },

    // CRITICAL: Subscription initialization failed - needs support guidance
    SubscriptionInitFailed: {
        message: '初期設定に失敗しました。時間をおいて再度お試しください。',
        title: '初期設定エラー',
        actions: [
            { type: 'signin', label: '再度ログイン', href: '/auth/signin' },
            { type: 'support', label: 'サポートに連絡', href: `mailto:${SUPPORT_EMAIL}?subject=初期設定エラーについて` },
        ],
        supportInfo: `改善しない場合はサポートにお問い合わせください。\n連絡先: ${SUPPORT_EMAIL}\n\n【お伝えいただく情報】\n・ご利用のメールアドレス\n・エラー発生日時`,
        showTimestamp: true,
    },

    // Session Errors
    SessionRequired: {
        message: 'この操作を行うにはログインが必要です。',
        title: 'セッションが必要',
        actions: [
            { type: 'signin', label: 'ログイン', href: '/auth/signin' },
        ],
    },

    // Default fallback
    Default: {
        message: '認証中にエラーが発生しました。',
        title: '認証エラー',
        actions: [
            { type: 'signin', label: 'ログインページに戻る', href: '/auth/signin' },
            { type: 'home', label: 'ホームに戻る', href: '/' },
        ],
    },
};

/**
 * Get error configuration for a given NextAuth error code
 *
 * @param code - NextAuth error code (e.g., 'OAuthAccountNotLinked', 'CredentialsSignin')
 * @returns AuthErrorConfig with message, actions, and optional support info
 */
export function getAuthErrorConfig(code: string): AuthErrorConfig {
    return AUTH_ERROR_CONFIGS[code] || AUTH_ERROR_CONFIGS.Default;
}

/**
 * Get just the error message for a given code (for inline display)
 *
 * @param code - NextAuth error code
 * @returns Japanese error message string
 */
export function getAuthErrorMessage(code: string): string {
    const config = getAuthErrorConfig(code);
    return config.message;
}

/**
 * Check if an error code requires special handling (support info, multiple CTAs)
 *
 * @param code - NextAuth error code
 * @returns true if the error needs enhanced UI treatment
 */
export function isEnhancedError(code: string): boolean {
    return ['OAuthAccountNotLinked', 'EmailNormalizationConflict', 'SubscriptionInitFailed'].includes(
        code
    );
}

/**
 * Format timestamp for support info display
 *
 * @returns Formatted current timestamp in JST
 */
export function formatErrorTimestamp(): string {
    return new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
