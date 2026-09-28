import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShopVoice — ช้อปปิ้งออนไลน์ด้วยคำสั่งเสียง",
  description:
    "ผู้ช่วยช้อปปิ้งออนไลน์ที่ควบคุมด้วยเสียงภาษาไทย พูดชื่อสินค้าเพื่อค้นหา เพิ่มลงตะกร้า และสั่งซื้อ",
  keywords: ["voice commerce", "web speech api", "next.js", "thai", "e-commerce"],
  applicationName: "ShopVoice",
  openGraph: {
    title: "ShopVoice — ช้อปปิ้งออนไลน์ด้วยคำสั่งเสียง",
    description: "พูดชื่อสินค้า ระบบจะหาสินค้าและเพิ่มลงตะกร้าให้อัตโนมัติ",
    locale: "th_TH",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${inter.variable} ${notoThai.variable}`}>
      <body>{children}</body>
    </html>
  );
}
