// Application constants (migrated from alpha/constants.ts)

// API Limits and Validation
export const MAX_PROMPT_LENGTH = 30000; // Gemini API prompt length limit
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB file size limit

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
];

export const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo', // .avi
    'video/mpeg',
];

// DJ Shacho Mode Settings
export const DJ_SHACHO_TEMPERATURE = 0.9;

// Gemini Model Configuration
export const THINKING_BUDGET = 32768; // Thinking budget for Pro mode
export const VIDEO_POLL_INTERVAL_MS = 5000; // 5 seconds
export const MAX_VIDEO_POLL_ATTEMPTS = 120; // 10 minutes (120 * 5s)

// Gemini Model Names (aligned with alpha version)
export const GEMINI_MODELS = {
    FLASH: 'gemini-2.5-flash',
    PRO: 'gemini-2.5-pro',
    FLASH_IMAGE: 'gemini-2.5-flash-image',
    IMAGEN: 'imagen-4.0',
    VEO: 'veo-3.1-fast',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
    API_KEY_NOT_FOUND: 'APIキーが見つからないか、無効です。有効なキーを選択してください。',
    GENERIC_ERROR: 'エラーが発生しました。もう一度お試しください。',
    VIDEO_GENERATION_FAILED: 'ビデオ生成に失敗しました。',
    VIDEO_API_KEY_REQUIRED: 'ビデオ生成にはAPIキーが必要です。',
    IMAGE_GENERATION_FAILED: '画像生成に失敗しました。',
    IMAGE_NO_DATA: '画像生成に失敗しました。画像データが取得できませんでした。',
    IMAGE_UNEXPECTED_FORMAT: '画像生成に失敗しました。画像データの構造が予期されない形式です。',
    IMAGE_NO_IMAGES:
        '画像生成に失敗しました。生成された画像がありません。プロンプトの内容を確認してください。',
    IMAGE_EDIT_NO_IMAGE: 'No image found in edit response',
    FILE_TOO_LARGE: `ファイルサイズが大きすぎます。${MAX_FILE_SIZE / 1024 / 1024}MB以下のファイルを選択してください。`,
    INVALID_FILE_TYPE: '対応していないファイル形式です。',
    PROMPT_TOO_LONG: `プロンプトが長すぎます。${MAX_PROMPT_LENGTH}文字以内で入力してください。`,
    VIDEO_POLL_TIMEOUT: 'ビデオ生成がタイムアウトしました。もう一度お試しください。',
    UNAUTHORIZED: '認証が必要です。ログインしてください。',
    RATE_LIMIT_EXCEEDED: 'リクエスト制限に達しました。しばらく待ってから再度お試しください。',
    INTERNAL_SERVER_ERROR: 'サーバーエラーが発生しました。後でもう一度お試しください。',
};

// Aspect Ratios
export const VALID_IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;
export const VALID_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;

// DJ Shacho Mode Configuration
export const DJ_SHACHO_SYSTEM_PROMPT = `あなたはDJ社長（木本翔介）として振る舞います。

【キャラクター設定】
- Repezen Foxx（レペゼン地球）のリーダー
- 高いエネルギーとポジティブな姿勢
- 九州弁（博多弁）で話す
- 起業家精神とビジネスセンスがある
- ファンやチームメンバーへの熱いメッセージ

【口調の特徴】
- 一人称: 「俺」
- 語尾: 「〜やけん」「〜ばい」「〜たい」
- ポジティブで前向きな表現を多用
- 情熱的で motivational な言い回し
- ビジネス用語を自然に混ぜる

【注意事項】
- 必ず九州弁（博多弁）で答える
- 高いエネルギーを維持
- ネガティブな表現は避け、常にポジティブに変換
- 専門的な内容でも分かりやすく、熱く説明`;

export const DJ_SHACHO_INITIAL_MESSAGE = `おう！DJ社長やけん！💪✨

今日もバリバリ行くばい！何でも聞いてくれや！
俺と一緒に最高の一日にしようぜ！🔥`;
