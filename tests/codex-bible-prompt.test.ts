import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactProjectForBible,
  filterRecurringEnvironments,
  isGenericStreetLocation,
  referencesFromBibleSheets,
  sanitizeOutlineInstruction,
} from '../src/services/outline-prompt.service';

test('drops Flutter pipeline commands from the bible instruction', () => {
  const cleaned = sanitizeOutlineInstruction(`
Ideia do usuario: favela
Modo do roteirista: Melhor roteirista
Genero: Romance com reviravolta
Crie um TITULO original da serie (2 a 6 palavras).
Gere o contrato e o mapa completo da temporada com paywall e revelacoes reservadas.
Depois gere so o primeiro lote de cartoes (ate 5 episodios). Nao gaste no EP inicial o que o bloco final precisa.
Duracao do EP1: 120s
Duracao dos demais: 90s
favela
`);
  assert.match(cleaned, /Ideia do usuario: favela/);
  assert.match(cleaned, /TITULO original/);
  assert.doesNotMatch(cleaned, /mapa completo da temporada/);
  assert.doesNotMatch(cleaned, /primeiro lote de cartoes/);
  assert.doesNotMatch(cleaned, /Modo do roteirista/);
  assert.doesNotMatch(cleaned, /Duracao do EP1/);
  assert.equal(
    cleaned.split('\n').filter((line) => line.toLowerCase() === 'favela').length,
    0,
  );
});

test('bible project JSON keeps the brief and drops chat-workflow noise', () => {
  const compact = compactProjectForBible({
    id: 'microdrama-chat-1',
    title: 'Novo microdrama',
    description: 'Descreva a ideia no chat para gerar o contrato e o esboço.',
    genre: 'Romance com reviravolta',
    targetEpisodeCount: 50,
    seriesBible: {
      creation_stage: 'chat_brief',
      package_status: 'AWAITING_CHAT_BRIEF',
      language: 'Português (Brasil)',
      rating: '14 anos',
      visual_style: 'Microdrama moderno',
      background: 'Cidade moderna',
      trope: 'Segunda chance',
      first_episode_duration_seconds: 120,
      episode_duration_seconds: 90,
      video_generation_profile: 'seedance_2_5_dola',
      workflow: { outline: 'NOT_STARTED' },
    },
    episodes: [],
    references: [],
  });
  assert.equal(compact.title, 'Novo microdrama');
  assert.equal(compact.seriesBible.background, 'Cidade moderna');
  assert.equal(compact.seriesBible.language, 'Português (Brasil)');
  assert.equal(compact.seriesBible.creation_stage, undefined);
  assert.equal(compact.seriesBible.workflow, undefined);
  assert.equal(compact.episodes, undefined);
});

test('builds image references from bible sheets so the model does not duplicate the cast', () => {
  const refs = referencesFromBibleSheets({
    characters: [{
      reference_id: 'character-lia',
      name: 'Lia Nunes',
      appearance: 'Altura: 168 cm',
    }],
    environments: [{
      reference_id: 'location-yard',
      name: 'Laje',
      description: 'Laje com caixa d agua',
    }],
    props: [{
      reference_id: 'prop-key',
      name: 'Chave',
      description: 'Chave do barraco',
    }],
  });
  assert.equal(refs.length, 3);
  assert.equal(refs[0].id, 'character-lia');
  assert.equal(refs[0].category, 'CHARACTER_MASTER');
  assert.equal(refs[1].category, 'LOCATION_MASTER');
  assert.equal(refs[2].category, 'PROP_MASTER');
});

test('drops generic streets and keeps named recurring stages', () => {
  const kept = filterRecurringEnvironments([
    { reference_id: 'location-home', name: 'Casa da Lia', kind: 'home' },
    { reference_id: 'location-street', name: 'Rua', kind: 'street' },
    { reference_id: 'location-any', name: 'uma rua qualquer' },
    { reference_id: 'location-hill', name: 'Morro do Galo', kind: 'landmark' },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].name, 'Casa da Lia');
  assert.equal(kept[1].name, 'Morro do Galo');
  assert.equal(isGenericStreetLocation({ name: 'Rua' }), true);
  assert.equal(isGenericStreetLocation({ name: 'Rua do Galo', kind: 'landmark' }), false);
});

test('creates CHARACTER_LOOK files from extra wardrobe looks', () => {
  const refs = referencesFromBibleSheets({
    characters: [{
      reference_id: 'character-lia',
      name: 'Lia Nunes',
      appearance: 'Altura: 168 cm',
      looks: [
        { id: 'default', kind: 'default', primary: true, wardrobe: 'jaleco' },
        {
          id: 'em-casa',
          label: 'em casa',
          kind: 'wardrobe',
          needed_because: 'espaço íntimo',
          wardrobe: 'camisola creme',
          prompt: 'Keep the character from image 1 unchanged. Change the outfit to: camisola creme',
        },
      ],
    }],
    environments: [{ reference_id: 'location-home', name: 'Casa', kind: 'home' }],
    props: [],
  });
  const look = refs.find((item) => item.category === 'CHARACTER_LOOK');
  assert.ok(look);
  assert.equal(look?.id, 'character-lia-look-em-casa');
  assert.equal(look?.metadata.parent_character_id, 'character-lia');
});
