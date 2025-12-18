import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'BulnaAI',
    description: 'Multimodal AI application powered by Google Gemini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body className="bg-gray-900 text-gray-100 antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
