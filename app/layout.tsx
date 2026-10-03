import "./globals.css";
export const metadata = {
  title: "Svara Studio · Think it. Say it. Create it.",
  icons: { icon: "/favicon.svg" },
  description: "Voice-led campaigns, posters and custom business websites.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
