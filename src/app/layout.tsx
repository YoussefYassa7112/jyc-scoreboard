import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Providers } from "@/components/Providers";
import { DevServiceWorkerReset } from "@/components/DevServiceWorkerReset";
import "./globals.css";

const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700", "800"],
});

const APP_NAME = "Camp Scoreboard";
const APP_DESCRIPTION =
  "Live camp standings, map, and schedule — works offline after first visit.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#C45C26",
};

const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem('camp-theme');
    var hour = new Date().getHours();
    var night = hour >= 20 || hour < 6;
    var theme = stored === 'light' || stored === 'dark' ? stored : (night ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {process.env.NODE_ENV === "development" ? (
          <DevServiceWorkerReset />
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
