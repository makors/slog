import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const siteUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const description =
  "Developer-focused changelogs for teams that want to ship clear release notes from real git history.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "slog",
  title: {
    default: "slog",
    template: "%s | slog",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "slog",
    description,
    url: "/",
    siteName: "slog",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "slog",
    description,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
