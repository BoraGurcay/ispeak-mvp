import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

const ASSET_VERSION = "v5"; // bump this anytime you change icons/manifest

export const metadata = {
  title: "iSpeak",
  description: "Interpreter practice + personal glossary",
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
      </body>
    </html>
  );
}