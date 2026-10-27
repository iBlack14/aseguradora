import {NextRequest,NextResponse} from 'next/server';import {SESSION_COOKIE} from '@/lib/session';import {publicUrl} from '@/lib/publicUrl';
export async function POST(request:NextRequest){const response=NextResponse.redirect(publicUrl(request,'/login'),303);response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,path:'/',maxAge:0});return response}
