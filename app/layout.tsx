import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Тижневі звіти",
  description: "Аналіз тижневих звітів і продуктивності команди: ML-метрики та висновки Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={geist.variable}>
      <body className="min-h-[100dvh] font-sans antialiased">{children}</body>
    </html>
  );
}
