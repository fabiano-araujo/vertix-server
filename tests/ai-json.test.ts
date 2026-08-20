import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAiJsonObject } from '../src/services/ai-json.service';

test('parses valid JSON unchanged', () => {
  const parsed = parseAiJsonObject('{"scene":{"shots":[{"number":1}]}}');
  assert.equal((parsed.scene as { shots: Array<{ number: number }> }).shots[0].number, 1);
});

test('repairs missing commas between array objects', () => {
  const parsed = parseAiJsonObject(`{
    "shots": [
      {"number": 1, "title": "Chegada"}
      {"number": 2, "title": "Morro"}
    ]
  }`);
  const shots = (parsed.shots as Array<{ number: number; title: string }>);
  assert.equal(shots.length, 2);
  assert.equal(shots[1].title, 'Morro');
});

test('escapes unescaped quotes inside dialogue strings', () => {
  const parsed = parseAiJsonObject(
    '{"rows":[{"type":"dialogue","text":"Ele gritou "Sai daqui!" e correu"}]}',
  );
  const rows = parsed.rows as Array<{ text: string }>;
  assert.equal(rows[0].text, 'Ele gritou "Sai daqui!" e correu');
});

test('closes truncated nested arrays and objects', () => {
  const parsed = parseAiJsonObject(
    '{"scene":{"shots":[{"number":1,"rows":[{"text":"oi"}]},{"number":2,"rows":[{"text":"x"',
  );
  const scene = parsed.scene as { shots: Array<{ number: number; rows: Array<{ text: string }> }> };
  assert.equal(scene.shots.length, 2);
  assert.equal(scene.shots[1].rows[0].text, 'x');
});

test('strips markdown fences and trailing commas', () => {
  const parsed = parseAiJsonObject('```json\n{"scene":{"title":"Chegada","shots":[1,],},}\n```');
  const scene = parsed.scene as { title: string };
  assert.equal(scene.title, 'Chegada');
});
