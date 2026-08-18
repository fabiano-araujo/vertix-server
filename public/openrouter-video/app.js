const refsPreset = [
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/character/c52f72b5-7cbc-4dc2-ae5b-b3cbab222923.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/character/b242d401-02f3-424c-8898-2ca516a5e71b.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/environment/ebb87b57-573e-4720-b10a-475ba0ace634.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/object/668181c3-9ecc-49e8-940c-72933f203fdc.png',
].join('\n');

const refsTake2Preset = [
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/character/c52f72b5-7cbc-4dc2-ae5b-b3cbab222923.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/character/9aa0cb31-ea41-4709-8060-b38be9a70567.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/character/b242d401-02f3-424c-8898-2ca516a5e71b.png',
  'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev/content/series/1/references/environment/ebb87b57-573e-4720-b10a-475ba0ace634.png',
].join('\n');

const take1PromptPreset = `Lia Han and Bia Torres stand inside Hana & Carta beside the center writing table, vertical 9:16 live-action dorama, 15 seconds. Use image 1 as Lia identity, image 2 as Bia identity, image 3 as the flower shop layout, image 4 as the yellow eviction letter prop. Bia is already inside, close enough to hear Lia before speaking. Rainy Seoul is visible only through the glass door.

Visual continuity: warm flower-shop light inside, blue wet street reflections outside, glass door and bell visible, writing table center, flower fridge back-right. Start on the official letter, then move naturally between Lia, Bia, and the door without forcing zooms or close-ups. Eyeline contract: Lia looks at the letter, then Bia's phone, then the door only after Bia notices it. Bia looks phone -> Lia -> door handle or silhouette. Every look has a clear target: face, prop, or door. No empty staring, no looking into camera.

Voice contract: Lia speaks Brazilian Portuguese from Brazil only, low controlled adult woman voice, dry but shaken. Bia speaks Brazilian Portuguese from Brazil only, brighter quicker adult woman voice, protective and urgent.

Timed dialogue and performance intent:
[1.2s-4.2s] Lia, intent = stunned confirmation turning into fear, eyes on the letter then briefly up: "Trinta dias para sair. Venderam a nossa dívida."
[5.8s-8.8s] Bia, intent = urgent confirmation, showing the phone to Lia, eyes from phone to Lia: "Foi a Han River. Eles compraram a dívida e o prédio."
[10.5s-13.4s] Bia, intent = sudden alert, eyes shift past Lia to the glass door: "Lia... tem alguém na porta."

Camera and audio: professional television-series cinematography, stable camera, polished blocking, restrained shot-reverse-shot coverage, natural over-the-shoulder and three-quarter angles, one subtle motivated push at most, no shaky amateur handheld, no constant camera movement, no forced zoom. Maintain accurate Brazilian Portuguese lip sync for the exact spoken lines; do not assign a line to the wrong visible character. No offscreen critical dialogue, no improvised words, no filler, no stray syllables, no extra line after the final scripted line. Rain ambience behind glass, dialogue louder than ambience. Brazilian Portuguese only. Speak the exact written lines only. No subtitles, no logos, no text on screen, no extra main characters, no facial drift, no wrong accent. End on Lia turning because Bia noticed someone at the door, with the bell or handle moving before the door opens.`;

const take2PromptPreset = `Noah Kang enters Hana & Carta from the rainy Seoul street, vertical 9:16 live-action dorama, 15 seconds. Professional television-series cinematography, stable camera, polished blocking, no shaky amateur handheld. Do not use a first frame; continue only through matching references and staging. Use image 1 as Lia identity, image 2 as Noah identity, image 3 as Bia identity, image 4 as the flower shop layout. If image 5 is included, it is the last frame from take 1 and must be used only as a transition/camera-cut reference for lighting, door direction, eyeline direction, blocking, and the cut into this take. Do not copy, clone, redraw, or duplicate any person from image 5. Continue after Bia's warning and the door-bell/handle movement.

Visual continuity: create a motivated professional camera cut from the last beat of take 1. Use one clean reverse-angle cut: the bell rings after Bia's warning, the camera changes angle toward the glass door, and Noah enters from the rainy street, damp charcoal coat, controlled posture, carrying a sealed yellow envelope. Bia remains beside or slightly behind Lia, silent, phone lowered. Lia remains behind the writing table, defensive, turning because Bia saw someone, not because Lia expected him. Eyeline contract: Noah looks at Lia; Lia and Bia look at Noah after the bell; Lia looks at the envelope only when Noah places it. Every look has a clear target: face, envelope, or door. No empty staring, no camera look. Exactly one Lia, one Noah, and one Bia are visible; no duplicate faces or repeated bodies.

Voice contract: Noah speaks Brazilian Portuguese from Brazil only, low restrained adult male voice, formal and precise. Lia speaks Brazilian Portuguese from Brazil only, low controlled adult woman voice, cold and wounded.

Timed dialogue and performance intent:
[0.0s-1.4s] No dialogue, no human voice, no random word, no vocalization. Only the door bell and rain while Noah enters.
[2.0s-5.1s] Noah, intent = formal admission, controlled guilt underneath, eyes on Lia: "Eu sou Noah Kang. A ordem passou para mim."
[7.0s-10.0s] Lia, intent = accusation disguised as a question, eyes on Noah: "Então veio medir a loja para o hotel?"
[11.0s-14.0s] Noah, intent = restrained warning and offer, trying to stop damage while hiding the real price, eyes on Lia then down to the envelope: "Não vim demolir a loja. Vim propor um acordo."

Camera and audio: professional series filming, stable dolly or tripod feel, restrained shot-reverse-shot coverage, natural over-the-shoulder and three-quarter angles, one subtle motivated push at most, no constant camera movement, no shaky wandering camera, no forced zoom. Continue the same rain ambience, room tone, and door-bell decay from take 1. Maintain accurate Brazilian Portuguese lip sync for the exact spoken lines; do not assign a line to the wrong visible character. No improvised words before, between, or after the scripted lines. No filler words, no stray syllables, no accidental voice during the opening silence. No front-facing lineup, no looking into lens. Use the last-frame reference only for transition continuity, never as a copied character source. Dialogue louder than rain. Brazilian Portuguese only. Speak the exact written lines only. No subtitles, no logos, no facial drift, no extra characters. End on Lia staring at the envelope without touching it.`;

const CACHE_KEY = 'openrouter-video-chain-cache-v1';
const CACHE_DEBOUNCE_MS = 250;
const LONG_REQUEST_LOG_MS = 30_000;
let cacheTimer = null;

const STEP_LABELS = {
  take1: 'Parte 1',
  take2: 'Parte 2',
  chain: 'Completo',
  assemble: 'Final',
  montagem: 'Final',
  download: 'Download',
  'existing-job': 'Download',
  models: 'Modelos',
  'voice-refs': 'Vozes',
  'admin-series': 'Séries',
  'admin-save': 'Salvar',
};

