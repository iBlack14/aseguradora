import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptcha, verifyCaptcha } from '../../apps/consulta/lib/captcha';
function answer(svg: string) { return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map(match => match[1]).join(''); }
test('Captcha accepts the displayed code once, ignoring case', () => {
  const challenge = createCaptcha()!;
  assert.equal(answer(challenge.svg).length, 5);
  assert.equal(verifyCaptcha(challenge.id, answer(challenge.svg).toLowerCase()), true);
  assert.equal(verifyCaptcha(challenge.id, answer(challenge.svg)), false);
});
test('Captcha rejects missing, incorrect and reused challenges', () => {
  assert.equal(verifyCaptcha(undefined, 'ABCDE'), false);
  const challenge = createCaptcha()!;
  assert.equal(verifyCaptcha(challenge.id, 'wrong'), false);
  assert.equal(verifyCaptcha(challenge.id, answer(challenge.svg)), false);
});
test('Refreshing invalidates the previous captcha and expired codes fail', () => {
  const first = createCaptcha()!;
  const next = createCaptcha(first.id)!;
  assert.equal(verifyCaptcha(first.id, answer(first.svg)), false);
  assert.equal(verifyCaptcha(next.id, answer(next.svg)), true);
  const expired = createCaptcha()!;
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 301000;
    assert.equal(verifyCaptcha(expired.id, answer(expired.svg)), false);
  } finally { Date.now = originalNow; }
});
