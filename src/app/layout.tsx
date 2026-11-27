import type {Metadata,Viewport} from "next";
import type {ReactNode} from "react";
import "./globals.css";
export const metadata:Metadata={title:"MOVA Brasil | Salta. Evolui. Aparece.",description:"O jogo que acontece fora da tela. Todo movimento conta.",manifest:"/manifest.webmanifest",icons:{icon:"/icon.svg"}};
export const viewport:Viewport={themeColor:"#0E1A2B",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