const STATE_LABELS = {
  running: 'fazendo',
  done: 'ok',
  error: 'erro',
};

const state = {
  busy: false,
  startedAt: null,
  timerId: null,
  take1: null,
  take2: null,
  assembled: null,
};

const $ = (id) => document.getElementById(id);

const controls = {
  adminToken: $('adminTokenInput'),
  seriesSelect: $('seriesSelect'),
  provider: $('providerInput'),
  model: $('modelInput'),
  duration: $('durationInput'),
  resolution: $('resolutionInput'),
  aspect: $('aspectInput'),
  seedTake1: $('seedTake1Input'),
  seedTake2: $('seedTake2Input'),
  useSeed: $('useSeedInput'),
  audio: $('audioInput'),
  uploadFrame: $('uploadFrameInput'),
  referencesTake1: $('referencesInput'),
  referencesTake2: $('referencesTake2Input'),
  audioReferencesTake1: $('audioReferencesInput'),
  audioReferencesTake2: $('audioReferencesTake2Input'),
  take1Prompt: $('take1Prompt'),
  take2Prompt: $('take2Prompt'),
  voiceMap: $('voiceMapOutput'),
  firstFrame: $('firstFrameInput'),
  networkStatus: $('networkStatus'),
  currentStatus: $('currentStatus'),
  runClock: $('runClock'),
  log: $('logOutput'),
  progress: $('progressList'),
  runBoth: $('runBothButton'),
  runTake1: $('runTake1Button'),
  runTake2: $('runTake2Button'),
  assemble: $('assembleButton'),
  existingJob: $('existingJobInput'),
  downloadExisting: $('downloadExistingButton'),
  loadModels: $('loadModelsButton'),
  loadAdminSeries: $('loadAdminSeriesButton'),
  saveProduction: $('saveProductionButton'),
  clearLog: $('clearLogButton'),
  clearCache: $('clearCacheButton'),
  modeHint: $('modeHint'),
  seriesSummary: $('seriesSummary'),
  copyReferences: $('copyReferencesButton'),
  generateVoiceRefs: $('generateVoiceRefsButton'),
};

function boot() {
  resetDefaults();
  const restored = restoreCache();

  controls.runBoth.addEventListener('click', () => runBoth());
  controls.runTake1.addEventListener('click', () => runTake1());
  controls.runTake2.addEventListener('click', () => runTake2());
  controls.assemble.addEventListener('click', () => assembleTakes());
  controls.downloadExisting.addEventListener('click', () => downloadExistingJob());
  controls.loadModels.addEventListener('click', () => loadModels());
  controls.loadAdminSeries.addEventListener('click', () => loadAdminSeries());
  controls.saveProduction.addEventListener('click', () => saveProductionSnapshot());
  controls.generateVoiceRefs.addEventListener('click', () => generateDefaultVoiceReferences());
  controls.seriesSelect.addEventListener('change', () => {
    updateSelectedSeriesSummary();
    scheduleCacheSave();
  });
  controls.clearLog.addEventListener('click', () => {
    controls.log.textContent = '';
    scheduleCacheSave();
  });
  controls.clearCache.addEventListener('click', () => clearCache());
  controls.copyReferences.addEventListener('click', () => copyReferencesToTake2());
  bindCacheInputs();
  updateSeedInputsState();
  updateModeHint();

  if (restored) {
    log('Cache local restaurado. Você pode continuar os próximos takes com as informações salvas.');
  } else {
    log('Site carregado. As chaves dos providers vêm do servidor.');
  }
}

