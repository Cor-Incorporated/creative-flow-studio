'use client';

import {
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ERROR_MESSAGES,
    INFLUENCERS,
    InfluencerId,
    MAX_FILE_SIZE,
    MAX_PROMPT_LENGTH,
} from '@/lib/constants';
import { fileToBase64 } from '@/lib/fileUtils';
import { AspectRatio, GenerationMode, Media } from '@/types/app';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BoltIcon,
    ChatBubbleIcon,
    MagnifyingGlassIcon,
    PhotoIcon,
    PlusIcon,
    SendIcon,
    UserIcon,
    VideoCameraIcon,
    XMarkIcon,
} from './icons';

interface ChatInputProps {
    onSendMessage: (prompt: string, uploadedMedia?: Media) => void;
    isLoading: boolean;
    mode: GenerationMode;
    setMode: (mode: GenerationMode) => void;
    aspectRatio: AspectRatio;
    setAspectRatio: (ratio: AspectRatio) => void;
    selectedInfluencer: InfluencerId;
    setSelectedInfluencer: (influencer: InfluencerId) => void;
    // Retry functionality
    lastFailedPrompt?: string | null;
    lastFailedMedia?: Media | null;
    onRetry?: () => void;
    onClearRetry?: () => void;
}

const MODE_CONFIG = {
    chat: { label: 'チャット', icon: ChatBubbleIcon, color: 'bg-blue-600' },
    pro: { label: 'プロ', icon: BoltIcon, color: 'bg-purple-600' },
    search: { label: '検索', icon: MagnifyingGlassIcon, color: 'bg-green-600' },
    image: { label: '画像', icon: PhotoIcon, color: 'bg-orange-600' },
    video: { label: '動画', icon: VideoCameraIcon, color: 'bg-pink-600' },
};

