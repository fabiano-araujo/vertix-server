import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactProjectForBible,
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
favela
`);
  assert.match(cleaned, /Ideia do usuario: favela/);
  assert.match(cleaned, /TITULO original/);
  assert.doesNotMatch(cleaned, /mapa completo da temporada/);
  assert.doesNotMatch(cleaned, /primeiro lote de cartoes/);
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
