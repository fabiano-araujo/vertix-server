export const REFERENCE_IMAGE_PROMPT_CONTRACT =
  'seedance-series-pipeline/reference-images-v2';

export type ReferenceImagePromptInput = {
  label: string;
  category: string;
  description?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
};

export type ReferenceVisualMode =
  | 'hybrid_face_compat'
  | 'standard_ultra_photoreal'
  | 'ultra_photoreal_location'
  | 'ultra_photoreal_prop'
  | 'premium_streaming_cover';

export type CompiledReferenceImagePrompt = {
  prompt: string;
  promptContract: typeof REFERENCE_IMAGE_PROMPT_CONTRACT;
  visualReferenceMode: ReferenceVisualMode;
  promptMetadata?: Record<string, string>;
};

const cleanText = (value: unknown, maxLength = 12_000): string =>
  String(value ?? '').trim().slice(0, maxLength);

const normalizedKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const metadataValue = (
  metadata: Record<string, unknown>,
  keys: string[],
  depth = 0,
): unknown => {
  const wanted = new Set(keys.map(normalizedKey));
  for (const [key, value] of Object.entries(metadata)) {
    if (wanted.has(normalizedKey(key))) return value;
  }
  if (depth >= 2) return undefined;
  for (const value of Object.values(metadata)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const found = metadataValue(
        value as Record<string, unknown>,
        keys,
        depth + 1,
      );
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

const readableValue = (value: unknown, maxLength = 2_500): string => {
  if (Array.isArray(value)) {
    return value.map((item) => readableValue(item, 500)).filter(Boolean).join('; ')
      .slice(0, maxLength);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${readableValue(item, 500)}`)
      .filter((item) => !item.endsWith(': '))
      .join('; ')
      .slice(0, maxLength);
  }
  return cleanText(value, maxLength);
};

const uniqueFacts = (facts: string[]): string[] => {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const cleaned = cleanText(fact, 4_000);
    if (!cleaned) return false;
    const key = cleaned.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const selectedMetadataFacts = (
  metadata: Record<string, unknown>,
  groups: string[][],
): string[] => uniqueFacts(groups.map((keys) => readableValue(
  metadataValue(metadata, keys),
  3_000,
)));

const suppliedPromptLooksCanonical = (prompt: string): boolean => {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes('left 70% — three full-body turnaround views')
    || normalized.includes('left 70% - three full-body turnaround views')
    || normalized.includes('create one original fictional adult character identity sheet')
    || normalized.includes('create one horizontal 3:2 identity sheet')
    || normalized.includes('create a believable real location-scout photograph')
    || normalized.includes('believable real location-scout photograph for')
    || normalized.includes('photorealistic canonical prop continuity')
  );
};

const characterFacts = (input: ReferenceImagePromptInput): string => {
  const metadata = input.metadata || {};
  return uniqueFacts([
    cleanText(input.description, 4_000),
    suppliedPromptLooksCanonical(cleanText(input.prompt, 20_000))
      ? ''
      : cleanText(input.prompt, 4_000),
    ...selectedMetadataFacts(metadata, [
      ['appearance', 'visual_lock', 'visualLock'],
      ['visual_contract', 'visualContract'],
      ['outfit_lock', 'outfitLock', 'wardrobe'],
      ['age', 'age_range', 'ageRange'],
      ['role'],
    ]),
  ]).join(' ');
};

const locationFacts = (input: ReferenceImagePromptInput): string => {
  const metadata = input.metadata || {};
  return uniqueFacts([
    cleanText(input.description, 4_000),
    suppliedPromptLooksCanonical(cleanText(input.prompt, 20_000))
      ? ''
      : cleanText(input.prompt, 4_000),
    ...selectedMetadataFacts(metadata, [
      ['description', 'visual_lock', 'visualLock'],
      ['layout_lock', 'layoutLock', 'spatial_map', 'spatialMap'],
      ['story_function', 'storyFunction'],
      ['continuity_rules', 'continuityRules'],
    ]),
  ]).join(' ');
};

const propFacts = (input: ReferenceImagePromptInput): string => {
  const metadata = input.metadata || {};
  return uniqueFacts([
    cleanText(input.description, 4_000),
    suppliedPromptLooksCanonical(cleanText(input.prompt, 20_000))
      ? ''
      : cleanText(input.prompt, 4_000),
    ...selectedMetadataFacts(metadata, [
      ['description', 'visual_lock', 'visualLock'],
      ['story_function', 'storyFunction'],
      ['continuity_rules', 'continuityRules'],
      ['materials', 'material'],
      ['condition', 'state'],
    ]),
  ]).join(' ');
};

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const coverCompositions = [
  {
    id: 'dual-tension-diagonal',
    direction: 'Two principal characters in unequal scale, separated by a strong diagonal of negative space; their eyelines create unresolved dramatic tension.',
  },
  {
    id: 'intimate-portrait-symbol',
    direction: 'One emotionally charged close portrait dominates while one premise-defining physical symbol appears smaller but unmistakable in the lower depth plane.',
  },
  {
    id: 'environment-led-silhouette',
    direction: 'The recurring environment carries most of the composition; the protagonist is a smaller readable silhouette and the opposing force is implied through light or architecture.',
  },
  {
    id: 'foreground-secret-background-threat',
    direction: 'A sharp story-critical object or gesture anchors the foreground, a human face holds the middle plane, and the threat resolves in the distant background.',
  },
  {
    id: 'asymmetric-ensemble-pyramid',
    direction: 'Build an asymmetric three-level character hierarchy with one clear protagonist, one secondary relationship and one distant opposing presence; never a floating-head collage.',
  },
  {
    id: 'reflection-without-split-screen',
    direction: 'Use one physically plausible reflection in glass, rain, polished stone or a mirror to reveal the hidden conflict, while preserving one continuous photographed scene rather than split panels.',
  },
  {
    id: 'low-angle-power-reversal',
    direction: 'A restrained low-angle medium portrait suggests power, but a high-background clue visibly reverses who is actually in control.',
  },
  {
    id: 'quiet-negative-space-hook',
    direction: 'Use a single still figure pushed off-center with bold negative space, one specific trace of the central secret and an atmosphere of imminent consequence.',
  },
] as const;

const coverTypographySystems = [
  {
    id: 'condensed-uppercase-tension',
    direction: 'Tall condensed uppercase display lettering with disciplined tracking, a compact stacked lockup and one subtle custom cut tied to the premise.',
  },
  {
    id: 'prestige-high-contrast-serif',
    direction: 'A refined high-contrast prestige serif wordmark, mixed case, generous breathing room and one elegant ligature; dramatic rather than ornamental.',
  },
  {
    id: 'editorial-neo-grotesk',
    direction: 'A contemporary neo-grotesk wordmark in sentence case, firm weight contrast and an editorial line break selected for the title rhythm.',
  },
  {
    id: 'hand-rendered-emotional-mark',
    direction: 'A controlled hand-rendered title mark with human pressure variation, supported by a quiet clean sans accent; expressive but fully readable.',
  },
  {
    id: 'engraved-legacy-serif',
    direction: 'An engraved literary serif with restrained texture, compact capitals and subtle age or inheritance cues, without looking like a generic period template.',
  },
  {
    id: 'geometric-modern-thriller',
    direction: 'A geometric modern sans wordmark with one custom letterform, sharp scale contrast and precise alignment that suggests investigation or control.',
  },
  {
    id: 'distressed-physical-type',
    direction: 'Bold physical lettering with restrained ink, paper or weather wear derived from the story world; no generic grunge filter and no loss of legibility.',
  },
  {
    id: 'cinematic-wide-serif-sans',
    direction: 'A wide cinematic serif-and-sans hybrid lockup with a distinctive title break and measured horizontal expansion, designed for an intimate premium drama.',
  },
] as const;

const coverPaletteSystems = [
  {
    id: 'obsidian-amber',
    direction: 'deep neutral blacks, restrained amber practical light and natural skin color',
  },
  {
    id: 'storm-blue-warm-skin',
    direction: 'storm blue shadows, warm believable skin and one muted red-brown story accent',
  },
  {
    id: 'ivory-burgundy',
    direction: 'soft ivory highlights, dense burgundy accents and charcoal neutrals',
  },
  {
    id: 'rain-green-gold',
    direction: 'wet mineral greens, controlled old-gold practicals and neutral flesh tones',
  },
  {
    id: 'steel-lilac',
    direction: 'steel gray architecture, restrained lilac dusk and one warm human focal point',
  },
  {
    id: 'tobacco-cyan',
    direction: 'muted tobacco warmth against small physically motivated cyan reflections',
  },
  {
    id: 'paper-black-crimson',
    direction: 'near-black depth, tactile paper-white highlights and a sparse crimson narrative accent',
  },
  {
    id: 'natural-night-neon',
    direction: 'believable night exposure with one location-motivated neon family and protected natural skin',
  },
] as const;

const compileAppCoverPrompt = (
  input: ReferenceImagePromptInput,
): CompiledReferenceImagePrompt => {
  const metadata = input.metadata || {};
  const title = readableValue(metadataValue(metadata, [
    'series_title',
    'seriesTitle',
    'title',
  ]), 180) || cleanText(input.label, 180);
  const genre = readableValue(metadataValue(metadata, ['genre', 'subgenre']), 500);
  const logline = cleanText(input.description, 4_000)
    || readableValue(metadataValue(metadata, ['logline', 'description']), 4_000);
  const protagonist = readableValue(metadataValue(metadata, ['protagonist']), 1_000);
  const opposingForce = readableValue(metadataValue(metadata, [
    'opposing_force',
    'opposingForce',
    'antagonist',
  ]), 1_000);
  const centralQuestion = readableValue(metadataValue(metadata, [
    'central_question',
    'centralQuestion',
  ]), 1_500);
  const stakes = readableValue(metadataValue(metadata, ['stakes']), 1_500);
  const visualStyle = readableValue(metadataValue(metadata, [
    'visual_style',
    'visualStyle',
  ]), 1_000);
  const setting = readableValue(metadataValue(metadata, [
    'background',
    'setting',
  ]), 1_000);
  const trope = readableValue(metadataValue(metadata, ['trope']), 500);
  const characterAnchors = readableValue(metadataValue(metadata, [
    'character_anchors',
    'characterAnchors',
  ]), 4_000);
  const environmentAnchors = readableValue(metadataValue(metadata, [
    'environment_anchors',
    'environmentAnchors',
  ]), 3_000);
  const storyFacts = uniqueFacts([
    genre ? `Genre and tone: ${genre}.` : '',
    logline ? `Premise: ${logline}` : '',
    protagonist ? `Protagonist: ${protagonist}.` : '',
    opposingForce ? `Opposing force: ${opposingForce}.` : '',
    centralQuestion ? `Central dramatic question: ${centralQuestion}.` : '',
    stakes ? `Stakes: ${stakes}.` : '',
    visualStyle ? `Approved visual style: ${visualStyle}.` : '',
    setting ? `Setting: ${setting}.` : '',
    trope ? `Story engine: ${trope}.` : '',
  ]).join(' ');
  const seed = stableHash(`${title.toLocaleLowerCase('pt-BR')}|${genre.toLocaleLowerCase('pt-BR')}`);
  const composition = coverCompositions[seed % coverCompositions.length];
  const typography = coverTypographySystems[
    Math.floor(seed / coverCompositions.length) % coverTypographySystems.length
  ];
  const palette = coverPaletteSystems[
    Math.floor(seed / (coverCompositions.length * coverTypographySystems.length))
      % coverPaletteSystems.length
  ];

  return {
    prompt: `Create one original vertical 2:3 premium global-streaming series cover as polished,
photorealistic live-action key art with Netflix-level finish and small-card
readability, without copying any existing show poster, platform branding or trade
dress.

SERIES TITLE — render this exact title once and spell it correctly: “${title}”

APPROVED STORY FACTS — preserve the premise and do not invent a different genre:
${storyFacts || 'Use only the approved dramatic premise supplied for this series.'}

CANONICAL VISUAL ANCHORS — preserve these identities, wardrobe cues and recurring
world details instead of redesigning them: characters: ${characterAnchors || 'use the approved protagonist and opposing-force descriptions above'}; environments: ${environmentAnchors || 'use the approved story setting above'}.

COMPOSITION VARIANT — ${composition.id}: ${composition.direction}
TYPOGRAPHY VARIANT — ${typography.id}: ${typography.direction}
PALETTE VARIANT — ${palette.id}: ${palette.direction}.

Integrate the title as a designed wordmark inside the poster image, not as a UI
overlay. Give it intentional hierarchy, kerning and line breaks appropriate to
this exact title. Keep the complete wordmark and the main face or story action
inside a center-safe portrait area so both remain immediately readable at 130x200
and 68x92 catalog-card sizes. Typography must feel authored for this series; do
not default to the same generic bold white sans-serif used on every cover.

Photograph believable people and locations with plausible lens perspective,
physically motivated light, natural skin texture and asymmetry, individual hair,
real fabric and material response, restrained contrast, coherent shadows,
realistic depth and subtle sensor grain. Build one decisive dramatic promise, not
a synopsis collage. Preserve enough dark or quiet separation behind the title for
clean readability while keeping the image visually rich at full size.

Exactly one vertical cover, one continuous composition and the exact series title
once. No subtitle, episode number, billing block, platform logo, Netflix N,
unrelated logo, watermark, UI, device mockup, horizontal banner, duplicated face,
floating-head montage, misspelled text or extra readable words.`,
    promptContract: REFERENCE_IMAGE_PROMPT_CONTRACT,
    visualReferenceMode: 'premium_streaming_cover',
    promptMetadata: {
      assetRole: 'APP_COVER',
      targetField: 'Series.coverUrl',
      aspectRatio: '2:3 portrait',
      coverCompositionVariant: composition.id,
      coverTypographyVariant: typography.id,
      coverPaletteVariant: palette.id,
    },
  };
};

const explicitAge = (input: ReferenceImagePromptInput): number | undefined => {
  const metadata = input.metadata || {};
  const candidates = [
    metadataValue(metadata, ['age', 'age_range', 'ageRange']),
    input.description,
    input.prompt,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    const text = cleanText(candidate, 4_000);
    const match = text.match(/\b(\d{1,2})\s*(?:anos?|years?(?:\s+old)?)\b/i);
    if (match) return Number(match[1]);
  }
  return undefined;
};

const isExplicitMinor = (input: ReferenceImagePromptInput): boolean => {
  const age = explicitAge(input);
  if (age !== undefined) return age < 18;
  const facts = `${input.description || ''} ${input.prompt || ''} ${readableValue(input.metadata || {})}`
    .toLocaleLowerCase('pt-BR');
  return /\b(crian[cç]a|menino|menina|beb[eê]|child|kid|toddler|infantil)\b/i
    .test(facts);
};

const requestedCharacterMode = (
  input: ReferenceImagePromptInput,
): 'hybrid_face_compat' | 'standard_ultra_photoreal' => {
  if (isExplicitMinor(input)) return 'standard_ultra_photoreal';
  const rawMode = readableValue(metadataValue(input.metadata || {}, [
    'visual_reference_mode',
    'visualReferenceMode',
    'reference_mode',
    'referenceMode',
  ])).toLowerCase();
  if (rawMode.includes('standard') || rawMode.includes('normal')) {
    return 'standard_ultra_photoreal';
  }
  return 'hybrid_face_compat';
};

const compileHybridCharacterPrompt = (
  input: ReferenceImagePromptInput,
): string => {
  const name = cleanText(input.label, 180);
  const facts = characterFacts(input) || 'Use only the approved identity and wardrobe facts supplied for this character.';
  return `Create one clean horizontal 3:2 character identity sheet on an off-white
background for the original fictional adult character ${name}. Put the exact name
“${name}” once in large, correctly spelled, readable editorial type at the top,
centered across the complete sheet.

APPROVED CHARACTER FACTS — PRESERVE EXACTLY: ${facts}

LEFT 70% — THREE FULL-BODY TURNAROUND VIEWS: show exactly three believable,
unretouched, live-action color bodies at matching head-to-toe scale: (1)
straight-on front, (2) strict 90-degree side profile, and (3) direct back. Use the
same neutral stance, body proportions, complete outfit, accessories, colors and
materials in all three views. Keep both shoes fully inside the sheet. Necks below
the jaw, clothing, arms, hands, legs and footwear remain continuous photographic
images with no cracks, glass or missing areas. The back view must face completely
away and reveal no facial feature or facial profile; its back-of-head hair remains
a normal photorealistic photograph.

DRAWN HEADS ON FRONT AND SIDE BODIES: replace the complete visible head region in
the front and side views — face, ears, hairline and all head hair — with a clean,
unmistakably hand-drawn graphite-pencil or fine-ink illustration aligned naturally
to the photographic neck. The front body receives one frontal drawn head; the
side body receives one strict 90-degree-profile drawn head. Never show any
photographic face, photographic skin or photographic hair inside those two heads.
Do not break or fragment them. Use simple editorial drawing: confident outer
contours, light varied line pressure, simplified facial planes, open white paper
inside the head silhouette, minimal tonal buildup and sparse delicate hatching in
the hair and beneath the chin. Group hair into readable locks with few interior
strokes; keep most facial skin unshaded. Do not use dense scribbling, heavy
cross-hatching, hyperreal pencil shading, photographic gradients, a desaturated
photograph, digital airbrush or 3D rendering.

RIGHT 30% — LARGE BROKEN PHOTOGRAPHIC PORTRAIT: after one thin black vertical
divider, show one dominant, large, front-facing head-and-shoulders portrait of the
same character. It must be unmistakably photorealistic — a believable real
photograph taken on a professional camera in natural daylight — with natural skin
variation, stable asymmetry, realistic eyes, individual hair and flyaways,
restrained contrast, true-to-life color and subtle sensor grain. Use a simple
snowy or cold neutral outdoor background softened only by real camera depth, not
a glamour studio or cinematic-poster treatment.

THE RIGHT PORTRAIT IS THE ONLY SHATTERED ELEMENT: divide the COMPLETE VISIBLE
PHOTOGRAPHIC HEAD PORTRAIT — FACE PLUS ALL SURROUNDING HEAD HAIR — into EXACTLY
SIX large, physically disconnected, closed glass polygons. Together, the six
pieces must unmistakably reconstruct one aligned readable head: eyes/brow, nose,
cheeks, lips, chin, jaw, skin, hairline and outer hair silhouette. Every piece
carries substantial photographic face and/or hair content; never create
transparent empty panes, blank wedges or a hollow mask. Use exactly two upper
pieces, two middle pieces and two lower pieces — upper-left, upper-right,
middle-left, middle-right, lower-left and lower-right — around one empty
pure-white impact opening near the lower nose or mouth. There is NO central
seventh piece.

PURE-WHITE GAP CONTRACT: use broad clean gaps around 6-8% of the complete
head-portrait width and a central opening around 12-15%. Between all six pieces
show ONLY flat pure white #FFFFFF, completely empty. No face, hair, skin, body,
portrait continuation, texture, reflection, translucent glass or hidden intact
head may exist beneath or between the shards. Shadows may touch only the immediate
shard edge and must not fill or darken a gap. Each piece has its own complete thin
silver-gray perimeter; the pieces do not touch or share a center ring. No drawn
crack-line overlay, secondary cracks, small chips or internal subdivisions.

IDENTITY SOURCE CONTRACT: the large broken photograph on the right is the
canonical source for facial identity, skin, eyes and hair. The photographic
bodies on the left are the source for body proportions, outfit, colors,
accessories and materials. The two left drawings are only front/profile
orientation guides. Preserve the same identity, hairstyle, age, body and wardrobe
across every view.

Functional editorial reference only: exactly one character, exactly three
full-body turnaround views on the left plus one large broken photographic portrait
on the right, no extra faces, no thumbnail collage, no text besides ${name}, no
logo and no watermark. Any intact photographic face anywhere on the sheet is a
hard failure. Glass appears only on the large right portrait.`;
};

const compileStandardCharacterPrompt = (
  input: ReferenceImagePromptInput,
): string => {
  const name = cleanText(input.label, 180);
  const facts = characterFacts(input) || 'Use only the approved identity and wardrobe facts supplied for this character.';
  const minor = isExplicitMinor(input);
  const subject = minor
    ? 'original fictional child character'
    : 'original fictional adult character';
  const childSafety = minor
    ? ' Keep wardrobe, pose and presentation strictly age-appropriate, ordinary and non-sexualized.'
    : '';
  return `Create one horizontal 3:2 identity sheet for ${name}, an ${subject}, as believable,
unretouched live-action casting photography on a neutral off-white background.
APPROVED CHARACTER FACTS — PRESERVE EXACTLY: ${facts}${childSafety}
Include full-body front, strict 90-degree side and direct back views plus face
front and strict side profile, all unmistakably the same person. Natural exposure,
plausible 50-85mm portrait perspective for face views, 35-50mm perspective for
body views, one broad window-like key light with simple neutral bounce, natural
white balance, restrained contrast and subtle sensor grain. Preserve natural
skin-tone variation, pores at the correct viewing distance, fine facial hair,
slight stable asymmetry, realistic non-identical eye catchlights, natural sclera
and teeth, flyaway hair, fabric weave, seams, folds, pilling and ordinary wear.
Use a relaxed non-model posture and a specific eyeline, not a glossy fashion pose.
Functional casting continuity reference, not a beauty campaign. No waxy skin,
face-perfecting retouch, random rim light, extreme bokeh, CGI/render look, extra
people, logo or watermark.`;
};

const compileLocationPrompt = (input: ReferenceImagePromptInput): string => {
  const metadata = input.metadata || {};
  const label = cleanText(input.label, 180);
  const facts = locationFacts(input) || 'Use only the approved environment facts supplied for this location.';
  const anchors = readableValue(metadataValue(metadata, [
    'permanent_elements',
    'permanentElements',
    'recurring_anchors',
    'recurringAnchors',
    'layout_lock',
    'layoutLock',
  ])) || 'the fixed architectural elements and recurring objects named in the approved facts';
  const lighting = readableValue(metadataValue(metadata, [
    'lighting_contract',
    'lightingContract',
    'lighting',
  ])) || 'one physically motivated daylight or practical source appropriate to the approved location';
  const timeAndWeather = readableValue(metadataValue(metadata, [
    'time_and_weather',
    'timeWeather',
    'weather',
    'time_of_day',
    'timeOfDay',
  ])) || 'the time and weather implied by the approved location facts';
  const cameraPosition = readableValue(metadataValue(metadata, [
    'camera_position',
    'cameraPosition',
    'viewpoint',
  ])) || 'a wide eye-level corner viewpoint that clearly reveals the usable spatial layout';

  return `Create one canonical landscape 16:9 believable real location-scout photograph for ${label}.
APPROVED LOCATION FACTS — PRESERVE EXACTLY: ${facts}
Show ${timeAndWeather}, viewed from ${cameraPosition} with a plausible 24-35mm
lens and natural exposure. Physically motivated light follows this approved
lighting contract: ${lighting}. Use believable bounce from the actual dominant
surfaces. Preserve recurring anchors and closed topology: ${anchors}. Do not add
doors, windows, corridors, furniture, machines, props or mechanisms that are not
supported by the approved facts.

Make the place lived-in and physically specific: coherent architecture and scale;
material variation; scuffs, dust, fingerprints, irregular object spacing, paper
curl, cable slack and small maintenance marks where appropriate; realistic
glass, metal, wood, painted wall and fabric response; contact shadows and
reflections that agree with camera and light; foreground occlusion, readable
midground geography, background anchors and subtle atmospheric depth. Use a
restrained natural color grade, gentle sensor grain and believable highlight
roll-off. No pristine procedural surfaces, concept-art staging, excessive bloom,
impossible reflections, warped architecture, floating clutter, extreme bokeh,
orange-teal advertising grade, CGI/game-render look, logo or watermark. Exactly
one real recurring physical environment and one canonical wide master image, not
an alternate-angle collage or storyboard.`;
};

const compilePropPrompt = (input: ReferenceImagePromptInput): string => {
  const metadata = input.metadata || {};
  const label = cleanText(input.label, 180);
  const facts = propFacts(input) || 'Use only the approved object facts supplied for this prop.';
  const materials = readableValue(metadataValue(metadata, [
    'materials',
    'material',
    'visual_lock',
    'visualLock',
  ])) || 'the materials explicitly implied by the approved prop facts';
  const storyFunction = readableValue(metadataValue(metadata, [
    'story_function',
    'storyFunction',
    'function',
  ])) || 'its approved recurring story function';

  return `Create one landscape 3:2 photorealistic canonical prop continuity
photograph for ${label}, captured as a real physical object rather than a CGI
product render. APPROVED PROP FACTS — PRESERVE EXACTLY: ${facts}
Its story function is ${storyFunction}. Preserve exact silhouette, proportions,
colors, construction, controls, seams, closures, distinctive marks and materials:
${materials}. Show the complete object in one dominant three-quarter view with a
neutral functional placement that makes scale and contact believable. Use a
plausible 50-85mm product-documentation perspective, natural exposure and one
physically motivated soft key with simple environmental bounce. Render
material-specific roughness, fine wear, fingerprints, scuffs, dust in creases,
edge wear and manufacturing tolerances only where appropriate. Keep every story-
critical detail readable without invented labels or decorations. Restrained
natural color, gentle sensor grain, realistic contact shadow and no impossible
reflection. Exactly one object identity; no hands or people unless the approved
facts require them, no duplicate object, exploded view, fantasy redesign,
floating product, pristine CGI surface, advertising gloss, unrelated text, logo
or watermark.`;
};

export const compileReferenceImagePrompt = (
  input: ReferenceImagePromptInput,
): CompiledReferenceImagePrompt => {
  const suppliedPrompt = cleanText(input.prompt, 20_000);
  const category = cleanText(input.category, 120).toUpperCase();
  const isAppCover = category === 'APP_COVER';
  const isCharacter = category.includes('CHARACTER')
    || category.includes('OPPOSING_FORCE');
  const isProp = category.includes('PROP') || category.includes('OBJECT');

  if (isAppCover) {
    return compileAppCoverPrompt(input);
  }

  if (isCharacter) {
    const canonicalPrompt = suppliedPromptLooksCanonical(suppliedPrompt);
    const visualReferenceMode = canonicalPrompt
      ? suppliedPrompt.toLowerCase().includes('left 70%')
        ? 'hybrid_face_compat'
        : 'standard_ultra_photoreal'
      : requestedCharacterMode(input);
    return {
      prompt: canonicalPrompt
        ? suppliedPrompt
        : visualReferenceMode === 'hybrid_face_compat'
          ? compileHybridCharacterPrompt(input)
          : compileStandardCharacterPrompt(input),
      promptContract: REFERENCE_IMAGE_PROMPT_CONTRACT,
      visualReferenceMode,
    };
  }

  if (isProp) {
    return {
      prompt: suppliedPromptLooksCanonical(suppliedPrompt)
        ? suppliedPrompt
        : compilePropPrompt(input),
      promptContract: REFERENCE_IMAGE_PROMPT_CONTRACT,
      visualReferenceMode: 'ultra_photoreal_prop',
    };
  }

  return {
    prompt: suppliedPromptLooksCanonical(suppliedPrompt)
      ? suppliedPrompt
      : compileLocationPrompt(input),
    promptContract: REFERENCE_IMAGE_PROMPT_CONTRACT,
    visualReferenceMode: 'ultra_photoreal_location',
  };
};

export default compileReferenceImagePrompt;
