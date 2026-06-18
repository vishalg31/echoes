import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

// Identity type system (art-led dark, 2026-06-18):
// Bricolage Grotesque = display/wordmark/titles (characterful contemporary
// grotesque, gives Echoes a face). Geist = body + dense UI metadata (Vercel's
// clean geometric grotesque, pairs with Bricolage's character).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-geist",
});

export const metadata = {
  title: "Echoes — Music Discovery",
  description:
    "A music discovery game where your taste shapes everything — the songs, the look, the vibe.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="neutral-dark">
      <body className={`${bricolage.variable} ${geist.variable}`}>
        {children}
        <footer className="siteFooter">
          <p className="siteFooterCredit">Made by Vishal</p>
          <a
            className="siteFooterHome"
            href="https://vishalbuilds.com"
            target="_blank"
            rel="noreferrer"
          >
            vishalbuilds.com ↗
          </a>
        </footer>
      </body>
    </html>
  );
}
