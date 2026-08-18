import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REFERENCE_IMAGE_PROMPT_CONTRACT,
  compileReferenceImagePrompt,
} from '../src/services/reference-image-prompt.service';

test('adult character uses the complete hybrid reference contract by default', () => {
  const result = compileReferenceImagePrompt({
    label: 'Isabela Costa',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 30 anos, cabelos castanhos longos e olhos verdes.',
    metadata: {
      outfit_lock: 'terno preto sóbrio e sapatos baixos',
    },
  });

  assert.equal(result.promptContract, REFERENCE_IMAGE_PROMPT_CONTRACT);
  assert.equal(result.visualReferenceMode, 'hybrid_face_compat');
  assert.match(result.prompt, /LEFT 70% — THREE FULL-BODY TURNAROUND VIEWS/);
  assert.match(result.prompt, /RIGHT 30% — LARGE BROKEN PHOTOGRAPHIC PORTRAIT/);
  assert.match(result.prompt, /EXACTLY\s+SIX/);
  assert.match(result.prompt, /pure white #FFFFFF/i);
  assert.match(result.prompt, /terno preto sóbrio/);
  assert.match(result.prompt, /Isabela Costa/);
});

test('explicit child character uses the standard photoreal reference mode', () => {
  const result = compileReferenceImagePrompt({
    label: 'Lucas Mendes',
    category: 'CHARACTER_MASTER',
    description: 'Criança de 5 anos com roupas infantis coloridas.',
  });

  assert.equal(result.visualReferenceMode, 'standard_ultra_photoreal');
  assert.match(result.prompt, /original fictional child character/i);
  assert.match(result.prompt, /strictly age-appropriate/i);
  assert.doesNotMatch(result.prompt, /BROKEN PHOTOGRAPHIC PORTRAIT/);
  assert.doesNotMatch(result.prompt, /shattered/i);
});

test('location prompt is a photoreal location-scout master with saved anchors', () => {
  const result = compileReferenceImagePrompt({
    label: 'Apartamento de Isabela',
    category: 'LOCATION_MASTER',
    description: 'Apartamento modesto e aconchegante.',
    metadata: {
      permanent_elements: ['sofá branco', 'estante de livros', 'quadros abstratos'],
      lighting_contract: 'daylight from the left window with warm wall bounce',
    },
  });

  assert.equal(result.visualReferenceMode, 'ultra_photoreal_location');
  assert.match(result.prompt, /believable real location-scout photograph/i);
  assert.match(result.prompt, /landscape 16:9/i);
  assert.match(result.prompt, /sofá branco/);
  assert.match(result.prompt, /daylight from the left window/);
  assert.match(result.prompt, /No pristine procedural surfaces/);
  assert.match(result.prompt, /closed topology/i);
});

test('prop prompt preserves its function and physical material response', () => {
  const result = compileReferenceImagePrompt({
    label: 'Relógio de Rafael',
    category: 'PROP_MASTER',
    description: 'Relógio de pulso de luxo usado sempre no pulso direito.',
    metadata: {
      story_function: 'símbolo recorrente de status',
      material: 'aço escovado e pulseira de couro preto',
    },
  });

  assert.equal(result.visualReferenceMode, 'ultra_photoreal_prop');
  assert.match(result.prompt, /photorealistic canonical prop continuity/i);
  assert.match(result.prompt, /símbolo recorrente de status/);
  assert.match(result.prompt, /aço escovado/);
  assert.match(result.prompt, /real physical object rather than a CGI\s+product render/i);
});

test('a short supplied brief is incorporated instead of replacing the contract', () => {
  const shortBrief = 'Mulher com cabelo preto curto e jaqueta vermelha.';
  const result = compileReferenceImagePrompt({
    label: 'Mara',
    category: 'CHARACTER_MASTER',
    prompt: shortBrief,
  });

  assert.notEqual(result.prompt, shortBrief);
  assert.match(result.prompt, /jaqueta vermelha/);
  assert.match(result.prompt, /LEFT 70%/);
});

test('an already canonical skill prompt is preserved byte for byte', () => {
  const canonical = 'Create a believable real location-scout photograph for a verified set.';
  const result = compileReferenceImagePrompt({
    label: 'Set verificado',
    category: 'LOCATION_MASTER',
    prompt: canonical,
  });

  assert.equal(result.prompt, canonical);
});

test('a compiled standard character prompt remains standard when reused', () => {
  const first = compileReferenceImagePrompt({
    label: 'Lucas Mendes',
    category: 'CHARACTER_MASTER',
    description: 'Criança de 5 anos.',
  });
  const reused = compileReferenceImagePrompt({
    label: 'Lucas Mendes',
    category: 'CHARACTER_MASTER',
    prompt: first.prompt,
  });

  assert.equal(reused.prompt, first.prompt);
  assert.equal(reused.visualReferenceMode, 'standard_ultra_photoreal');
});