function setBusy(value) {
  state.busy = value;
  controls.provider.disabled = value;
  controls.runBoth.disabled = value;
  controls.runTake1.disabled = value;
  controls.runTake2.disabled = value;
  controls.assemble.disabled = value;
  controls.downloadExisting.disabled = value;
  controls.loadModels.disabled = value;
  controls.loadAdminSeries.disabled = value;
  controls.saveProduction.disabled = value;
  controls.clearCache.disabled = value;
  controls.copyReferences.disabled = value;
  controls.generateVoiceRefs.disabled = value;
  updateSeedInputsState();

  if (value) {
    state.startedAt = Date.now();
    clearInterval(state.timerId);
    state.timerId = setInterval(updateClock, 500);
    updateClock();
  } else {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateClock() {
  if (!state.startedAt) return;
  const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const rest = String(seconds % 60).padStart(2, '0');
  controls.runClock.textContent = `${minutes}:${rest}`;
}

function log(message, type = 'info') {
  const now = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  controls.log.textContent += `[${now}] ${message}\n`;
  controls.log.scrollTop = controls.log.scrollHeight;
  controls.networkStatus.textContent = type === 'error' ? 'Erro' : type === 'running' ? 'Rodando' : 'Pronto';
  controls.currentStatus.textContent = simpleStatusMessage(message);
  scheduleCacheSave();
}

function simpleStatusMessage(message) {
  const firstLine = String(message || '').split('\n')[0];
  if (/polling esgotado/i.test(firstLine)) return 'O serviço demorou demais para responder.';
  if (/first frame URL pública/i.test(firstLine)) return 'O take 2 usa apenas referências visuais.';
  if (/request failed|HTTP 400|retornou erro/i.test(firstLine)) return 'O serviço recusou o pedido. Veja os detalhes técnicos se precisar.';
  if (/status pending/i.test(firstLine)) return 'Aguardando o serviço terminar o vídeo.';
  if (/status completed/i.test(firstLine)) return 'Processamento concluído. Preparando o vídeo.';
  if (/download conclu/i.test(firstLine)) return 'Vídeo baixado com sucesso.';
  if (/vídeo final pronto|cadeia take 1 \+ take 2 concluída/i.test(firstLine)) return 'Vídeo final pronto.';
  if (/job criado|job [a-z0-9]/i.test(firstLine)) return 'Pedido enviado. Agora é só aguardar.';
  if (/Site carregado/i.test(firstLine)) return 'Página pronta.';
  if (/Cache local restaurado/i.test(firstLine)) return 'Continue de onde parou.';
  return firstLine;
}

function resetDefaults() {
  controls.adminToken.value = '';
  controls.provider.value = 'openrouter';
  controls.model.value = 'bytedance/seedance-2.5';
  controls.duration.value = '15';
  controls.resolution.value = '480p';
  controls.aspect.value = '9:16';
  controls.seedTake1.value = '811601';
  controls.seedTake2.value = '811602';
  controls.useSeed.checked = true;
  controls.audio.checked = true;
  controls.uploadFrame.checked = false;
  controls.referencesTake1.value = refsPreset;
  controls.referencesTake2.value = refsTake2Preset;
  controls.audioReferencesTake1.value = '';
  controls.audioReferencesTake2.value = '';
  controls.take1Prompt.value = take1PromptPreset;
  controls.take2Prompt.value = take2PromptPreset;
  controls.voiceMap.value = '';
  controls.firstFrame.value = '';
  controls.existingJob.value = '';
  controls.seriesSelect.innerHTML = '<option value="">Carregue as séries admin</option>';
  controls.seriesSummary.textContent = 'Selecione uma série para salvar prompts, pontos e referências no banco.';
}

function bindCacheInputs() {
  const textInputs = [
    controls.model,
    controls.duration,
    controls.seedTake1,
    controls.seedTake2,
    controls.adminToken,
    controls.referencesTake1,
    controls.referencesTake2,
    controls.audioReferencesTake1,
    controls.audioReferencesTake2,
    controls.take1Prompt,
    controls.take2Prompt,
    controls.voiceMap,
    controls.firstFrame,
    controls.existingJob,
  ];
  const choiceInputs = [
    controls.provider,
    controls.seriesSelect,
    controls.resolution,
    controls.aspect,
    controls.useSeed,
    controls.audio,
    controls.uploadFrame,
  ];

  for (const input of textInputs) {
    input.addEventListener('input', () => scheduleCacheSave());
  }
  for (const input of choiceInputs) {
    input.addEventListener('change', () => {
      updateSeedInputsState();
      updateModeHint();
      scheduleCacheSave();
    });
  }
  controls.referencesTake1.addEventListener('input', () => updateModeHint());
  controls.referencesTake2.addEventListener('input', () => updateModeHint());
  controls.audioReferencesTake1.addEventListener('input', () => updateModeHint());
  controls.audioReferencesTake2.addEventListener('input', () => updateModeHint());
  controls.firstFrame.addEventListener('input', () => updateModeHint());
  window.addEventListener('beforeunload', () => saveCache());
}

function updateModeHint() {
  const take1ReferencesCount = parseReferenceUrls('take1').length;
  const referencesCount = parseReferenceUrls('take2').length;
  const take1AudioCount = parseAudioReferenceUrls('take1', { strict: false }).length;
  const take2AudioCount = parseAudioReferenceUrls('take2', { strict: false }).length;
  const isOpenRouter = provider() === 'openrouter';
  const take1Text = take1ReferencesCount === 1 ? '1 ref na Parte 1' : `${take1ReferencesCount} refs na Parte 1`;
  const referenceText = referencesCount === 1 ? '1 referência' : `${referencesCount} referências`;
  const audioText = `${take1AudioCount} áudio(s) na Parte 1, ${take2AudioCount} áudio(s) na Parte 2`;
  const seedText = provider() === 'wavespeed'
    ? 'sem seed na WaveSpeed'
    : controls.useSeed.checked
      ? 'seed ligado'
      : 'sem seed';

  controls.modeHint.classList.toggle(
    'warning',
    isOpenRouter && (take1AudioCount > 0 || take2AudioCount > 0),
  );

  if (isOpenRouter && (take1AudioCount > 0 || take2AudioCount > 0)) {
    controls.modeHint.textContent = `${take1Text}. OpenRouter mantém áudio nativo, mas não expõe reference_audios para Seedance; use Segmind/WaveSpeed para enviar ${audioText}. ${seedText}.`;
    return;
  }

  controls.modeHint.textContent = `${take1Text}. Parte 2: ${referenceText} sem first_frame. Continuidade por referências, staging, som e ação repetida. ${audioText}. ${seedText}.`;
}

function updateSeedInputsState() {
  const disabled = state.busy || !controls.useSeed.checked;
  controls.seedTake1.disabled = disabled;
  controls.seedTake2.disabled = disabled;
}

function copyReferencesToTake2() {
  controls.referencesTake2.value = controls.referencesTake1.value;
  updateModeHint();
  scheduleCacheSave();
  log('referências da parte 1 copiadas para a parte 2');
}

function serializeCache() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: {
      provider: controls.provider.value,
      model: controls.model.value,
      duration: controls.duration.value,
      resolution: controls.resolution.value,
      aspectRatio: controls.aspect.value,
      seedTake1: controls.seedTake1.value,
      seedTake2: controls.seedTake2.value,
      useSeed: controls.useSeed.checked,
      generateAudio: controls.audio.checked,
      uploadLastFrame: controls.uploadFrame.checked,
      firstFrame: '',
      existingJob: controls.existingJob.value,
      selectedSeriesId: controls.seriesSelect.value,
    },
    prompts: {
      references: controls.referencesTake1.value,
      referencesTake1: controls.referencesTake1.value,
      referencesTake2: controls.referencesTake2.value,
      audioReferencesTake1: controls.audioReferencesTake1.value,
      audioReferencesTake2: controls.audioReferencesTake2.value,
      take1: controls.take1Prompt.value,
      take2: controls.take2Prompt.value,
      voiceMap: controls.voiceMap.value,
    },
    results: {
      take1: state.take1,
      take2: state.take2,
      assembled: state.assembled,
    },
    ui: {
      take1JobId: $('take1JobId').textContent,
      take2JobId: $('take2JobId').textContent,
      assembledStatus: $('assembledStatus').textContent,
      currentStatus: controls.currentStatus.textContent,
      progressHtml: controls.progress.innerHTML,
      logText: controls.log.textContent.slice(-12000),
    },
  };
}

function scheduleCacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => saveCache(), CACHE_DEBOUNCE_MS);
}

function saveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = null;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(serializeCache()));
  } catch (error) {
    console.warn('Não foi possível salvar o cache local.', error);
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Não foi possível ler o cache local.', error);
    return null;
  }
}

function cleanLegacyPrompt(prompt, fallback) {
  if (!prompt) return fallback;
  if (/visible mouth|mouth visible|medium close-up|dialogue shots keep the speaking mouth visible|no prop covering the mouth|colocar o lobby|dívida foi vendida|comprou tudo|vem explicar olhando|te mostrar o contrato/i.test(prompt)) {
    return fallback;
  }
  return prompt;
}

