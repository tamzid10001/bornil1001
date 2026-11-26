import type { Metadata, Viewport } from 'next'
import { Anek_Bangla, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
})
const anek = Anek_Bangla({
  subsets: ['bengali', 'latin'],
  variable: '--font-anek',
})

export const metadata: Metadata = {
  title: { default: 'বর্ণিল | RMG', template: '%s · বর্ণিল | RMG' },
  description:
    'পোশাক কারখানার অপারেটিং সিস্টেম — ক্রেতার ইমেইল থেকে ব্যাংকে টাকা আসা পর্যন্ত সবকিছু এক সুতায় গাঁথা।',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F4F0' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1B1E' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`bg-background ${plex.variable} ${anek.variable}`}>
      <body className="bg-background font-sans text-foreground">{children}</body>
    </html>
  )
}
