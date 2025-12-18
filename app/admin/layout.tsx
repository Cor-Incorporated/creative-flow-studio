import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Admin Layout
 *
 * Shared layout for all /admin pages.
 * Protected by middleware.ts (ADMIN role required).
 *
 * References:
 * - docs/implementation-plan.md Phase 6
 */

export const metadata: Metadata = {
    title: 'Admin Dashboard - BulnaAI',
    description: 'Administration and monitoring dashboard',
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Admin Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo & Title */}
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/"
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← Back to App
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900">
                                Admin Dashboard
                            </h1>
                        </div>

                        {/* Navigation */}
                        <nav className="flex space-x-4">
                            <Link
                                href="/admin"
                                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                            >
                                Overview
                            </Link>
                            <Link
                                href="/admin/users"
                                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                            >
                                Users
                            </Link>
                            <Link
                                href="/admin/usage"
                                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                            >
                                Usage
                            </Link>
                            <Link
                                href="/admin/waitlist"
                                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                            >
                                Waitlist
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <p className="text-sm text-gray-500 text-center">
                        BulnaAI Admin Panel - ADMIN ACCESS ONLY
                    </p>
                </div>
            </footer>
        </div>
    );
}
