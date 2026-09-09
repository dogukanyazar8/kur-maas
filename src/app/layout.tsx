import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kur Maaş — Maaşına netlik kat",
  description:
    "TCMB USD döviz alış kurlarıyla maaşını ve üç aylık kur farkını hesapla. Kur düşüşlerine karşı korunmuş, şeffaf bir hesap.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
