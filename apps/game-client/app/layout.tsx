import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Era Uma Vez",
  description: "Jogo de cartas colaborativo de contos de fadas",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col bg-[#1a0e05] text-[#f5ebdc]">{children}</body>
    </html>
  );
}
