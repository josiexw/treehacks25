import './globals.css'

export const metadata = {
  title: 'Person Detection',
  description: 'Real-time person detection using TensorFlow.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full w-full m-0 p-0">
      <body className="h-full w-full m-0 p-0">{children}</body>
    </html>
  )
}
