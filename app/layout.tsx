import "./globals.css";
export const metadata = {
  title: "Svara Studio · Think it. Say it. Create it.",
  description: "A multilingual creative workspace powered by CallMissed.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
