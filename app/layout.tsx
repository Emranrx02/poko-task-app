import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Poko — Make Your Day Count",
  description: "A little space for your daily plans. Add tasks, choose a start time, and celebrate every finish.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Poko", statusBarStyle: "default" },
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
