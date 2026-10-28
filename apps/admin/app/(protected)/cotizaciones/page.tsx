import { cookies } from 'next/headers';
import { SESSION_COOKIE, sessionRole } from '@/lib/session';
import Quotes from './Quotes';

export default async function QuotesPage() {
  const role = await sessionRole((await cookies()).get(SESSION_COOKIE)?.value);
  return <Quotes isAdmin={role === 'ADMIN'} canSell={['ADMIN', 'OPERATIONS', 'SALES'].includes(role || '')} />;
}
