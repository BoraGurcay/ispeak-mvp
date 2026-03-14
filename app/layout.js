import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import { Analytics } from "@vercel/analytics/react";

const ASSET_VERSION = "v6";

export const metadata = {
  title: "iSpeak",
  description: "Interpreter terminology training platform",
  verification: {
    google: "57ja8ird5Vl5xuIrQnvMLAF8w5qTX7ouy1JJO_iVNa0",
  },
  manifest: `/manifest.webmanifest?${ASSET_VERSION}`,
  icons: {
    icon: [
      { url: `/favicon.ico?${ASSET_VERSION}` },
      { url: `/favicon.png?${ASSET_VERSION}`, type: "image/png" },
    ],
    apple: [{ url: `/apple-touch-icon.png?${ASSET_VERSION}` }],
  },
};

export const viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister version={ASSET_VERSION} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}