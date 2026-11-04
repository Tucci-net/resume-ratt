import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Ratt",
  description: "Build and print a polished resume.",
  icons: {
    icon: [{ url: "/resume-ratt-mark.svg", type: "image/svg+xml" }],
    shortcut: ["/resume-ratt-mark.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}