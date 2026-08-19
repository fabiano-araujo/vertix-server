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
  assert.match(result.prompt, /HEAD-TO-BODY SCALE LOCK/);
  assert.match(result.prompt, /RIGHT PANEL GROUND/);
  assert.match(result.prompt, /EXACTLY\s+SIX/);
  assert.match(result.prompt, /#F7F6F2/);
  assert.match(result.prompt, /terno preto sóbrio/);
  assert.match(result.prompt, /Isabela Costa/);
  assert.doesNotMatch(result.prompt, /snowy or cold neutral outdoor background/);
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

test('character prompts lock a specific face instead of the default AI beauty composite', () => {
  const result = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, pele caramelo, cabelo cacheado, olhos verdes, terno bege.',
  });

  assert.match(result.prompt, /FACE IDENTITY LOCK/);
  assert.match(result.prompt, /ANTI-SAMEFACE/);
  assert.match(result.prompt, /Craniofacial geometry to preserve exactly/);
  assert.ok(result.promptMetadata?.faceGeometryVariant);
  assert.notEqual(result.promptMetadata?.faceGeometryVariant, 'facts-owned');
});

test('cast members receive deterministic but different craniofacial packages', () => {
  const livia = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
  });
  const diego = compileReferenceImagePrompt({
    label: 'Diego Ventura',
    category: 'CHARACTER_MASTER',
    description: 'Homem brasileiro de 30 anos, camisa azul.',
  });
  const liviaAgain = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
  });

  assert.equal(
    livia.promptMetadata?.faceGeometryVariant,
    liviaAgain.promptMetadata?.faceGeometryVariant,
  );
  assert.notEqual(
    livia.promptMetadata?.faceGeometryVariant,
    diego.promptMetadata?.faceGeometryVariant,
  );
});

test('named craniofacial facts are preserved instead of a hashed geometry', () => {
  const result = compileReferenceImagePrompt({
    label: 'Rafaela Costa',
    category: 'CHARACTER_MASTER',
    description: 'Rosto em formato de coração, nariz pequeno e respingado, queixo recuado, olhos hooded afastados.',
  });

  assert.equal(result.promptMetadata?.faceGeometryVariant, 'facts-owned');
  assert.match(result.prompt, /Keep the craniofacial geometry already named/);
  assert.match(result.prompt, /rosto em formato de coração/i);
});

test('a protagonist defaults to galã camera-beauty with a varied look package', () => {
  const result = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });

  assert.equal(result.promptMetadata?.faceAttractivenessRegister, 'lead_camera_beauty');
  assert.equal(result.promptMetadata?.faceCastBand, 'lead');
  assert.match(result.prompt, /GALÃ/);
  assert.match(result.prompt, /LEAD LOOK PACKAGE/);
  assert.ok(result.promptMetadata?.leadHairColorVariant);
  assert.ok(result.promptMetadata?.leadHairTextureVariant);
  assert.ok(result.promptMetadata?.leadBodyVariant);
  assert.doesNotMatch(result.prompt, /chipped upper-left incisor/);
  assert.doesNotMatch(result.prompt, /scar breaking the right eyebrow/);
});

test('two leads receive different hair or body packages', () => {
  const livia = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });
  const nina = compileReferenceImagePrompt({
    label: 'Nina Rocha',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 27 anos, vestido vermelho.',
    metadata: { role: 'Protagonista' },
  });
  const lookKey = (item: ReturnType<typeof compileReferenceImagePrompt>) =>
    `${item.promptMetadata?.leadHairColorVariant}|${item.promptMetadata?.leadHairTextureVariant}|${item.promptMetadata?.leadBodyVariant}|${item.promptMetadata?.faceGeometryVariant}`;
  assert.notEqual(lookKey(livia), lookKey(nina));
});

test('a protagonist without a country receives an explicit origin lock', () => {
  const result = compileReferenceImagePrompt({
    label: 'Sora Kim',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });

  assert.match(result.prompt, /ORIGIN LOCK/);
  assert.ok(result.promptMetadata?.originCountry);
  assert.notEqual(result.promptMetadata?.originCountry, 'facts-owned');
});

test('two characters receive different origin packages', () => {
  const a = compileReferenceImagePrompt({
    label: 'Sora Kim',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });
  const b = compileReferenceImagePrompt({
    label: 'Amara Okoye',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 27 anos, vestido vermelho.',
    metadata: { role: 'Protagonista' },
  });

  assert.notEqual(
    a.promptMetadata?.originVariant,
    b.promptMetadata?.originVariant,
  );
});

test('an already named Brazilian origin is preserved', () => {
  const result = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });

  assert.equal(result.promptMetadata?.originVariant, 'facts-owned');
  assert.match(result.prompt, /keep the country and visible ancestry already named/i);
});

test('named ruiva curls are preserved instead of a hashed hair package', () => {
  const result = compileReferenceImagePrompt({
    label: 'Helena Vale',
    category: 'CHARACTER_MASTER',
    description: 'Protagonista ruiva de cabelo cacheado, corpo fitness, terno bege.',
    metadata: { role: 'Protagonista' },
  });

  assert.equal(result.promptMetadata?.leadHairColorVariant, 'facts-owned');
  assert.equal(result.promptMetadata?.leadHairTextureVariant, 'facts-owned');
  assert.equal(result.promptMetadata?.leadBodyVariant, 'facts-owned');
  assert.match(result.prompt, /keep the hair color already named/i);
});