function restoreCache() {
  const cache = loadCache();
  if (!cache) return false;

  const settings = cache.settings || {};
  const prompts = cache.prompts || {};
  controls.provider.value = settings.provider || controls.provider.value;
  const cachedModel = String(settings.model || '').trim();
  controls.model.value =
    cachedModel && cachedModel !== 'bytedance/seedance-2.0-20260414'
      ? cachedModel
      : controls.model.value;
  controls.duration.value = settings.duration || controls.duration.value;
  controls.resolution.value = settings.resolution || controls.resolution.value;
  controls.aspect.value = settings.aspectRatio || controls.aspect.value;
  controls.seedTake1.value = settings.seedTake1 || controls.seedTake1.value;
  controls.seedTake2.value = settings.seedTake2 || controls.seedTake2.value;
  controls.useSeed.checked = settings.useSeed ?? controls.useSeed.checked;
  controls.audio.checked = settings.generateAudio ?? controls.audio.checked;
  controls.uploadFrame.checked = false;
  controls.firstFrame.value = '';
  controls.existingJob.value = settings.existingJob || controls.existingJob.value;
  controls.seriesSelect.dataset.pendingValue = settings.selectedSeriesId || '';
  controls.referencesTake1.value = prompts.referencesTake1 ?? prompts.references ?? controls.referencesTake1.value;
  controls.referencesTake2.value =
    prompts.referencesTake2 ?? prompts.references ?? controls.referencesTake1.value;
  controls.audioReferencesTake1.value = prompts.audioReferencesTake1 ?? controls.audioReferencesTake1.value;
  controls.audioReferencesTake2.value = prompts.audioReferencesTake2 ?? controls.audioReferencesTake2.value;
  controls.take1Prompt.value = cleanLegacyPrompt(prompts.take1, controls.take1Prompt.value);
  controls.take2Prompt.value = cleanLegacyPrompt(prompts.take2, controls.take2Prompt.value);
  controls.voiceMap.value = prompts.voiceMap ?? controls.voiceMap.value;

  const results = cache.results || {};
  state.take1 = results.take1 || null;
  state.take2 = results.take2 || null;
  state.assembled = results.assembled || null;

  if (state.take1) restoreVideoResult(state.take1, 'take1');
  if (state.take2) restoreVideoResult(state.take2, 'take2');
  if (state.assembled) restoreAssembledResult(state.assembled);
  controls.firstFrame.value = '';

  const ui = cache.ui || {};
  $('take1JobId').textContent = simpleSavedLabel(ui.take1JobId) || $('take1JobId').textContent;
  $('take2JobId').textContent = simpleSavedLabel(ui.take2JobId) || $('take2JobId').textContent;
  $('assembledStatus').textContent = simpleSavedLabel(ui.assembledStatus) || $('assembledStatus').textContent;
  controls.currentStatus.textContent = ui.currentStatus
    ? simpleStatusMessage(ui.currentStatus)
    : controls.currentStatus.textContent;
  controls.progress.innerHTML = ui.progressHtml || '';
  normalizeProgressItems();
  controls.log.textContent = ui.logText || '';

  return true;
}

function simpleSavedLabel(value) {
  if (!value) return '';
  return ['sem job', 'aguardando takes'].includes(value) ? 'aguardando' : value;
}

function normalizeProgressItems() {
  for (const item of controls.progress.querySelectorAll('.progress-item')) {
    const strong = item.querySelector('strong');
    const span = item.querySelector('span');
    const small = item.querySelector('small');
    if (strong) strong.textContent = stepLabel(strong.textContent.trim());
    if (span) span.textContent = simpleProgressDetail(span.textContent.trim());
    if (small) small.textContent = STATE_LABELS[small.textContent.trim()] || small.textContent.trim();
  }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  resetDefaults();
  clearResultState();
  controls.log.textContent = '';
  log('Cache local limpo. Defaults restaurados.');
  saveCache();
}

function clearResultState() {
  state.take1 = null;
  state.take2 = null;
  state.assembled = null;
  clearMedia('take1Video');
  clearMedia('take1Frame');
  clearMedia('take2Video');
  clearMedia('take2Frame');
  clearMedia('assembledVideo');
  $('take1Links').innerHTML = '';
  $('take2Links').innerHTML = '';
  $('assembledLinks').innerHTML = '';
  $('take1JobId').textContent = 'aguardando';
  $('take2JobId').textContent = 'aguardando';
  $('assembledStatus').textContent = 'aguardando';
  controls.progress.innerHTML = '';
}

function clearMedia(id) {
  const element = $(id);
  element.removeAttribute('src');
  if (element.tagName === 'VIDEO') {
    element.load();
  }
}

function cacheBustedUrl(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

function restoreVideoResult(result, slot) {
  $(`${slot}Video`).src = cacheBustedUrl(result.videoUrl);
  $(`${slot}Frame`).src = cacheBustedUrl(result.lastFrameUrl);
  renderLinks(`${slot}Links`, result);
}

function restoreAssembledResult(result) {
  $('assembledVideo').src = cacheBustedUrl(result.videoUrl);
  renderAssembledLinks(result);
}

function numericValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : undefined;
}

function seedValue(input) {
  return controls.useSeed.checked ? numericValue(input) : undefined;
}

function provider() {
  return controls.provider.value;
}

function providerLabel() {
  if (provider() === 'wavespeed') return 'WaveSpeed';
  return provider() === 'segmind' ? 'Segmind' : 'OpenRouter';
}

