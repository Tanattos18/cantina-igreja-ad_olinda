import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { urlDoSite } from "@/lib/config";
import "./globals.css";

// Uma fonte só, reta e forte como a dos cartazes e da logo da AD Olinda.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

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
    <html lang="pt-BR" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
