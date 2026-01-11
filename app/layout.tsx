import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import Head from 'next/head';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { type PropsWithChildren, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { siteConfig } from '@/config';
import QueryProvider from '@/providers/query-provider';
import { SheetProvider } from '@/providers/sheet-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = siteConfig;

export default function RootLayout({ children }: PropsWithChildren) {
    return (
        <ClerkProvider>
            <html lang="en">
                <Head>
                    <meta name="apple-mobile-web-app-title" content="Numera" />
                    <meta
                        name="apple-mobile-web-app-status-bar-style"
                        content="black-translucent"
                    />
                    <meta name="theme-color" content="#000000" />
                </Head>
                <body className={inter.className}>
                    <QueryProvider>
                        <Suspense>
                            <NuqsAdapter>
                                <SheetProvider />
                                <Toaster />
                                {children}
                            </NuqsAdapter>
                        </Suspense>
                    </QueryProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
