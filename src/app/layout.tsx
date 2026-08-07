import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blues Backroads Events",
  description: "Submit and browse Blues Backroads events.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
