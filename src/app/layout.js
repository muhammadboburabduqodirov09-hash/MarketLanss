import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata = {
  title: "Marketplace Intelligence",
  description: "Local-first marketplace report importer and analysis tools.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
