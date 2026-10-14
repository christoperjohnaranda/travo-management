import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travo Fleet | Logistics Management",
  description: "Dashboard pengelolaan armada dan dokumen kendaraan Travo Logistics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
