'use client';

import { getInfluencerConfig, InfluencerId } from '@/lib/constants';
import { ContentPart, GroundingSource, Media, Message } from '@/types/app';
import Image from 'next/image';
import React, { useState } from 'react';
import { DownloadIcon, LoadingSpinner, PencilIcon } from './icons';

interface ChatMessageProps {
    message: Message;
    onEditImage: (prompt: string, image: Media) => void;
    selectedInfluencer?: InfluencerId;
}

const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const ImageContent: React.FC<{
    part: ContentPart;
    onEditImage: (prompt: string, image: Media) => void;
}> = ({ part, onEditImage }) => {
    // Unified control visibility state (supports both hover and tap)
    const [showControls, setShowControls] = useState(false);
    const [isEditing, setIsEditing] = useState(part.isEditing || false);
    const [editText, setEditText] = useState('');

    if (!part.media) return null;
    const media = part.isEditing ? part.originalMedia! : part.media;

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editText.trim() && media) {
            onEditImage(editText, media);
            setIsEditing(false);
            setEditText('');
        }
    };

    // Handle image click for mobile tap-to-toggle controls
    const handleImageClick = () => {
        // Toggle controls on touch devices
        if ('ontouchstart' in window) {
            setShowControls(!showControls);
        }
    };

    return (
        <div
            className="relative group max-w-md"
            onClick={handleImageClick}
            onMouseEnter={() => !('ontouchstart' in window) && setShowControls(true)}
            onMouseLeave={() => !('ontouchstart' in window) && setShowControls(false)}
            role="figure"
            aria-label="生成された画像"
        >
            <img src={media.url} alt="Generated content" className="rounded-lg shadow-lg" />
            {showControls && !isEditing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-bold py-2 px-4 rounded-full min-h-[44px]"
                        aria-label="画像を編集"
                    >
                        <PencilIcon /> 編集
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(media.url, `creative-flow-${Date.now()}.png`); }}
                        className="ml-2 flex items-center gap-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-bold py-2 px-4 rounded-full min-h-[44px]"
                        aria-label="画像をダウンロード"
                    >
                        <DownloadIcon /> ダウンロード
                    </button>
                </div>
            )}
            {isEditing && (
                <form
                    onSubmit={handleEditSubmit}
                    className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-70"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        placeholder="編集内容を記述してください..."
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                        aria-label="画像編集の指示を入力"
                    />
                </form>
            )}
        </div>
    );
};

const VideoContent: React.FC<{ part: ContentPart }> = ({ part }) => {
    if (!part.media) return null;

    // Handle legacy Blob URLs that are no longer valid
    const isUnavailable = part.media.unavailable === true;

    if (isUnavailable) {
        return (
            <div className="max-w-md bg-gray-800 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center gap-3 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div>
                        <p className="font-medium">この動画は利用できません</p>
                        <p className="text-sm text-gray-500">セッションが切れたため、動画を再生できません</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md">
            <video controls src={part.media.url} className="rounded-lg shadow-lg">
                お使いのブラウザはビデオタグをサポートしていません。
            </video>
            <button
                onClick={() => handleDownload(part.media!.url, `creative-flow-${Date.now()}.mp4`)}
                className="mt-2 flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full"
            >
                <DownloadIcon /> 動画をダウンロード
            </button>
        </div>
    );
};

const TextContent: React.FC<{ part: ContentPart }> = ({ part }) => {
    if (!part.text) return null;

    // Parse markdown-style bold (**text**) safely without dangerouslySetInnerHTML
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(part.text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(part.text.substring(lastIndex, match.index));
        }
        // Add bold text
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < part.text.length) {
        parts.push(part.text.substring(lastIndex));
    }

    return <p className="whitespace-pre-wrap">{parts.length > 0 ? parts : part.text}</p>;
};

const SourceList: React.FC<{ sources: GroundingSource[] }> = ({ sources }) => (
    <div className="mt-2 border-t border-gray-700 pt-2">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">ソース:</h4>
        <ul className="list-none pl-0 space-y-1">
            {sources.map((source, index) => (
                <li key={index}>
                    <a
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-sm truncate"
                    >
                        {source.title || source.uri}
                    </a>
                </li>
            ))}
        </ul>
    </div>
);

const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    onEditImage,
    selectedInfluencer = 'none',
}) => {
    const isUser = message.role === 'user';
    const bgColor = isUser ? 'bg-gray-800' : 'bg-gray-700/50';
    const alignment = isUser ? 'justify-end' : 'justify-start';
    const flexDirection = isUser ? 'flex-row-reverse' : 'flex-row';

    // Get influencer-specific avatar
    const getInfluencerAvatar = () => {
        if (selectedInfluencer === 'dj_shacho') {
            return (
                <Image
                    src="/DJ_Shacho_400x400.jpg"
                    alt="DJ社長"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                />
            );
        }
        // Default AI avatar for other influencers or none
        const influencer = getInfluencerConfig(selectedInfluencer);
        return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-xs font-semibold">
                {influencer ? influencer.name.substring(0, 2) : 'AI'}
            </div>
        );
    };

    const avatar = isUser ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-semibold">
            YOU
        </div>
    ) : (
        getInfluencerAvatar()
    );

    // Check if any part is loading
    const isAnyPartLoading = message.parts.some(part => part.isLoading);

    return (
        <div
            className={`flex ${alignment} mb-4`}
            role="article"
            aria-label={`${isUser ? 'ユーザー' : 'AI'}のメッセージ`}
        >
            <div className={`flex ${flexDirection} items-end gap-3 max-w-2xl`}>
                <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex-shrink-0">
                    {avatar}
                </div>
                <div
                    className={`px-4 py-3 rounded-2xl ${bgColor} flex flex-col gap-3`}
                    aria-live={!isUser ? 'polite' : 'off'}
                    aria-busy={isAnyPartLoading}
                >
                    {message.parts.map((part, index) => (
                        <div key={index}>
                            {part.isLoading && (
                                <div className="flex items-center gap-2 text-gray-400" role="status" aria-live="polite">
                                    {part.status ? (
                                        <>
                                            <LoadingSpinner />
                                            <span>{part.status}</span>
                                        </>
                                    ) : (
                                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" aria-label="読み込み中"></span>
                                    )}
                                </div>
                            )}
                            {part.isError && <p className="text-red-400" role="alert">{part.text}</p>}
                            {part.media?.type === 'image' && (
                                <ImageContent part={part} onEditImage={onEditImage} />
                            )}
                            {part.media?.type === 'video' && <VideoContent part={part} />}
                            {part.text && <TextContent part={part} />}
                            {part.sources && part.sources.length > 0 && (
                                <SourceList sources={part.sources} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;
