import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
const lifetime = 5 * 60 * 1000;
const shared = globalThis as typeof globalThis & { soatCaptchas?: Map<string, { answer: string; expires: number }> };
const challenges = shared.soatCaptchas ||= new Map();
export const captchaCookie = 'soat-captcha';
export function createCaptcha(previous?: string) {
  const now = Date.now();
  for (const [id, value] of challenges) if (value.expires <= now) challenges.delete(id);
  if (previous) challenges.delete(previous);
  if (challenges.size >= 2000) return null;
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const answer = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
  const id = randomBytes(24).toString('hex');
  challenges.set(id, { answer, expires: now + lifetime });
  const lines = Array.from({ length: 7 }, () => `<path d="M${randomInt(240)} ${randomInt(70)} L${randomInt(240)} ${randomInt(70)}" stroke="#8ea5b5" opacity=".5"/>`).join('');
  const colors = ['#68358f', '#00a784', '#932c9c', '#3f2389', '#168979'];
  const letters = [...answer].map((letter, index) => `<text x="${20 + index * 43}" y="${44 + randomInt(10)}" transform="rotate(${randomInt(-15, 16)} ${20 + index * 43} 38)" font-size="52" font-weight="bold" font-family="monospace" fill="${colors[index % colors.length]}">${letter}</text>`).join('');
  return { id, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70" viewBox="0 0 240 70"><rect width="240" height="70" rx="6" fill="#eeeeee"/>${lines}${letters}</svg>` };
}
export function verifyCaptcha(id: string | undefined, answer: unknown) {
  if (!id) return false;
  const challenge = challenges.get(id);
  challenges.delete(id); // Every attempt consumes the challenge, including incorrect answers.
  if (!challenge || challenge.expires <= Date.now() || typeof answer !== 'string') return false;
  const actual = Buffer.from(answer.trim().toUpperCase());
  const expected = Buffer.from(challenge.answer);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
