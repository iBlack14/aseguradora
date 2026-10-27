import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, sessionRole } from '@/lib/session';
import Registry from './registry';

export default async function RegistryPage() {
  const role = await sessionRole((await cookies()).get(SESSION_COOKIE)?.value);
  if (!role) redirect('/login');
  return <Registry canWrite={['ADMIN', 'OPERATIONS', 'SALES'].includes(role)} />;
}
