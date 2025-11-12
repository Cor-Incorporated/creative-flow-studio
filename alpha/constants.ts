// API Limits and Validation
export const MAX_PROMPT_LENGTH = 30000; // Gemini API prompt length limit
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB file size limit

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

export const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo', // .avi
    'video/mpeg'
];

// DJ Shacho Mode Settings
export const DJ_SHACHO_TEMPERATURE = 0.9;

// Gemini Model Configuration
export const THINKING_BUDGET = 32768; // Thinking budget for Pro mode
export const VIDEO_POLL_INTERVAL_MS = 5000; // 5 seconds
export const MAX_VIDEO_POLL_ATTEMPTS = 120; // 10 minutes (120 * 5s)

// Error Messages
export const ERROR_MESSAGES = {
    API_KEY_NOT_FOUND: 'APIキーが見つからないか、無効です。有効なキーを選択してください。',
    GENERIC_ERROR: 'エラーが発生しました。もう一度お試しください。',
    VIDEO_GENERATION_FAILED: 'ビデオ生成に失敗しました。',
    VIDEO_API_KEY_REQUIRED: 'ビデオ生成にはAPIキーが必要です。',
    IMAGE_GENERATION_FAILED: '画像生成に失敗しました。',
    IMAGE_NO_DATA: '画像生成に失敗しました。画像データが取得できませんでした。',
    IMAGE_UNEXPECTED_FORMAT: '画像生成に失敗しました。画像データの構造が予期されない形式です。',
    IMAGE_NO_IMAGES: '画像生成に失敗しました。生成された画像がありません。プロンプトの内容を確認してください。',
    IMAGE_EDIT_NO_IMAGE: 'No image found in edit response',
    FILE_TOO_LARGE: `ファイルサイズが大きすぎます。${MAX_FILE_SIZE / 1024 / 1024}MB以下のファイルを選択してください。`,
    INVALID_FILE_TYPE: '対応していないファイル形式です。',
    PROMPT_TOO_LONG: `プロンプトが長すぎます。${MAX_PROMPT_LENGTH}文字以内で入力してください。`,
    VIDEO_POLL_TIMEOUT: 'ビデオ生成がタイムアウトしました。もう一度お試しください。'
};

// Aspect Ratios
export const VALID_IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;
export const VALID_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
