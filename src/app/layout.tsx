import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { urlDoSite } from "@/lib/config";
import "./globals.css";

// Fraunces: títulos com serifa, elegantes. Nunito Sans: leitura fácil no celular.
const titulos = Fraunces({ variable: "--font-titulos", subsets: ["latin"], weight: ["600", "700"] });
const texto = Nunito_Sans({ variable: "--font-texto", subsets: ["latin"] });

export const metadata: Metadata = {
  // Endereço completo nas prévias de link (WhatsApp precisa da URL absoluta da imagem).
  metadataBase: new URL(urlDoSite()),
  title: "Cantina",
  description: "Faça seu pedido na cantina da igreja",
  icons: { icon: "/logo", apple: "/logo" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cantina" },
};

export const viewport: Viewport = {
  themeColor: "#0f2747",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulos.variable} ${texto.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