const ASPECT_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    isLoading,
    mode,
    setMode,
    aspectRatio,
    setAspectRatio,
    selectedInfluencer,
    setSelectedInfluencer,
    lastFailedPrompt,
    lastFailedMedia,
    onRetry,
    onClearRetry,
}) => {
    const [prompt, setPrompt] = useState('');
    const [uploadedMedia, setUploadedMedia] = useState<Media | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // IME変換中かどうかを追跡するためのref
    const isComposingRef = useRef<boolean>(false);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileChange = async (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];

            if (file.size > MAX_FILE_SIZE) {
                setValidationError(ERROR_MESSAGES.FILE_TOO_LARGE);
                return;
            }

            const isImage = file.type.startsWith('image');
            const isVideo = file.type.startsWith('video');

            if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
                setValidationError(ERROR_MESSAGES.INVALID_FILE_TYPE);
                return;
            }

            if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
                setValidationError(ERROR_MESSAGES.INVALID_FILE_TYPE);
                return;
            }

            if (!isImage && !isVideo) {
                setValidationError(ERROR_MESSAGES.INVALID_FILE_TYPE);
                return;
            }

            setValidationError(null);
            const url = await fileToBase64(file);
            const type = isVideo ? 'video' : 'image';
            setUploadedMedia({ url, mimeType: file.type, type });
            if (type === 'video') setMode('video');
            setIsMenuOpen(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (prompt.length > MAX_PROMPT_LENGTH) {
            setValidationError(ERROR_MESSAGES.PROMPT_TOO_LONG);
            return;
        }

        if ((prompt.trim() || uploadedMedia) && !isLoading) {
            setValidationError(null);
            onSendMessage(prompt.trim(), uploadedMedia || undefined);
            setPrompt('');
            setUploadedMedia(null);
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    if (file.size > MAX_FILE_SIZE) {
                        setValidationError(ERROR_MESSAGES.FILE_TOO_LARGE);
                        return;
                    }
                    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                        setValidationError(ERROR_MESSAGES.INVALID_FILE_TYPE);
                        return;
                    }
                    setValidationError(null);
                    const url = await fileToBase64(file);
                    setUploadedMedia({ url, mimeType: file.type, type: 'image' });
                }
                break;
            }
        }
    }, []);

    const handleModeSelect = (newMode: GenerationMode) => {
        setMode(newMode);
        setIsMenuOpen(false);
    };

    const CurrentModeIcon = MODE_CONFIG[mode].icon;

    return (
        <div className="sticky bottom-0 z-50 bg-gray-900 border-t border-gray-700 safe-area-bottom">
            {/* Retry Banner */}
            {lastFailedPrompt && onRetry && onClearRetry && (
                <div className="mx-4 mt-2 p-3 bg-amber-900/50 border border-amber-600 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-amber-200 text-sm font-medium">前回のメッセージの送信に失敗しました</p>
                        <p className="text-amber-300/70 text-xs mt-0.5 truncate">
                            「{lastFailedPrompt.slice(0, 50)}{lastFailedPrompt.length > 50 ? '...' : ''}」
                            {lastFailedMedia && ' + 添付ファイル'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={onRetry}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            再試行
                        </button>
                        <button
                            onClick={onClearRetry}
                            className="p-1.5 text-amber-300 hover:text-white hover:bg-amber-800/50 rounded-lg transition-colors"
                            aria-label="クリア"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Validation Error */}
            {validationError && (
                <div className="mx-4 mt-2 p-2 bg-red-900/50 border border-red-500 rounded-md text-red-200 text-sm">
                    {validationError}
                </div>
            )}

            {/* Uploaded Media Preview */}
            {uploadedMedia && (
                <div className="mx-4 mt-2 relative inline-block">
                    <img
                        src={uploadedMedia.url}
                        alt="upload preview"
                        className="max-h-20 rounded-lg border border-gray-700"
                    />
                    <button
                        onClick={() => setUploadedMedia(null)}
                        className="absolute -top-2 -right-2 bg-gray-800 hover:bg-gray-700 rounded-full p-1 text-white border border-gray-600"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Input Area */}
            <div className="p-3 md:p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-lg">
                        <form onSubmit={handleSubmit} className="flex items-end gap-2 p-2">
                            {/* Plus Button with Popup Menu */}
                            <div className="relative" ref={menuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                                        isMenuOpen
                                            ? 'bg-gray-600 text-white rotate-45'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                    }`}
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>

                                {/* Popup Menu */}
                                {isMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden z-50">
                                        {/* Mode Selection */}
                                        <div className="p-2 border-b border-gray-700">
                                            <p className="text-xs text-gray-400 px-2 mb-2">モード選択</p>
                                            <div className="grid grid-cols-5 gap-1">
                                                {(Object.keys(MODE_CONFIG) as GenerationMode[]).map((m) => {
                                                    const config = MODE_CONFIG[m];
                                                    const Icon = config.icon;
                                                    return (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => handleModeSelect(m)}
                                                            className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                                                                mode === m
                                                                    ? `${config.color} text-white`
                                                                    : 'hover:bg-gray-700 text-gray-300'
                                                            }`}
                                                        >
                                                            <Icon className="w-5 h-5" />
                                                            <span className="text-[10px]">{config.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Aspect Ratio (for image/video mode) */}
                                        {(mode === 'image' || mode === 'video') && (
                                            <div className="p-2 border-b border-gray-700">
                                                <p className="text-xs text-gray-400 px-2 mb-2">アスペクト比</p>
                                                <div className="flex gap-1 px-1">
                                                    {ASPECT_RATIOS.map((ratio) => (
                                                        <button
                                                            key={ratio}
                                                            type="button"
                                                            onClick={() => setAspectRatio(ratio)}
                                                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                                                aspectRatio === ratio
                                                                    ? 'bg-indigo-600 text-white'
                                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                            }`}
                                                        >
                                                            {ratio}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Influencer Mode */}
                                        <div className="p-2 border-b border-gray-700">
                                            <p className="text-xs text-gray-400 px-2 mb-2">インフルエンサーモード</p>
                                            <div className="px-1 space-y-1">
                                                {/* OFF Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedInfluencer('none')}
                                                    className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                                                        selectedInfluencer === 'none'
                                                            ? 'bg-gray-600 text-white'
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    OFF
                                                </button>
                                                {/* Influencer Buttons */}
                                                {Object.values(INFLUENCERS).map((influencer) => (
                                                    <button
                                                        key={influencer.id}
                                                        type="button"
                                                        onClick={() => !influencer.comingSoon && setSelectedInfluencer(influencer.id)}
                                                        disabled={influencer.comingSoon}
                                                        className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors flex items-center justify-between ${
                                                            influencer.comingSoon
                                                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                                : selectedInfluencer === influencer.id
                                                                    ? 'bg-amber-600 text-white'
                                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        <span>{influencer.name}</span>
                                                        {influencer.comingSoon && (
                                                            <span className="text-xs text-gray-500 italic">Coming soon...</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* File Upload */}
                                        <div className="p-2">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors"
                                            >
                                                <PhotoIcon className="w-5 h-5" />
                                                <span className="text-sm">画像・動画をアップロード</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => handleFileChange(e.target.files)}
                                className="hidden"
                                accept="image/*,video/*"
                            />

                            {/* Current Mode Indicator */}
                            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${MODE_CONFIG[mode].color} text-white text-xs font-medium flex-shrink-0`}>
                                <CurrentModeIcon className="w-3.5 h-3.5" />
                                <span>{MODE_CONFIG[mode].label}</span>
                            </div>

                            {/* Influencer Indicator */}
                            {selectedInfluencer !== 'none' && (
                                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium flex-shrink-0">
                                    <UserIcon className="w-3.5 h-3.5" />
                                    <span>{INFLUENCERS[selectedInfluencer]?.name}</span>
                                </div>
                            )}

                            {/* Text Input */}
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={(e) => {
                                    setPrompt(e.target.value);
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                                }}
                                onPaste={handlePaste}
                                onCompositionStart={() => {
                                    isComposingRef.current = true;
                                }}
                                onCompositionEnd={() => {
                                    isComposingRef.current = false;
                                }}
                                onKeyDown={(e) => {
                                    // Cmd+Enter (Mac) / Ctrl+Enter (Windows) で送信
                                    // IME変換中は無視する（日本語などの入力で変換確定前に送信されるのを防ぐ）
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isComposingRef.current) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="メッセージを入力..."
                                className="flex-grow bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[150px] py-2.5 px-1 text-base leading-relaxed"
                                rows={1}
                                disabled={isLoading}
                                style={{ fontSize: '16px' }}
                            />

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={isLoading || (!prompt.trim() && !uploadedMedia)}
                                className="p-2.5 text-white bg-blue-600 rounded-xl disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex-shrink-0"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <SendIcon />
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Mobile Mode Indicator */}
                    <div className="flex sm:hidden items-center justify-center gap-2 mt-2 text-xs text-gray-400">
                        <span className={`flex items-center gap-1 px-2 py-1 rounded ${MODE_CONFIG[mode].color} text-white`}>
                            <CurrentModeIcon className="w-3 h-3" />
                            {MODE_CONFIG[mode].label}
                        </span>
                        {selectedInfluencer !== 'none' && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white">
                                <UserIcon className="w-3 h-3" />
                                {INFLUENCERS[selectedInfluencer]?.name}
                            </span>
                        )}
                        <span className="text-gray-500">
                            {typeof window !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
                                ? '⌘+Enter'
                                : 'Ctrl+Enter'}
                            で送信
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInput;
