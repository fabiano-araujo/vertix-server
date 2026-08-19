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

test('app cover uses premium portrait key art and embeds the exact series title', () => {
  const result = compileReferenceImagePrompt({
    label: 'Sombra do Passado',
    category: 'APP_COVER',
    description: 'Uma mulher busca vingança ao descobrir que seu ex-amante escondeu a existência do filho deles.',
    metadata: {
      seriesTitle: 'Sombra do Passado',
      genre: 'Drama de vingança',
      protagonist: 'Isabela Costa',
      opposingForce: 'Rafael Mendes',
      targetField: 'Series.coverUrl',
    },
  });

  assert.equal(result.visualReferenceMode, 'premium_streaming_cover');
  assert.equal(result.promptMetadata?.assetRole, 'APP_COVER');
  assert.equal(result.promptMetadata?.targetField, 'Series.coverUrl');
  assert.match(result.prompt, /vertical 2:3 premium global-streaming series cover/i);
  assert.match(result.prompt, /“Sombra do Passado”/);
  assert.match(result.prompt, /130x200/);
  assert.match(result.prompt, /Typography must feel authored for this series/i);
  assert.match(result.prompt, /No subtitle, episode number/i);
  assert.match(result.prompt, /No .*Netflix N/i);
  assert.doesNotMatch(result.prompt, /location-scout photograph/i);
});

test('cover design is deterministic per series and varies across the catalog', () => {
  const titles = [
    'Sombra do Passado',
    'Laços Invisíveis',
    'Cicatrizes do Passado',
    'Fragmentos do Passado',
    'Máscara de Retribuição',
    'O Contrato da Chuva',
  ];
  const compiled = titles.map((title) => compileReferenceImagePrompt({
    label: title,
    category: 'APP_COVER',
    description: `Premissa dramática original de ${title}.`,
    metadata: { seriesTitle: title, genre: 'Drama de vingança' },
  }));
  const repeated = compileReferenceImagePrompt({
    label: titles[0],
    category: 'APP_COVER',
    description: `Premissa dramática original de ${titles[0]}.`,
    metadata: { seriesTitle: titles[0], genre: 'Drama de vingança' },
  });

  assert.equal(repeated.prompt, compiled[0].prompt);
  assert.deepEqual(repeated.promptMetadata, compiled[0].promptMetadata);
  assert.ok(new Set(compiled.map((item) =>
    item.promptMetadata?.coverCompositionVariant)).size > 1);
  assert.ok(new Set(compiled.map((item) =>
    item.promptMetadata?.coverTypographyVariant)).size > 1);
  assert.ok(new Set(compiled.map((item) =>
    item.promptMetadata?.coverPaletteVariant)).size > 1);
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
