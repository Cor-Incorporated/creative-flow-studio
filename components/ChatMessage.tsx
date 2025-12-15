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
    const [isHovered, setIsHovered] = useState(false);
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

    return (
        <div
            className="relative group max-w-md"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <img src={media.url} alt="Generated content" className="rounded-lg shadow-lg" />
            {isHovered && !isEditing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full"
                    >
                        <PencilIcon /> 編集
                    </button>
                    <button
                        onClick={() => handleDownload(media.url, `creative-flow-${Date.now()}.png`)}
                        className="ml-2 flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full"
                    >
                        <DownloadIcon /> ダウンロード
                    </button>
                </div>
            )}
            {isEditing && (
                <form
                    onSubmit={handleEditSubmit}
                    className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-70"
                >
                    <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        placeholder="編集内容を記述してください..."
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                    />
                </form>
            )}
        </div>
    );
};

const VideoContent: React.FC<{ part: ContentPart }> = ({ part }) => {
    if (!part.media) return null;
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

    return (
        <div className={`flex ${alignment} mb-4`}>
            <div className={`flex ${flexDirection} items-end gap-3 max-w-2xl`}>
                <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex-shrink-0">
                    {avatar}
                </div>
                <div className={`px-4 py-3 rounded-2xl ${bgColor} flex flex-col gap-3`}>
                    {message.parts.map((part, index) => (
                        <div key={index}>
                            {part.isLoading && (
                                <div className="flex items-center gap-2 text-gray-400">
                                    {part.status ? (
                                        <>
                                            <LoadingSpinner />
                                            <span>{part.status}</span>
                                        </>
                                    ) : (
                                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                                    )}
                                </div>
                            )}
                            {part.isError && <p className="text-red-400">{part.text}</p>}
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
