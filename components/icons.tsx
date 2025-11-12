import React from 'react';

export const SendIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
    >
        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
);

export const AttachmentIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3.375 3.375 0 1 1 18.374 7.5l-1.493 1.493m-1.543-5.223L6.343 14.123a3 3 0 0 0 4.242 4.242l6.364-6.364"
        />
    </svg>
);

export const SparklesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={className}
    >
        <path
            fillRule="evenodd"
            d="M10 2c.22 0 .43.02.64.05l.32.05a1.73 1.73 0 0 0 1.5 1.5l.05.32c.03.21.05.42.05.64s-.02.43-.05.64l-.05.32a1.73 1.73 0 0 0-1.5 1.5l-.32.05c-.21.03-.42.05-.64.05s-.43-.02-.64-.05l-.32-.05a1.73 1.73 0 0 0-1.5-1.5l-.05-.32A21.5 21.5 0 0 1 8 5c0-.22.02-.43.05-.64l.05-.32a1.73 1.73 0 0 0 1.5-1.5l.32-.05A21.5 21.5 0 0 1 10 2ZM6.03 7.03a.75.75 0 0 0-1.06-1.06l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47Zm1.06-2.12a.75.75 0 0 0-1.06 1.06l1.47 1.47a.75.75 0 1 0 1.06-1.06l-1.47-1.47Zm5.94 0a.75.75 0 0 0-1.06-1.06l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47Zm1.06 2.12a.75.75 0 0 0-1.06 1.06l1.47 1.47a.75.75 0 1 0 1.06-1.06l-1.47-1.47ZM4 10a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 4 10Zm12 0a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 16 10Zm-4.57 3.03a.75.75 0 0 0-1.06-1.06l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47Zm1.06-2.12a.75.75 0 0 0-1.06 1.06l1.47 1.47a.75.75 0 1 0 1.06-1.06l-1.47-1.47Z"
            clipRule="evenodd"
        />
    </svg>
);

export const PencilIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4"
    >
        <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
);

export const DownloadIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-5 h-5"
    >
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
);

export const LoadingSpinner = () => (
    <svg
        className="animate-spin h-5 w-5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
    >
        <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
        ></circle>
        <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
    </svg>
);
