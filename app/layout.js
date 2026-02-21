import "./globals.css";

export const metadata = {
  title: "iSpeak MVP",
  description: "Interpreter practice + glossary",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
