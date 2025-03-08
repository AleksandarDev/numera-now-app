import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/query-provider";
import { SheetProvider } from "@/providers/sheet-provider";
import { Toaster } from "@/components/ui/sonner";
import { PropsWithChildren, Suspense } from "react";
import Head from "next/head";
import { Metadata } from "next";
import { siteConfig } from "@/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = siteConfig;

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <ClerkProvider>
      <html lang="en">
        <Head>
          <meta name="apple-mobile-web-app-title" content="Numera" />
        </Head>
        <body className={inter.className}>
          <QueryProvider>
            <Suspense>
              <SheetProvider />
            </Suspense>
            <Toaster />
            {children}
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
};
