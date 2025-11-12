import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Creative Flow Studio',
    description: 'Multimodal AI application powered by Google Gemini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body>{children}</body>
        </html>
    );
}