function parseReferenceUrls(label = 'take1') {
  const source = label === 'take2' ? controls.referencesTake2 : controls.referencesTake1;
  return source.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAudioReferenceUrls(label = 'take1', options = {}) {
  const source = label === 'take2' ? controls.audioReferencesTake2 : controls.audioReferencesTake1;
  const urls = source.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (options.strict !== false && urls.length > 3) {
    throw new Error(`${label}: Seedance 2.0 aceita no máximo 3 áudios de referência por take.`);
  }
  return urls.slice(0, 3);
}

function commonRequest() {
  return {
    provider: provider(),
    model: controls.model.value.trim(),
    duration: numericValue(controls.duration),
    resolution: controls.resolution.value,
    aspectRatio: controls.aspect.value,
    generateAudio: controls.audio.checked,
  };
}

async function postJson(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Backend local não respondeu em ${path}. Verifique se a porta 3005 ainda está acessível.`);
  }

  const rawText = await response.text();
  const data = rawText ? tryParseJson(rawText) : null;
  const normalizedData = normalizeResponseBody(data || rawText);
  if (!response.ok) {
    const message = responseErrorMessage(normalizedData, response.status);
    const error = new Error(message);
    error.status = response.status;
    error.responseBody = normalizedData;
    throw error;
  }

  return normalizedData;
}

async function getJson(path) {
  let response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: authHeaders({ Accept: 'application/json' }),
    });
  } catch (error) {
    throw new Error(`Backend local não respondeu em ${path}. Verifique se a porta 3005 ainda está acessível.`);
  }

  const rawText = await response.text();
  const data = rawText ? tryParseJson(rawText) : null;
  const normalizedData = normalizeResponseBody(data || rawText);
  if (!response.ok) {
    const message = responseErrorMessage(normalizedData, response.status);
    const error = new Error(message);
    error.status = response.status;
    error.responseBody = normalizedData;
    throw error;
  }

  return normalizedData;
}

function authHeaders(baseHeaders) {
  const headers = { ...baseHeaders };
  const token = controls.adminToken.value.trim().replace(/^Bearer\s+/i, '');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function jobIdFrom(result) {
  if (result?.jobId) return result.jobId;
  if (result?.result?.jobId) return result.result.jobId;
  const data = result?.openrouter || result?.wavespeed?.data || result?.wavespeed || result?.data || result;
  const upstreamError = data?.error?.message || data?.error || data?.message;
  if (upstreamError) {
    const error = new Error(`OpenRouter retornou erro sem jobId: ${stringifyShort(upstreamError, 600)}`);
    error.responseBody = result;
    throw error;
  }
  if (data?.id) return data.id;
  if (data?.polling_url) return String(data.polling_url).split('/').filter(Boolean).pop();
  if (data?.generation_id) {
    const error = new Error(
      `OpenRouter retornou generation_id (${data.generation_id}), mas não retornou id/polling_url de vídeo para polling/download.`,
    );
    error.responseBody = result;
    throw error;
  }
  const error = new Error('A resposta da OpenRouter não trouxe jobId. Veja os detalhes brutos no log.');
  error.responseBody = result;
  throw error;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function responseErrorMessage(data, status) {
  const upstreamMessage =
    extractErrorMessage(data?.error?.upstream) ||
    extractErrorMessage(data?.upstream) ||
    extractErrorMessage(data);
  const directMessage = data?.error?.message || data?.message;

  if (upstreamMessage && !/^Request failed with status code/i.test(upstreamMessage)) {
    return `HTTP ${status}: ${upstreamMessage}`;
  }

  if (directMessage) {
    return `HTTP ${status}: ${directMessage}`;
  }

  return `HTTP ${status}`;
}

function extractErrorMessage(value) {
  if (!value) return '';

  const normalized = normalizeResponseBody(value);
  if (typeof normalized === 'string') {
    const parsed = tryParseJson(normalized);
    if (parsed !== normalized) return extractErrorMessage(parsed);
    return normalized;
  }

  return (
    normalized?.error?.message ||
    normalized?.error?.reason ||
    normalized?.error?.detail ||
    normalized?.errors?.[0]?.message ||
    normalized?.errors?.[0]?.reason ||
    normalized?.message ||
    normalized?.reason ||
    normalized?.failure_reason ||
    normalized?.failureReason ||
    normalized?.status_reason ||
    normalized?.statusReason ||
    normalized?.detail ||
    normalized?.details ||
    ''
  );
}

function jobFailureReason(result) {
  const normalized = normalizeResponseBody(result);
  const candidates = [
    normalized,
    normalized?.data,
    normalized?.result,
    normalized?.job,
    normalized?.openrouter,
    normalized?.error,
  ];

  for (const candidate of candidates) {
    const message = extractErrorMessage(candidate);
    if (message && !/^Request failed with status code/i.test(message)) {
      return message;
    }
  }

  return '';
}

function normalizeResponseBody(value) {
  if (!value) return value;

  const decoded = decodeBufferLike(value);
  if (decoded !== null) {
    return tryParseJson(decoded);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeResponseBody(item));
  }

  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = normalizeResponseBody(item);
    }
    return output;
  }

  return value;
}

function decodeBufferLike(value) {
  if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return new TextDecoder().decode(new Uint8Array(value.data));
  }

  if (value instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(value));
  }

  return null;
}

function stringifyShort(value, maxLength = 5000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n... [cortado]` : text;
}

function logResponseDetails(title, value) {
  if (value === undefined) return;
  log(`${title}:\n${stringifyShort(value, 9000)}`, 'error');
}

function beginLongRequestNotice(label) {
  if (!['segmind'].includes(provider())) {
    return () => {};
  }

  const startedAt = Date.now();
  log(`${label}: Segmind está processando em modo síncrono; a tela pode ficar sem novo status até o vídeo ou erro voltar.`, 'running');

  const timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const rest = String(seconds % 60).padStart(2, '0');
    log(`${label}: ainda aguardando resposta da Segmind (${minutes}:${rest}). Se houver erro ou timeout, ele será mostrado aqui.`, 'running');
  }, LONG_REQUEST_LOG_MS);

  return () => clearInterval(timer);
}

function upsertProgress(key, title, detail, status = 'running') {
  let item = document.querySelector(`[data-progress-key="${key}"]`);
  if (!item) {
    item = document.createElement('div');
    item.className = 'progress-item';
    item.dataset.progressKey = key;
    controls.progress.prepend(item);
  }

  item.dataset.state = status;
  item.title = `${title}: ${detail}`;
  const titleElement = document.createElement('strong');
  titleElement.textContent = stepLabel(title);
  const detailElement = document.createElement('span');
  detailElement.textContent = simpleProgressDetail(detail);
  const stateElement = document.createElement('small');
  stateElement.textContent = STATE_LABELS[status] || status;
  item.replaceChildren(titleElement, detailElement, stateElement);
  scheduleCacheSave();
}

function stepLabel(title) {
  return STEP_LABELS[title] || title;
}

function simpleProgressDetail(detail) {
  const text = String(detail || '');
  if (/download conclu/i.test(text)) return 'vídeo baixado';
  if (/vídeo final pronto/i.test(text)) return 'vídeo pronto';
  if (/polling esgotado/i.test(text)) return 'demorou demais';
  if (/status completed/i.test(text)) return 'processamento concluído';
  if (/status pending/i.test(text)) return 'aguardando o serviço';
  if (/status (failed|cancelled|canceled|error)/i.test(text)) return 'processamento falhou';
  if (/^job\s+/i.test(text)) return 'pedido enviado';
  if (/HTTP 400|Request failed|OpenRouter retornou erro/i.test(text)) return 'pedido recusado';
  return text;
}

