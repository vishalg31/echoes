/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // iTunes artwork + Wikipedia thumbnails are loaded directly
    remotePatterns: [
      { protocol: "https", hostname: "**.mzstatic.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

module.exports = nextConfig;
