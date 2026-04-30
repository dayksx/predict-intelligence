import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AppHeader } from "@/components/AppHeader";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Web3Provider } from "@/components/Web3Provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Predictive Intelligence",
  description:
    "Define your thesis, choose an agent for prediction markets, crypto, and more—then perceive, reason, and act with agentic ENS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script id="pi-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('pi-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`}
        </Script>
        <ThemeProvider>
          <Web3Provider>
            <AppHeader />
            {children}
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