async function submitTake(label) {
  const isTake1 = label === 'take1';
  const referenceUrls = parseReferenceUrls(label);
  const referenceAudioUrls = parseAudioReferenceUrls(label);
  const inputReferenceUrls = referenceUrls;
  const take1TransitionFrame = state.take1?.publicLastFrameUrl
    || (state.take1?.lastFrameUrl ? new URL(state.take1.lastFrameUrl, window.location.origin).href : '');
  if (!isTake1 && take1TransitionFrame && !inputReferenceUrls.includes(take1TransitionFrame)) {
    if (provider() === 'wavespeed' && inputReferenceUrls.length >= 4) {
      inputReferenceUrls.splice(3);
      log('take2: WaveSpeed aceita poucas referências; mantendo Lia, Noah, Bia e o último frame de transição.', 'running');
    }
    inputReferenceUrls.push(take1TransitionFrame);
    log('take2: último frame do take 1 adicionado em reference_images apenas como referência de transição.', 'running');
  }
  const body = {
    ...commonRequest(),
    label: `${label}-${provider()}`,
    prompt: isTake1 ? controls.take1Prompt.value : controls.take2Prompt.value,
    seed: seedValue(isTake1 ? controls.seedTake1 : controls.seedTake2),
    uploadLastFrame: controls.uploadFrame.checked,
    inputReferenceUrls,
    referenceAudioUrls,
  };

  if (!isTake1 && controls.firstFrame.value.trim()) {
    controls.firstFrame.value = '';
    log('take2: first_frame desativado; enviando somente referências visuais.', 'running');
  }

  if (provider() === 'wavespeed' && body.seed !== undefined) {
    delete body.seed;
    log(`${label}: WaveSpeed selecionado; seed não é enviado nesse provider.`, 'running');
  }

  const mediaMode = isTake1
    ? `${inputReferenceUrls.length} referências`
    : `${inputReferenceUrls.length} referências sem imagem inicial`;
  const audioMode = referenceAudioUrls.length === 1 ? '1 áudio' : `${referenceAudioUrls.length} áudios`;
  const seedMode = controls.useSeed.checked ? 'com seed' : 'sem seed';
  log(`${label}: enviando para ${providerLabel()} (${mediaMode}, ${audioMode}, ${seedMode})`, 'running');
  updateModeHint();
  const stopLongRequestNotice = beginLongRequestNotice(label);
  let result;
  try {
    result = await postJson('/openrouter-video-api/jobs', body);
  } finally {
    stopLongRequestNotice();
  }
  let jobId;
  try {
    jobId = jobIdFrom(result);
  } catch (error) {
    logResponseDetails(`${label}: resposta bruta recebida de ${providerLabel()} sem jobId`, error.responseBody || result);
    error.detailsLogged = true;
    throw error;
  }
  $(isTake1 ? 'take1JobId' : 'take2JobId').textContent = jobId;
  upsertProgress(`${label}-submit`, label, `${result.completed ? 'vídeo pronto' : 'job'} ${jobId}`, 'done');
  log(`${label}: ${result.completed ? 'vídeo pronto' : 'job criado'} ${jobId} (${result.mode || mediaMode})`);
  saveCache();
  return { jobId, result };
}

async function pollJob(jobId, label) {
  const maxPolls = 120;
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const result = await postJson(`/openrouter-video-api/jobs/${encodeURIComponent(jobId)}/status`, {
      provider: provider(),
    });

    const status = result.status || result.data?.status || 'unknown';
    upsertProgress(`${label}-poll`, label, `status ${status}, tentativa ${attempt}`, status === 'completed' ? 'done' : 'running');
    log(`${label}: status ${status}`);

    if (status === 'completed') {
      return result;
    }

    if (['failed', 'cancelled', 'canceled', 'error'].includes(status)) {
      const reason = jobFailureReason(result);
      const message = reason
        ? `${label}: job terminou com status ${status}: ${reason}`
        : `${label}: job terminou com status ${status}`;
      const error = new Error(message);
      error.responseBody = result;
      throw error;
    }

    await sleep(6000);
  }

  throw new Error(`${label}: polling esgotado.`);
}

function applyVideoResult(result, label, slot) {
  restoreVideoResult(result, slot);

  if (slot === 'take1') {
    state.take1 = result;
    if (result.publicLastFrameUrl) {
      controls.firstFrame.value = '';
      log(`take1: último frame salvo para revisão, mas first_frame não será usado no take 2: ${result.publicLastFrameUrl}`);
    } else if (result.uploadError) {
      log(`take1: upload do frame falhou: ${result.uploadError}`, 'error');
    }
  } else {
    state.take2 = result;
  }

  upsertProgress(`${label}-download`, label, 'download concluído', 'done');
  saveCache();
  return result;
}

async function downloadJob(jobId, label, slot) {
  log(`${label}: baixando vídeo e extraindo último frame`, 'running');
  const result = await postJson(`/openrouter-video-api/jobs/${encodeURIComponent(jobId)}/download`, {
    provider: provider(),
    label,
    uploadLastFrame: controls.uploadFrame.checked,
  });

  return applyVideoResult(result, label, slot);
}

async function completeTake(submission, label, slot) {
  if (submission?.result?.completed && submission.result.result) {
    log(`${label}: ${providerLabel()} já retornou vídeo pronto`);
    return applyVideoResult(submission.result.result, label, slot);
  }

  await pollJob(submission.jobId, label);
  return downloadJob(submission.jobId, label, slot);
}

async function assembleTakes() {
  if (state.busy) return;
  setBusy(true);
  try {
    await assembleTakesInternal();
  } catch (error) {
    handleError(error, 'assemble');
  } finally {
    setBusy(false);
  }
}

async function assembleTakesInternal() {
  if (!state.take1?.files?.videoPath || !state.take2?.files?.videoPath) {
    throw new Error('Baixe os dois takes antes de juntar.');
  }

  log('montagem: juntando take 1 + take 2 localmente', 'running');
  const result = await postJson('/openrouter-video-api/assemble', {
    take1Path: state.take1.files.videoPath,
    take2Path: state.take2.files.videoPath,
    label: 'ultima-orbita-2takes',
  });

  $('assembledStatus').textContent = 'pronto';
  state.assembled = result;
  restoreAssembledResult(result);
  upsertProgress('assemble', 'montagem', 'vídeo final pronto', 'done');
  log(`montagem: vídeo final pronto ${result.videoUrl}`);
  saveCache();
  return result;
}

function renderAssembledLinks(result) {
  const container = $('assembledLinks');
  container.innerHTML = '';
  const href = document.createElement('a');
  href.href = result.videoUrl;
  href.target = '_blank';
  href.rel = 'noreferrer';
  href.textContent = `Vídeo final: ${result.videoUrl}`;
  container.appendChild(href);
}

function renderLinks(containerId, result) {
  const container = $(containerId);
  container.innerHTML = '';

  const links = [
    ['Vídeo local', result.videoUrl],
    ['Frame local', result.lastFrameUrl],
  ];

  if (result.publicLastFrameUrl) {
    links.push(['Frame público', result.publicLastFrameUrl]);
  }

  for (const [label, url] of links) {
    const href = document.createElement('a');
    href.href = url;
    href.target = '_blank';
    href.rel = 'noreferrer';
    href.textContent = `${label}: ${url}`;
    container.appendChild(href);
  }

  if (result.publicLastFrameUrl) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Copiar frame público';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.publicLastFrameUrl);
        log('frame público copiado');
      } catch (error) {
        log('não foi possível copiar automaticamente; use o link do frame público', 'error');
      }
    });
    container.appendChild(button);
  }
}

async function runTake1() {
  if (state.busy) return;
  setBusy(true);
  try {
    const submission = await submitTake('take1');
    await completeTake(submission, 'take1', 'take1');
    log('take1 concluído');
  } catch (error) {
    handleError(error, 'take1');
  } finally {
    setBusy(false);
  }
}

async function runTake2() {
  if (state.busy) return;
  setBusy(true);
  try {
    const submission = await submitTake('take2');
    await completeTake(submission, 'take2', 'take2');
    log('take2 concluído');
  } catch (error) {
    handleError(error, 'take2');
  } finally {
    setBusy(false);
  }
}

