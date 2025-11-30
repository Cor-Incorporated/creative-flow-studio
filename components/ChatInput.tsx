'use client';

import React, { useState, useRef, useCallback } from 'react';
import { GenerationMode, AspectRatio, Media } from '@/types/app';
import { SendIcon, AttachmentIcon, SparklesIcon } from './icons';
import { fileToBase64 } from '@/lib/fileUtils';
import {
    MAX_FILE_SIZE,
    MAX_PROMPT_LENGTH,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ERROR_MESSAGES,
} from '@/lib/constants';

interface ChatInputProps {
    onSendMessage: (prompt: string, uploadedMedia?: Media) => void;
    isLoading: boolean;
    mode: GenerationMode;
    setMode: (mode: GenerationMode) => void;
    aspectRatio: AspectRatio;
    setAspectRatio: (ratio: AspectRatio) => void;
    isDjShachoMode: boolean;
    setIsDjShachoMode: (isDjShachoMode: boolean) => void;
}

const ModeButton: React.FC<{
    currentMode: GenerationMode;
    buttonMode: GenerationMode;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ currentMode, buttonMode, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            currentMode === buttonMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
        {children}
    </button>
);

const AspectRatioButton: React.FC<{
    currentRatio: AspectRatio;
    buttonRatio: AspectRatio;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ currentRatio, buttonRatio, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
            currentRatio === buttonRatio
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
        {children}
    </button>
);

const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    isLoading,
    mode,
    setMode,
    aspectRatio,
    setAspectRatio,
    isDjShachoMode,
    setIsDjShachoMode,
}) => {
    const [prompt, setPrompt] = useState('');
    const [uploadedMedia, setUploadedMedia] = useState<Media | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                setValidationError(ERROR_MESSAGES.FILE_TOO_LARGE);
                return;
            }

            // Validate MIME type
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

            // Clear any previous validation errors
            setValidationError(null);

            const url = await fileToBase64(file);
            const type = isVideo ? 'video' : 'image';
            setUploadedMedia({ url, mimeType: file.type, type });
            if (type === 'video') setMode('video');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate prompt length
        if (prompt.length > MAX_PROMPT_LENGTH) {
            setValidationError(ERROR_MESSAGES.PROMPT_TOO_LONG);
            return;
        }

        if ((prompt.trim() || uploadedMedia) && !isLoading) {
            setValidationError(null);
            onSendMessage(prompt.trim(), uploadedMedia || undefined);
            setPrompt('');
            setUploadedMedia(null);
        }
    };

    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    // Validate file size
                    if (file.size > MAX_FILE_SIZE) {
                        setValidationError(ERROR_MESSAGES.FILE_TOO_LARGE);
                        return;
                    }

                    // Validate MIME type
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

    return (
        <div className="p-4 bg-gray-900 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-400 mr-2">モード:</span>
                <ModeButton currentMode={mode} buttonMode="chat" onClick={() => setMode('chat')}>
                    チャット
                </ModeButton>
                <ModeButton currentMode={mode} buttonMode="pro" onClick={() => setMode('pro')}>
                    プロ
                </ModeButton>
                <ModeButton
                    currentMode={mode}
                    buttonMode="search"
                    onClick={() => setMode('search')}
                >
                    検索
                </ModeButton>
                <ModeButton currentMode={mode} buttonMode="image" onClick={() => setMode('image')}>
                    画像
                </ModeButton>
                <ModeButton currentMode={mode} buttonMode="video" onClick={() => setMode('video')}>
                    動画
                </ModeButton>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-400 mr-2">DJ社長モード:</span>
                <button
                    onClick={() => setIsDjShachoMode(!isDjShachoMode)}
                    aria-label="DJ社長モード切り替え"
                    aria-pressed={isDjShachoMode}
                    role="switch"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isDjShachoMode ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isDjShachoMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
                <span className={`text-sm ${isDjShachoMode ? 'text-blue-400' : 'text-gray-400'}`}>
                    {isDjShachoMode ? 'ON' : 'OFF'}
                </span>
            </div>
            {validationError && (
                <div className="mb-2 p-2 bg-red-900/50 border border-red-500 rounded-md text-red-200 text-sm">
                    {validationError}
                </div>
            )}
            {(mode === 'image' || mode === 'video') && (
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-400 mr-2">アスペクト比:</span>
                    <AspectRatioButton
                        currentRatio={aspectRatio}
                        buttonRatio="1:1"
                        onClick={() => setAspectRatio('1:1')}
                    >
                        1:1
                    </AspectRatioButton>
                    <AspectRatioButton
                        currentRatio={aspectRatio}
                        buttonRatio="16:9"
                        onClick={() => setAspectRatio('16:9')}
                    >
                        16:9
                    </AspectRatioButton>
                    <AspectRatioButton
                        currentRatio={aspectRatio}
                        buttonRatio="9:16"
                        onClick={() => setAspectRatio('9:16')}
                    >
                        9:16
                    </AspectRatioButton>
                    <AspectRatioButton
                        currentRatio={aspectRatio}
                        buttonRatio="4:3"
                        onClick={() => setAspectRatio('4:3')}
                    >
                        4:3
                    </AspectRatioButton>
                    <AspectRatioButton
                        currentRatio={aspectRatio}
                        buttonRatio="3:4"
                        onClick={() => setAspectRatio('3:4')}
                    >
                        3:4
                    </AspectRatioButton>
                </div>
            )}
            <div className="bg-gray-800 rounded-xl p-2 flex flex-col">
                {uploadedMedia && (
                    <div className="relative p-2">
                        <img
                            src={uploadedMedia.url}
                            alt="upload preview"
                            className="max-h-24 rounded-md"
                        />
                        <button
                            onClick={() => setUploadedMedia(null)}
                            className="absolute top-0 right-0 m-1 bg-gray-900 rounded-full p-1 text-white"
                        >
                            &times;
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-center w-full">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-white"
                    >
                        <AttachmentIcon />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={e => handleFileChange(e.target.files)}
                        className="hidden"
                        accept="image/*,video/*"
                    />
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onPaste={handlePaste as any}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && e.shiftKey) handleSubmit(e);
                        }}
                        placeholder="何でも質問したり、画像や動画の説明を入力してください... (Shift+Enterで送信)"
                        className="flex-grow bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || (!prompt.trim() && !uploadedMedia)}
                        className="p-2 text-white bg-blue-600 rounded-full disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        ) : (
                            <SendIcon />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatInput;
