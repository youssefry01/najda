import type { Metadata } from "next";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import "./globals.css";
import Providers from "./providers";
import ProfileGate from "@/components/Auth/ProfileGate";

export const metadata: Metadata = {
  title: {
    default: "NAJDA",
    template: "%s | NAJDA",
  },

  description:
    "NAJDA (Network for AI-powered Joint Dispatch & Assistance) is an AI-powered emergency dispatch simulation platform that coordinates citizens, dispatchers, emergency responders, hospitals, and administrators through real-time communication and intelligent decision support.",

  keywords: [
    "NAJDA",
    "Network for AI-powered Joint Dispatch & Assistance",
    "emergency dispatch",
    "AI",
    "emergency response",
    "incident management",
    "microservices",
    "RabbitMQ",
    "Spring Boot",
    "Next.js",
    "real-time tracking",
    "hospital management",
    "dispatcher dashboard",
    "graduation project",
  ],

  authors: [
    {
      name: "NAJDA Team",
    },
  ],

  creator: "NAJDA Team",

  metadataBase: new URL("https://najda.vercel.app"),

  openGraph: {
    title: "NAJDA",
    description:
      "AI-powered emergency dispatch simulation platform with real-time coordination and intelligent decision support.",
    url: "https://najda.vercel.app",
    siteName: "NAJDA",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NAJDA",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "NAJDA",
    description:
      "AI-powered emergency dispatch simulation platform with real-time coordination.",
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="antialiased scroll-smooth"
      suppressHydrationWarning
    >
      <body>
      <Providers>
          <div className="flex flex-col min-h-screen">
            <Header />
              <main className="flex-1">
                <ProfileGate>{children}</ProfileGate>
              </main>
            <Footer />
          </div>
      </Providers>
      </body>
    </html>
  );
}
