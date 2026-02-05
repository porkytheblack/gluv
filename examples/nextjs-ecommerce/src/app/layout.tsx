import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gluv E-commerce Demo',
  description: 'An example e-commerce application built with Gluv Framework',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
