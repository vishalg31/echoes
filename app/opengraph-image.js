import { ImageResponse } from "next/og";

// Social preview card (1200x630) shown when echoes.vishalbuilds.com is shared on
// LinkedIn, WhatsApp, Slack, X, etc. Generated at build time, no asset file.
export const alt = "Echoes — a music discovery game shaped by your taste.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "linear-gradient(135deg, #15101f 0%, #1c1530 52%, #2a1145 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: "26px",
            letterSpacing: "8px",
            color: "#e25aa6",
            fontWeight: 600,
          }}
        >
          <div style={{ width: "16px", height: "16px", borderRadius: "9999px", background: "#e25aa6" }} />
          MUSIC DISCOVERY GAME
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "150px",
            fontWeight: 800,
            letterSpacing: "-6px",
            marginTop: "18px",
            color: "#ef7fc6",
          }}
        >
          Echoes
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "46px",
            color: "#c3b2d0",
            marginTop: "10px",
            maxWidth: "920px",
          }}
        >
          A world of music to explore, shaped entirely by your taste.
        </div>
        <div style={{ display: "flex", fontSize: "28px", color: "#8d7e9c", marginTop: "60px" }}>
          Taste Match · Artist Deep Dive · echoes.vishalbuilds.com
        </div>
      </div>
    ),
    { ...size }
  );
}
