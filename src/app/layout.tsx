import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a1a",
};

export const metadata: Metadata = {
  title: "GlobeLens — Real-Time World Intelligence on a 3D Globe",
  description:
    "Interactive 3D globe displaying real-time world news, live weather, public webcams, and traffic data from around the world.",
  keywords: ["globe", "world news", "weather", "webcams", "traffic", "3D", "cesium", "real-time"],
  openGraph: {
    title: "GlobeLens",
    description: "Real-time world intelligence on a spinning 3D globe.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <Script src="/cesium/Cesium.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased bg-[#0a0a1a] text-white min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