async function runBoth() {
  if (state.busy) return;
  setBusy(true);
  try {
    const take1Submission = await submitTake('take1');
    await completeTake(take1Submission, 'take1', 'take1');

    const take2Submission = await submitTake('take2');
    await completeTake(take2Submission, 'take2', 'take2');
    await assembleTakesInternal();
    log('cadeia take 1 + take 2 concluída');
  } catch (error) {
    handleError(error, 'chain');
  } finally {
    setBusy(false);
  }
}

async function downloadExistingJob() {
  if (state.busy) return;
  setBusy(true);
  try {
    const jobId = controls.existingJob.value.trim();
    if (!jobId) throw new Error('Informe o jobId.');
    await downloadJob(jobId, 'existing-job', 'take1');
  } catch (error) {
    handleError(error, 'download');
  } finally {
    setBusy(false);
  }
}

async function loadAdminSeries() {
  if (state.busy) return;
  setBusy(true);
  try {
    if (!controls.adminToken.value.trim()) {
      throw new Error('Informe o token admin para carregar as séries.');
    }

    const result = await getJson('/admin/series/available?status=ALL&limit=100');
    const series = Array.isArray(result.data) ? result.data : [];
    renderAdminSeries(series);
    log(`admin: ${series.length} séries carregadas`);
  } catch (error) {
    handleError(error, 'admin-series');
  } finally {
    setBusy(false);
  }
}

function renderAdminSeries(series) {
  controls.seriesSelect.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = series.length ? 'Selecione uma série' : 'Nenhuma série encontrada';
  controls.seriesSelect.appendChild(emptyOption);

  for (const item of series) {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.dataset.title = item.title || '';
    option.dataset.status = item.status || '';
    option.dataset.genre = item.genre || '';
    option.dataset.episodes = String(item._count?.episodes ?? item.totalEpisodes ?? 0);
    option.dataset.references = String(item._count?.referenceAssets ?? 0);
    option.dataset.points = String(item._count?.storyPoints ?? 0);
    option.dataset.hasPlan = item.productionPlan ? 'true' : 'false';
    option.textContent = `${item.title || `Série ${item.id}`} · ${item.status || 'DRAFT'} · ${option.dataset.episodes} eps`;
    controls.seriesSelect.appendChild(option);
  }

  const pendingValue = controls.seriesSelect.dataset.pendingValue;
  if (pendingValue && [...controls.seriesSelect.options].some((option) => option.value === pendingValue)) {
    controls.seriesSelect.value = pendingValue;
    delete controls.seriesSelect.dataset.pendingValue;
  }

  updateSelectedSeriesSummary();
  saveCache();
}

function updateSelectedSeriesSummary() {
  const option = controls.seriesSelect.selectedOptions[0];
  if (!option || !option.value) {
    controls.seriesSummary.textContent = 'Selecione uma série para salvar prompts, pontos e referências no banco.';
    return;
  }

  const planText = option.dataset.hasPlan === 'true' ? 'pipeline já salva' : 'sem pipeline salva';
  controls.seriesSummary.textContent =
    `${option.dataset.title} · ${option.dataset.status} · ${option.dataset.genre} · ` +
    `${option.dataset.episodes} eps · ${option.dataset.references} refs · ` +
    `${option.dataset.points} pontos · ${planText}`;
}

async function saveProductionSnapshot() {
  if (state.busy) return;
  setBusy(true);
  try {
    const seriesId = controls.seriesSelect.value;
    if (!controls.adminToken.value.trim()) {
      throw new Error('Informe o token admin para salvar na série.');
    }
    if (!seriesId) {
      throw new Error('Selecione uma série antes de salvar.');
    }

    const result = await postJson(`/admin/series/${encodeURIComponent(seriesId)}/production`, buildProductionSnapshot());
    const saved = result.data || {};
    log(
      `admin: produção salva na série ${seriesId} com ${saved.referencesSaved || 0} refs e ${saved.storyPointsSaved || 0} pontos; ` +
      `${saved.referencesReplaced || 0} refs anteriores substituídas.`,
    );
    if (Array.isArray(saved.referenceErrors) && saved.referenceErrors.length > 0) {
      log(`admin: ${saved.referenceErrors.length} referências não puderam ser enviadas ao R2. Veja detalhes técnicos.`, 'error');
      logResponseDetails('admin: erros de referência', saved.referenceErrors);
    }
    const refreshed = await getJson('/admin/series/available?status=ALL&limit=100');
    renderAdminSeries(Array.isArray(refreshed.data) ? refreshed.data : []);
  } catch (error) {
    handleError(error, 'admin-save');
  } finally {
    setBusy(false);
  }
}

