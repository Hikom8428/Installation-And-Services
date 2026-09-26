import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Uploaded photos/videos/bills are user-supplied content served as static
        // files — nosniff stops a browser from executing mislabeled content
        // (e.g. HTML) even though we already force safe extensions on upload.
        source: "/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
