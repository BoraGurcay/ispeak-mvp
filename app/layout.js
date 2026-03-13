import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import { Analytics } from "@vercel/analytics/react";

const ASSET_VERSION = "v5"; // bump this anytime you change icons/manifest

export const metadata = {
  title: "iSpeak",
  description: "Professional interpreter training platform",

  // Google Search Console verification
  verification: {
    google: "57ja8ird5Vl5xuIrQnvMLAF8w5qTX7ouy1JJO_iVNa0",
  },

  manifest: `/manifest.webmanifest?${ASSET_VERSION}`,
  themeColor: "#ffffff",

  icons: {
    icon: [
      { url: `/favicon.ico?${ASSET_VERSION}` },
      { url: `/favicon.png?${ASSET_VERSION}`, type: "image/png" },
    ],
    apple: [{ url: `/apple-touch-icon.png?${ASSET_VERSION}` }],
  },
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