function buildProductionSnapshot() {
  const selected = controls.seriesSelect.selectedOptions[0];
  const references = [];

  const pushVideoReference = (slot, label, result, metadata = {}) => {
    if (!result?.videoUrl) return;
    references.push({
      sourceUrl: result.videoUrl,
      category: 'VIDEO',
      label,
      contentType: 'video/mp4',
      sizeBytes: result.bytes,
      metadata: {
        productionSlot: slot,
        provider: result.provider || provider(),
        jobId: result.jobId || null,
        firstFrameUsed: false,
        referencesOnly: true,
        ...metadata,
      },
    });
  };

  pushVideoReference('ep01_take1_video', 'EP01 Take 1 atual', state.take1, {
    episodeNumber: 1,
    segment: 'take1',
    referenceUrls: parseReferenceUrls('take1'),
  });
  pushVideoReference('ep01_take2_video', 'EP01 Take 2 atual', state.take2, {
    episodeNumber: 1,
    segment: 'take2',
    referenceUrls: parseReferenceUrls('take2'),
  });

  if (state.assembled?.videoUrl) {
    pushVideoReference('ep01_take1_take2_assembled_video', 'EP01 Takes 1-2 montagem atual', state.assembled, {
      episodeNumber: 1,
      segment: 'take1_take2_assembled',
      provider: 'local-ffmpeg',
    });
  }

  return {
    source: 'openrouter-video-ui-current-run',
    replaceExisting: false,
    replaceCurrentRun: true,
    collectImplicitReferences: false,
    seriesTitle: selected?.dataset.title || '',
    prompts: {
      take1: controls.take1Prompt.value,
      take2: controls.take2Prompt.value,
    },
    generationPlan: [
      {
        segment: 'take1',
        provider: provider(),
        model: controls.model.value.trim(),
        duration_seconds: numericValue(controls.duration),
        resolution: controls.resolution.value,
        aspect_ratio: controls.aspect.value,
        seed: seedValue(controls.seedTake1),
        references_to_send: parseReferenceUrls('take1'),
        audio_references_to_send: parseAudioReferenceUrls('take1', { strict: false }),
        dreamina_seedance_prompt_30_100_words: controls.take1Prompt.value,
        result: state.take1
          ? { provider: state.take1.provider, jobId: state.take1.jobId, bytes: state.take1.bytes }
          : null,
      },
      {
        segment: 'take2',
        provider: provider(),
        model: controls.model.value.trim(),
        duration_seconds: numericValue(controls.duration),
        resolution: controls.resolution.value,
        aspect_ratio: controls.aspect.value,
        seed: seedValue(controls.seedTake2),
        first_frame_source: null,
        references_to_send: parseReferenceUrls('take2'),
        audio_references_to_send: parseAudioReferenceUrls('take2', { strict: false }),
        dreamina_seedance_prompt_30_100_words: controls.take2Prompt.value,
        result: state.take2
          ? { provider: state.take2.provider, jobId: state.take2.jobId, bytes: state.take2.bytes }
          : null,
      },
      ...(state.assembled ? [{
        segment: 'take1_take2_assembled',
        provider: 'local-ffmpeg',
        duration_seconds: null,
        aspect_ratio: controls.aspect.value,
        first_frame_source: null,
        result: { bytes: state.assembled.bytes },
      }] : []),
    ],
    storyPoints: [
      {
        pointType: 'SEEDANCE_PROMPT',
        title: 'EP01 Take 1 prompt atual',
        body: controls.take1Prompt.value,
        episodeNumber: 1,
        segment: 'take1',
        orderIndex: 0,
        metadata: {
          productionSlot: 'ep01_take1_prompt',
          firstFrameUsed: false,
          referencesOnly: true,
        },
      },
      {
        pointType: 'SEEDANCE_PROMPT',
        title: 'EP01 Take 2 prompt atual',
        body: controls.take2Prompt.value,
        episodeNumber: 1,
        segment: 'take2',
        orderIndex: 1,
        metadata: {
          productionSlot: 'ep01_take2_prompt',
          firstFrameUsed: false,
          referencesOnly: true,
        },
      },
      {
        pointType: 'REFERENCE_SET',
        title: 'EP01 referências enviadas no run atual',
        body: references,
        episodeNumber: 1,
        segment: 'take1_take2',
        orderIndex: 2,
        metadata: {
          productionSlot: 'ep01_take1_take2_reference_set',
          firstFrameUsed: false,
          referencesOnly: true,
        },
      },
    ],
    references,
    seedanceNotes: {
      provider: provider(),
      generateAudio: controls.audio.checked,
      maxAudioReferencesPerTake: 3,
      uploadLastFrame: controls.uploadFrame.checked,
      savedFrom: 'server/public/openrouter-video',
    },
    rawSnapshot: serializeCache(),
  };
}

function inferReferenceCategory(url, label) {
  const text = `${label} ${url}`.toLowerCase();
  if (/audio|voice|voz|mp3|m4a|wav/.test(text)) return 'AUDIO';
  if (/environment|ambiente|location|cenario|cenário|court|room|street/.test(text)) return 'ENVIRONMENT';
  if (/object|objeto|prop|vehicle|item|frame/.test(text)) return 'OBJECT';
  if (/character|personagem|cast|face|body/.test(text)) return 'CHARACTER';
  if (/storyboard|board/.test(text)) return 'STORYBOARD';
  return 'REFERENCE';
}

function defaultVoiceClips() {
  return [
    {
      character: 'Lia Han',
      voiceName: 'Bella',
      text: 'Mais uma carta de despejo. Como se a chuva ja nao bastasse. Minha mae morreu sem deixar cartas pra estranhos.',
      stability: 0.52,
      similarityBoost: 0.78,
      style: 0.18,
    },
    {
      character: 'Noah Kang',
      voiceName: 'Charlie',
      text: 'Eu vim pela carta de Eun-mi Han. Se eu nao casar em sete dias, eles destroem tudo.',
      stability: 0.58,
      similarityBoost: 0.76,
      style: 0.12,
    },
    {
      character: 'Bia Torres',
      voiceName: 'Jessica',
      text: 'Lia, o comprador chegou. E veio de terno. Lia, o video tem espelho.',
      stability: 0.42,
      similarityBoost: 0.72,
      style: 0.34,
    },
    {
      character: 'Hye-rin Seo',
      voiceName: 'Matilda',
      text: 'Que bonito. E que inutil para a diretoria. Voce nao sabe o que vai perder.',
      stability: 0.62,
      similarityBoost: 0.78,
      style: 0.16,
    },
    {
      character: 'Presidente Kang',
      voiceName: 'Adam',
      text: 'Eu deixei que me destruissem primeiro. Eun-mi queria que eu dissesse a verdade em voz alta.',
      stability: 0.68,
      similarityBoost: 0.78,
      style: 0.08,
    },
  ];
}

async function generateDefaultVoiceReferences() {
  if (state.busy) return;
  setBusy(true);
  try {
    log('vozes: gerando referências ElevenLabs e enviando para Catbox', 'running');
    upsertProgress('voice-refs', 'voice-refs', 'gerando MP3', 'running');
    const result = await postJson('/openrouter-video-api/voice-references', {
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      upload: true,
      clips: defaultVoiceClips(),
    });

    const byCharacter = new Map(
      (result.results || []).map((item) => [String(item.character || '').toLowerCase(), item]),
    );
    const urlFor = (name) => byCharacter.get(name.toLowerCase())?.publicUrl || '';

    controls.audioReferencesTake1.value = [urlFor('Lia Han'), urlFor('Bia Torres')].filter(Boolean).join('\n');
    controls.audioReferencesTake2.value = [urlFor('Noah Kang'), urlFor('Lia Han')].filter(Boolean).join('\n');
    controls.voiceMap.value = JSON.stringify(result.results || [], null, 2);
    updateModeHint();
    upsertProgress('voice-refs', 'voice-refs', 'áudios prontos', 'done');
    log('vozes: referências geradas. Take 1 recebeu Lia/Bia; Take 2 recebeu Noah/Lia.');
    saveCache();
  } catch (error) {
    handleError(error, 'voice-refs');
  } finally {
    setBusy(false);
  }
}

async function loadModels() {
  if (state.busy) return;
  setBusy(true);
  try {
    if (provider() === 'segmind') {
      log('Segmind selecionado: usando endpoint Seedance 2.0 configurado no servidor.');
      return;
    }
    if (provider() === 'wavespeed') {
      log('WaveSpeed selecionado: usando bytedance/seedance-2.0 via API v3 configurada no servidor.');
      return;
    }
    const result = await postJson('/openrouter-video-api/models', {});
    log(JSON.stringify(result, null, 2));
  } catch (error) {
    handleError(error, 'models');
  } finally {
    setBusy(false);
  }
}

function handleError(error, key) {
  const message = error?.message || String(error);
  upsertProgress(`${key}-error`, key, message, 'error');
  log(message, 'error');
  if (!error?.detailsLogged) {
    logResponseDetails(`${key}: detalhes da resposta`, error?.responseBody);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

boot();
