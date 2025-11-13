import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'Creative Flow Studio',
    description: 'Multimodal AI application powered by Google Gemini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
