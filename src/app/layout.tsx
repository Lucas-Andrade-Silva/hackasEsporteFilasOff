import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

// No iPhone a fonte é a do sistema (SF Pro). Inter cobre Android e desktop.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Atleta10 | Salta. Evolui. Aparece.",
  description: "Treinos de vôlei e basquete medidos pela câmera do celular. Evolua, ganhe moedas e suba no ranking.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Atleta10", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
