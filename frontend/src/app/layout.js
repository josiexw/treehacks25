import './globals.css'

export const metadata = {
  title: 'Person Detection',
  description: 'Real-time person detection using TensorFlow.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
      </head>
      <body className="w-screen h-screen overflow-hidden m-0 p-0">
        {children}
      </body>
    </html>
  )
}
