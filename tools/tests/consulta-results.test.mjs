import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function setup() {
  const elements = new Map();
  const element = () => ({ hidden: true, children: [], value: '', textContent: '', addEventListener() {}, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; } });
  const document = { querySelector(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
  const context = vm.createContext({ document, Intl, Date, URLSearchParams });
  const html = readFileSync(new URL('../../apps/consulta/public/consulta-interna.html', import.meta.url), 'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return { elements, render(data) { context.data = data; vm.runInContext('renderResult(data)', context); } };
}
const active = { found: true, plate: 'ABC123', insurer: 'Test', policyNumber: '001', status: 'VIGENTE', startsAt: '2026-01-01', expiresAt: '2027-01-01' };
const cancelled = { ...active, policyNumber: '002', status: 'ANULADO', cancelledAt: '2026-10-01' };
test('Shows annulled certificates and cancellation date beside an active certificate', () => {
  const view = setup(); view.render({ ...active, history: [active, cancelled] });
  assert.equal(view.elements.get('#cancelled-section').hidden, false);
  assert.equal(view.elements.get('#cancelled-notice').hidden, true);
  assert.equal(view.elements.get('#history').children.length, 2);
  const row = view.elements.get('#cancelled-history').children[0];
  assert.equal(row.children[1].textContent, '002');
  assert.equal(row.children[4].textContent, '1/10/2026');
  assert.equal(row.children[5].children[0].textContent, 'Anulado');
});
test('An annulled main certificate displays its notice and active-only results hide the section', () => {
  const view = setup(); view.render(cancelled);
  assert.equal(view.elements.get('#cancelled-notice').hidden, false);
  assert.equal(view.elements.get('#cancelled-section').hidden, false);
  view.render(active);
  assert.equal(view.elements.get('#cancelled-notice').hidden, true);
  assert.equal(view.elements.get('#cancelled-section').hidden, true);
});
