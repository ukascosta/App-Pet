import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatWhatsApp, normalizeWhatsApp, whatsAppLink } from '../server/lib/phone.js';

test('aceita os formatos comuns de celular brasileiro', () => {
  for (const input of ['11999998888', '(11) 99999-8888', '+55 11 99999-8888', '55 (11) 99999 8888', '0055 11 999998888']) {
    assert.equal(normalizeWhatsApp(input), '5511999998888', input);
  }
});

test('recusa números inválidos', () => {
  for (const input of ['', 'abc', '1199998888', '(11) 3333-4444', '99999-8888', '01999998888', '+55 11 3333-4444']) {
    assert.equal(normalizeWhatsApp(input), null, input);
  }
});

test('aceita número internacional com +', () => {
  assert.equal(normalizeWhatsApp('+351 912 345 678'), '351912345678');
  assert.equal(normalizeWhatsApp('351912345678'), null); // sem "+": tratado como Brasil
});

test('formatação e link do wa.me', () => {
  assert.equal(formatWhatsApp('5511999998888'), '(11) 99999-8888');
  assert.equal(whatsAppLink('5511999998888', 'Olá, tudo bem?'), 'https://wa.me/5511999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F');
});