test('an opposing force also uses lead camera beauty', () => {
  const result = compileReferenceImagePrompt({
    label: 'Diego Ventura',
    category: 'CHARACTER_MASTER',
    description: 'Homem brasileiro de 30 anos, camisa azul.',
    metadata: { role: 'Força oposta' },
  });

  assert.equal(result.promptMetadata?.faceAttractivenessRegister, 'lead_camera_beauty');
  assert.equal(result.promptMetadata?.faceCastBand, 'lead');
});

test('two leads still receive different craniofacial packages', () => {
  const livia = compileReferenceImagePrompt({
    label: 'Lívia Menezes',
    category: 'CHARACTER_MASTER',
    description: 'Mulher brasileira de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });
  const diego = compileReferenceImagePrompt({
    label: 'Diego Ventura',
    category: 'CHARACTER_MASTER',
    description: 'Homem brasileiro de 30 anos, camisa azul.',
    metadata: { role: 'Força oposta' },
  });

  assert.notEqual(
    livia.promptMetadata?.faceGeometryVariant,
    diego.promptMetadata?.faceGeometryVariant,
  );
});

test('supporting cast follows the story instead of a random ordinary face', () => {
  const result = compileReferenceImagePrompt({
    label: 'Rafaela Costa',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 27 anos, jaqueta preta.',
    metadata: { role: 'Confidente' },
  });

  assert.equal(result.promptMetadata?.faceAttractivenessRegister, 'story_as_written');
  assert.equal(result.promptMetadata?.faceCastBand, 'supporting');
  assert.match(result.prompt, /story_as_written/);
});

test('an ordinary-looking brief keeps the ordinary attractiveness register', () => {
  const result = compileReferenceImagePrompt({
    label: 'Marcos Tavares',
    category: 'CHARACTER_MASTER',
    description: 'Homem de 41 anos, pessoa comum, não tão bonito, rosto comum de escritório.',
  });

  assert.equal(result.promptMetadata?.faceAttractivenessRegister, 'ordinary_real');
  assert.match(result.prompt, /ordinary_real/);
  assert.match(result.prompt, /not especially pretty or handsome/);
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

test('leads lock cinematic presence, silhouette, wardrobe lane and a contradiction', () => {
  const result = compileReferenceImagePrompt({
    label: 'Sora Kim',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 28 anos.',
    metadata: { role: 'Protagonista' },
  });

  assert.match(result.prompt, /ENSEMBLE RULE/);
  assert.match(result.prompt, /SCREEN PRESENCE/);
  assert.match(result.prompt, /SILHOUETTE LOCK/);
  assert.match(result.prompt, /WARDROBE LANE/);
  assert.match(result.prompt, /PHONE-SCREEN HOOK/);
  assert.match(result.prompt, /LEAD CONTRADICTION/);
  assert.match(result.prompt, /AGE READ/);
  assert.ok(result.promptMetadata?.screenPresenceVariant);
  assert.ok(result.promptMetadata?.silhouetteVariant);
  assert.ok(result.promptMetadata?.wardrobeLaneVariant);
  assert.ok(result.promptMetadata?.leadContradictionVariant);
  assert.equal(result.promptMetadata?.presentationGuess, 'femme');
});

test('two leads receive different silhouette or wardrobe packages', () => {
  const a = compileReferenceImagePrompt({
    label: 'Sora Kim',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 28 anos, terno bege.',
    metadata: { role: 'Protagonista' },
  });
  const b = compileReferenceImagePrompt({
    label: 'Nina Rocha',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 27 anos, vestido vermelho.',
    metadata: { role: 'Protagonista' },
  });
  const key = (item: ReturnType<typeof compileReferenceImagePrompt>) =>
    `${item.promptMetadata?.silhouetteVariant}|${item.promptMetadata?.wardrobeLaneVariant}|${item.promptMetadata?.screenPresenceVariant}|${item.promptMetadata?.leadHairColorVariant}`;
  assert.notEqual(key(a), key(b));
});

test('a named Swedish origin keeps a northern-plausible hair color', () => {
  const result = compileReferenceImagePrompt({
    label: 'Elsa Berg',
    category: 'CHARACTER_MASTER',
    description: 'Mulher sueca de 29 anos.',
    metadata: { role: 'Protagonista' },
  });

  assert.equal(result.promptMetadata?.originVariant, 'facts-owned');
  assert.ok(
    ['honey-blonde', 'ash-brown', 'copper-red', 'facts-owned'].includes(
      result.promptMetadata?.leadHairColorVariant || '',
    ),
  );
  assert.doesNotMatch(result.prompt, /deep black hair/);
});

test('supporting cast still receives a distinctive silhouette and phone hook', () => {
  const result = compileReferenceImagePrompt({
    label: 'Rafaela Costa',
    category: 'CHARACTER_MASTER',
    description: 'Mulher de 27 anos, jaqueta preta.',
    metadata: { role: 'Confidente' },
  });

  assert.equal(result.promptMetadata?.faceCastBand, 'supporting');
  assert.match(result.prompt, /SUPPORTING DISTINCTIVENESS/);
  assert.match(result.prompt, /PHONE-SCREEN HOOK/);
  assert.ok(result.promptMetadata?.silhouetteVariant);
  assert.ok(result.promptMetadata?.phoneHookVariant);
  assert.doesNotMatch(result.prompt, /LEAD CONTRADICTION/);
});
