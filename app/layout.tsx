import type { Metadata } from 'next'
import './globals.css'
import { Inter, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'BrainForge AI',
  description: 'AI-powered review platform — study less, master more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, poppins.variable)}>
      <body>
        {/* Apply the saved theme before first paint to avoid a light-mode flash */}
        <script dangerouslySetInnerHTML={{ __html:
          "try{if(localStorage.getItem('bf-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
        }} />
        {children}
      </body>
    </html>
  )
}