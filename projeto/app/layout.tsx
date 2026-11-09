import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./responsive.css";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { auth } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CXA - Clube de Xadrez Araranguá",
  description: "Sistema de inscrições e de gestão de torneios do Clube de Xadrez Araranguá."
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const session = await auth()

  return (
    <html lang="pt-br">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >

        <Header user={session ? true : false} admin={session?.user.admin ? session?.user.admin : false} />

        <article>
          {children}
        </article>

        <Footer user={session ? true : false} admin={session?.user.admin ? session?.user.admin : false}/>
      </body>
    </html>
  );
}
