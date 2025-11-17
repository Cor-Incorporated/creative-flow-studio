'use client';

import React, { useEffect, useState } from 'react';

export interface ToastProps {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    onClose?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export default function Toast({ message, type = 'info', duration = 5000, onClose, action }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => onClose?.(), 300); // Wait for fade-out animation
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
    };

    const bgColors = {
        info: 'bg-blue-600',
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        error: 'bg-red-600',
    };

    const icons = {
        info: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
        success: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
        warning: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
            </svg>
        ),
        error: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
    };

    if (!isVisible) return null;

    return (
        <div
            className={`fixed bottom-4 right-4 z-50 min-w-[320px] max-w-md ${bgColors[type]} text-white rounded-lg shadow-2xl transform transition-all duration-300 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
        >
            <div className="flex items-start gap-3 p-4">
                <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">{message}</p>
                    {action && (
                        <button
                            onClick={() => {
                                action.onClick();
                                handleClose();
                            }}
                            className="mt-2 text-xs font-semibold underline hover:no-underline transition-all"
                        >
                            {action.label}
                        </button>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="flex-shrink-0 ml-2 text-white/80 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// Toast Manager for multiple toasts
export function useToast() {
    const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

    const showToast = (props: ToastProps) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { ...props, id }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const ToastContainer = () => (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    style={{ transform: `translateY(-${index * 80}px)` }}
                    className="transition-transform duration-300"
                >
                    <Toast {...toast} onClose={() => removeToast(toast.id)} />
                </div>
            ))}
        </div>
    );

    return { showToast, ToastContainer };
}
