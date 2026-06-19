import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import RhythmWave from "../components/ui/RhythmWave";
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

const SITE_URL = "https://echoes.vishalbuilds.com";
const TITLE = "Echoes | Music Discovery Game";
const DESCRIPTION =
  "Answer a few quick questions and Echoes builds you a world of music to explore. Chase a song's vibe across artists, or dig into an artist's deep cuts and best-known tracks.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Echoes",
  },
  description: DESCRIPTION,
  applicationName: "Echoes",
  keywords: [
    "music discovery",
    "song recommendations",
    "music game",
    "taste match",
    "artist deep dive",
    "find new music",
  ],
  authors: [{ name: "Vishal", url: "https://vishalbuilds.com" }],
  creator: "Vishal",
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Echoes",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101a2e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="neutral-dark">
      <body className={`${bricolage.variable} ${geist.variable}`}>
        <RhythmWave />
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
        <Analytics />
      </body>
    </html>
  );
}
