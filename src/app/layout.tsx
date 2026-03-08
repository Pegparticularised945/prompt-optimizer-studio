import type { Metadata } from 'next'
import { Bodoni_Moda, Space_Grotesk } from 'next/font/google'
import '@/styles/globals.css'

const display = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
})

const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Prompt Optimizer Studio',
  description: 'Batch-run isolated prompt optimization rounds with independent judges.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  )
}
