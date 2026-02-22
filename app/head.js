export default function Head() {
  return (
    <>
      <meta name="theme-color" content="#ffffff" />
      <link rel="manifest" href="/manifest.webmanifest" />

      {/* iOS polish (doesn't "install" like Android, but improves look) */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    </>
  );
}