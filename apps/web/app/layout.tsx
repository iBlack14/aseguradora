import type {Metadata} from 'next';import './globals.css';import {Header} from '@/components/Header';import {Footer} from '@/components/Footer';
export const metadata:Metadata={title:'SOAT Digital | Seguros Falabella Perú',description:'Cotiza y compara opciones de SOAT digital.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body><Header/>{children}<Footer/></body></html>}
