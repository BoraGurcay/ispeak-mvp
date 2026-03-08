import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import { Analytics } from "@vercel/analytics/react";

const ASSET_VERSION = "v5"; // bump this anytime you change icons/manifest

export const metadata = {
  title: "iSpeak",
  description: "Professional interpreter training platform",
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