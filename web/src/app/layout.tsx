import type { Metadata } from "next";
import { Geist_Mono, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLM Wiki",
  description: "A personal wiki for text sources and curated markdown knowledge pages.",
  metadataBase: new URL("https://llmwiki.app"),
  openGraph: {
    title: "LLM Wiki",
    description: "A personal wiki for text sources and curated markdown knowledge pages.",
    url: "https://llmwiki.app",
    siteName: "LLM Wiki",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LLM Wiki" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Wiki",
    description: "A personal wiki for text sources and curated markdown knowledge pages.",
    images: ["/og.png"],
  },
};

const themeScript = `
  (function() {
    try {
      var storageKey = 'theme';
      var stored = localStorage.getItem(storageKey);
      var isValid = stored === 'light' || stored === 'dark';
      var theme = isValid ? stored : 'light';

      if (!isValid) {
        localStorage.setItem(storageKey, theme);
      }

      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${sourceSans.variable} ${sourceSerif.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          storageKey="theme"
        >
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
