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
      ['origin', 'country', 'nationality', 'ancestry', 'ethnicity', 'pais', 'origem'],
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

const faceAttractivenessRegisters = [
  {
    id: 'lead_camera_beauty',
    direction: 'A vertical-drama GALÃ / GATA: extremely attractive on a 9:16 phone screen, the kind of face and body a DramaBox/ReelShort lead is cast for. High-camera beauty, healthy glow, magnetic presence. Attractiveness comes from THIS specific bone structure, not from a cloned runway/Instagram model. Still very pretty or handsome — just a different beautiful person from every other series. Skin even and camera-ready, restrained pores, no fatigue, no scars, no crooked teeth, no broken nose, no receding chin. Think leading actor, not catalog extra and not a beauty-filter twin.',
  },
  {
    id: 'attractive_distinctive',
    direction: 'This person is clearly good-looking because the story needs it, with THIS specific bone structure rather than a smoothed generic beauty-filter face.',
  },
  {
    id: 'striking_irregular',
    direction: 'Striking and memorable. Magnetic because the features are irregular and specific. Do not default this supporting role into a lead-model look unless the approved facts already say they are a galã.',
  },
  {
    id: 'ordinary_real',
    direction: 'An ordinary real person from a casting room. Healthy and camera-ready, but not especially pretty or handsome. Only use this when the approved facts ask for a common, non-lead face.',
  },
  {
    id: 'lived_in',
    direction: 'A lived-in face with life on the surface: pores, slight fatigue, natural lines appropriate to age. Interesting rather than pretty. Use only when the approved facts ask for it.',
  },
  {
    id: 'story_as_written',
    direction: 'Cast this supporting character exactly as the approved facts describe. They may be beautiful or ordinary depending on the series. Do not upgrade them into a protagonist-galã and do not downgrade them into an unattractive extra.',
  },
] as const;

const supportingAttractivenessRegisters = faceAttractivenessRegisters.filter(
  (item) => item.id !== 'lead_camera_beauty',
);

const leadFaceGeometries = [
  {
    id: 'heart-wide-set-almond',
    direction: 'Heart-shaped photogenic face, wide-set large almond eyes, high defined cheekbones, short refined nose with a softly rounded tip, full Cupid’s bow and a slim complete jaw with a slightly pointed chin. Camera-beautiful and immediately specific, not a stock oval.',
  },
  {
    id: 'oval-high-cheek-straight-nose',
    direction: 'Balanced oval with slightly high cheekbones, a straight narrow elegant nose, medium-full lips, clean jaw, short refined philtrum and softly arched even brows. Lead-actor beauty whose identity lives in the cheek plane and nose silhouette.',
  },
  {
    id: 'diamond-full-mouth',
    direction: 'Diamond face, prominent sculpted cheekbones, slightly narrow forehead, full lower lip, straight elegant nose and elongated almond eyes. Pretty or handsome in a carved, recognizable way.',
  },
  {
    id: 'long-elegant-deep-set',
    direction: 'Longer elegant face, deep-set eyes, high straight nose without a bump, defined but not bulky jaw, longer neck and a calm camera-ready mouth. Attractive like a specific leading actor, never a damaged or average face.',
  },
  {
    id: 'square-clean-handsome',
    direction: 'Photogenic square face, even wide-set eyes, straight medium-width nose, full brows, strong clean jaw and a proportionate chin. Leading-man or strong-lead geometry: handsome, specific and unscarred.',
  },
  {
    id: 'inverted-triangle-large-eyes',
    direction: 'Inverted-triangle silhouette with a broader forehead, large slightly upturned eyes, delicate tapered jaw, small straight nose and a short philtrum. Youthful lead beauty with a unique eye-to-jaw ratio.',
  },
] as const;

const leadHairColors = [
  {
    id: 'copper-red',
    direction: 'natural copper-red / ruiva hair with visible root variation, never plastic dyed-red',
  },
  {
    id: 'honey-blonde',
    direction: 'honey or dark-blonde hair, never platinum Instagram blonde',
  },
  {
    id: 'warm-brunette',
    direction: 'warm chestnut-brunette / morena hair with natural depth',
  },
  {
    id: 'deep-black',
    direction: 'deep black hair with a natural sheen, not blue-black wig shine',
  },
  {
    id: 'caramel-morena',
    direction: 'caramel-brown morena hair with a few sunlit strands',
  },
  {
    id: 'ash-brown',
    direction: 'cool ash-brown hair, distinct from warm brunette and from black',
  },
] as const;

const leadHairTextures = [
  {
    id: 'long-straight',
    direction: 'long straight hair with a clean fall and a few flyaways',
  },
  {
    id: 'shoulder-wavy',
    direction: 'shoulder-length wavy hair with an irregular, person-specific wave',
  },
  {
    id: 'loose-curls',
    direction: 'loose defined curls, not a generic curl filter or afro default',
  },
  {
    id: 'short-textured',
    direction: 'short textured cut that still reads glamorous on camera',
  },
  {
    id: 'long-waves',
    direction: 'long soft waves with weight at the ends',
  },
  {
    id: 'crop-or-pixie',
    direction: 'a confident short crop or pixie, attractive and specific',
  },
] as const;

const leadBodies = [
  {
    id: 'lean-fitness',
    direction: 'lean fitness body, visible healthy tone without bodybuilder bulk',
  },
  {
    id: 'athletic-shoulders',
    direction: 'athletic shoulders, defined waist, camera-fit leading-actor body',
  },
  {
    id: 'runner-lean',
    direction: 'runner-lean frame with long lines, healthy rather than starved',
  },
  {
    id: 'soft-fit',
    direction: 'soft-fit galã body: attractive, healthy, not a gym advertisement',
  },
] as const;

const cinematicPresences = [
  {
    id: 'ice-glass',
    direction: 'ICE-GLASS presence, the method of prestige K-drama and boardroom thrillers: stillness, high grooming, cool appraisal in the eyes, almost no wasted motion. Extremely attractive. Power happens in the face before dialogue. Never a copied celebrity.',
  },
  {
    id: 'sun-heat',
    direction: 'SUN-HEAT presence, the method of Latin and Mediterranean romantic leads: warm skin, strong brows, a mouth that reads on a phone, heat in the gaze. Telenovela-lead magnetism without cloning any star.',
  },
  {
    id: 'quiet-old-money',
    direction: 'QUIET OLD-MONEY presence, the method of prestige family sagas: unhurried face, understated grooming, wealth in posture and fabric rather than logos. Attractive because they look born to rooms other people enter nervously.',
  },
  {
    id: 'street-voltage',
    direction: 'STREET-VOLTAGE presence, the method of youthful streaming leads: slightly lived hair, alert eyes, a body that looks mid-decision. Sexy because they are awake, not because they are a catalog mannequin.',
  },
  {
    id: 'regal-bone',
    direction: 'REGAL-BONE presence, the method of diaspora prestige leads: sculpted cheekbones, proud carriage, a face that holds a huge close-up. Beauty reads as lineage and gravity, never as a beauty-filter oval.',
  },
  {
    id: 'soft-devastating',
    direction: 'SOFT-DEVASTATING presence, the method of underestimated romantic leads: gentler features that become lethal in a held stare. The viewer should want to protect them and fear them in the same close-up.',
  },
] as const;

type HairPresentation = 'femme' | 'masc' | 'unspecified';

const hairSilhouettes: ReadonlyArray<{
  id: string;
  presentation: readonly HairPresentation[];
  direction: string;
}> = [
  {
    id: 'center-part-curtain',
    presentation: ['femme', 'unspecified'],
    direction: 'center-part curtain hair in two specific wings, readable from behind; never a generic blowout',
  },
  {
    id: 'sharp-jaw-bob',
    presentation: ['femme'],
    direction: 'a sharp jaw-length bob with a precise nape; the back of the head is a graphic shape',
  },
  {
    id: 'long-one-weight',
    presentation: ['femme', 'unspecified'],
    direction: 'long hair with one heavy weight, usually over the left shoulder, never symmetrically fluffed',
  },
  {
    id: 'severe-low-bun',
    presentation: ['femme', 'unspecified'],
    direction: 'a severe low bun or knot, clean nape, at most one controlled tendril',
  },
  {
    id: 'sculpted-high-pony',
    presentation: ['femme'],
    direction: 'a sculpted high pony or slicked crown with volume only at the tail',
  },
  {
    id: 'halo-coils',
    presentation: ['femme', 'masc', 'unspecified'],
    direction: 'defined coils or twists with a specific hairline; never a generic afro blur',
  },
  {
    id: 'glam-pixie',
    presentation: ['femme'],
    direction: 'a glamorous pixie or crop that exposes ears and nape',
  },
  {
    id: 'wolf-layers',
    presentation: ['femme'],
    direction: 'wolf-cut layers with a distinct shaggy outline from behind',
  },
  {
    id: 'slicked-power',
    presentation: ['masc', 'unspecified'],
    direction: 'slicked or wet-look pushback with a hard hairline; a power silhouette from front and back',
  },
  {
    id: 'textured-crop',
    presentation: ['masc', 'unspecified'],
    direction: 'short textured crop, volume on top, tight sides, a specific crown swirl',
  },
  {
    id: 'short-fade',
    presentation: ['masc'],
    direction: 'a clean fade with a designed hairline and slightly longer textured top',
  },
  {
    id: 'masc-curtain',
    presentation: ['masc'],
    direction: 'medium curtain / 90s sweep off the forehead, not a mullet unless already named',
  },
  {
    id: 'longer-swept',
    presentation: ['masc', 'unspecified'],
    direction: 'slightly longer than a crop, swept off the forehead, romantic without looking unwashed',
  },
];

const wardrobeLanes = [
  {
    id: 'quiet-black-tailoring',
    direction: 'quiet black or charcoal tailoring, no logos, expensive-looking cloth — this character owns the black-suit lane',
  },
  {
    id: 'ivory-old-money',
    direction: 'ivory, camel or cream knits and coats; an old-money light palette',
  },
  {
    id: 'blood-accent',
    direction: 'neutral clothes plus ONE recurring blood-red item (lip, scarf, lining, heels or tie)',
  },
  {
    id: 'navy-authority',
    direction: 'ink navy as the owned color: coat, knit or dress, never generic office blue',
  },
  {
    id: 'street-leather',
    direction: 'worn black or brown leather jacket as the silhouette, not fashion-campaign leather',
  },
  {
    id: 'clinical-white',
    direction: 'a recurring white shirt, coat or uniformly clean piece that reads as control or profession',
  },
  {
    id: 'earth-warm',
    direction: 'olive, terracotta or tobacco — a warm earth lane no other speaking character should copy',
  },
  {
    id: 'jewel-green',
    direction: 'one jewel-green garment or lining as the signature color, otherwise restrained',
  },
] as const;

const phoneScreenHooks = [
  {
    id: 'thin-metal-glasses',
    direction: 'thin metal glasses in EVERY view, including the back (temples visible). They are part of the face, not optional.',
  },
  {
    id: 'left-ear-cuff',
    direction: 'a small silver ear cuff only on the left ear, visible in front and profile',
  },
  {
    id: 'never-removed-watch',
    direction: 'one specific watch always on the left wrist, readable in full-body views',
  },
  {
    id: 'gold-collar-necklace',
    direction: 'a short gold necklace sitting at the collarbone in every clothed view',
  },
  {
    id: 'signature-outerwear',
    direction: 'the same distinctive outer layer in all three turnaround views; this is their costume, not generic wardrobe',
  },
  {
    id: 'asymmetric-part',
    direction: 'a hard far-left or far-right hair part that never returns to center',
  },
  {
    id: 'one-ring',
    direction: 'one specific ring always on the right hand, never omitted in front views',
  },
  {
    id: 'grooming-signature',
    direction: 'a grooming signature readable at phone scale: either a defined dark lip if makeup is plausible, or unusually sharp groomed brows',
  },
] as const;

const leadContradictions = [
  {
    id: 'stubborn-cowlick',
    direction: 'a stubborn cowlick at the front hairline that grooming never fully kills — still a galã',
  },
  {
    id: 'strong-pretty-nose',
    direction: 'a slightly stronger, characterful nose that remains beautiful on camera (not broken, not crooked)',
  },
  {
    id: 'scholar-glasses',
    direction: 'thin glasses on an extremely attractive face, like a prestige lead who thinks for a living',
  },
  {
    id: 'one-loose-tendril',
    direction: 'even when hair is controlled, one specific tendril always escapes near the left temple',
  },
  {
    id: 'charm-gap',
    direction: 'a tiny natural gap between the upper front teeth, charming and camera-pretty, never chipped or damaged',
  },
  {
    id: 'visible-pretty-ears',
    direction: 'ears that sit slightly high and are often visible — a specific pretty silhouette, not jug ears',
  },
] as const;

const originPackages = [
  {
    id: 'south-korea',
    country: 'South Korea',
    direction: 'South Korean adult: light-to-medium warm East Asian skin, dark brown-black hair, monolid or soft inner crease, modest nasal bridge, oval-to-heart face. First and family names must be Korean.',
  },
  {
    id: 'japan',
    country: 'Japan',
    direction: 'Japanese adult: fair-to-light olive East Asian skin, black or dark brown hair, straight-to-soft-wave texture, narrower midface, refined jaw. Names must be Japanese.',
  },
  {
    id: 'china',
    country: 'China',
    direction: 'Chinese adult: light-to-medium East Asian skin, black hair, defined brow, broader cheek plane, dark brown eyes. Names must be Chinese.',
  },
  {
    id: 'philippines',
    country: 'Philippines',
    direction: 'Filipino adult: medium warm brown skin, dark brown eyes, black hair that can be straight or softly waved, fuller midface. Names must be Filipino/Spanish-Filipino.',
  },
  {
    id: 'mexico',
    country: 'Mexico',
    direction: 'Mexican adult: medium-to-deep warm brown skin, dark brown eyes, black or dark brown hair, strong brows. Names must be Mexican Spanish.',
  },
  {
    id: 'colombia',
    country: 'Colombia',
    direction: 'Colombian adult: warm olive-to-brown skin, dark eyes, dark hair, defined brows. Names must be Colombian Spanish.',
  },
  {
    id: 'argentina',
    country: 'Argentina',
    direction: 'Argentine adult: light olive or fair Southern-European skin, brown or hazel eyes, dark or chestnut hair. Names must be Argentine Spanish or Italian-Argentine.',
  },
  {
    id: 'nigeria',
    country: 'Nigeria',
    direction: 'Nigerian adult: deep rich brown skin, dark brown eyes, black hair with tight coils or a defined short cut, fuller lips, strong cheekbones. Names must be Nigerian (Yoruba, Igbo or Hausa).',
  },
  {
    id: 'ethiopia',
    country: 'Ethiopia',
    direction: 'Ethiopian adult: warm deep brown to reddish-brown skin, dark eyes, black hair with tight texture, longer oval face. Names must be Ethiopian.',
  },
  {
    id: 'italy',
    country: 'Italy',
    direction: 'Italian adult: olive to light-tan Mediterranean skin, dark brown eyes, dark or chestnut hair, defined brows. Names must be Italian.',
  },
  {
    id: 'france',
    country: 'France',
    direction: 'French adult: fair-to-light olive skin, brown or hazel eyes, brown hair that may be straight or wavy. Names must be French.',
  },
  {
    id: 'spain',
    country: 'Spain',
    direction: 'Spanish adult: olive-to-tan skin, dark brown eyes, dark hair, strong brows. Names must be Spanish.',
  },
  {
    id: 'portugal',
    country: 'Portugal',
    direction: 'Portuguese adult: light olive to tan skin, brown eyes, dark brown hair. Names must be Portuguese — not Brazilian copies of Silva/Costa.',
  },
  {
    id: 'turkey',
    country: 'Turkey',
    direction: 'Turkish adult: olive-to-light-tan West Asian skin, dark brown eyes, dark hair, defined brows, slightly aquiline nose allowed if still attractive. Names must be Turkish.',
  },
  {
    id: 'lebanon',
    country: 'Lebanon',
    direction: 'Lebanese adult: olive Mediterranean-West-Asian skin, dark eyes, dark hair, high brows. Names must be Lebanese/Arabic.',
  },
  {
    id: 'india',
    country: 'India',
    direction: 'Indian adult: medium-to-deep warm brown skin, dark brown eyes, black hair (straight, wavy or a defined short cut). Names must be Indian.',
  },
  {
    id: 'sweden',
    country: 'Sweden',
    direction: 'Swedish adult: fair Northern-European skin, blue or gray-green eyes, blonde-to-ash-brown hair. Names must be Swedish.',
  },
  {
    id: 'usa',
    country: 'United States',
    direction: 'Black American adult: medium-to-deep brown skin, dark brown eyes, black hair in coils, waves or a short textured cut. Names must be African-American given/family names, not Brazilian.',
  },
  {
    id: 'brazil',
    country: 'Brazil',
    direction: 'Brazilian adult mixed ancestry: caramel-to-olive skin, dark or green-hazel eyes, brown or black hair. Use Brazil only as one option among many, never as the silent default.',
  },
  {
    id: 'uk',
    country: 'United Kingdom',
    direction: 'British adult: fair-to-light olive Northern/Western-European skin, blue, green, hazel or brown eyes, hair from ash-blonde to dark brown. Names must be British, not Brazilian.',
  },
  {
    id: 'germany',
    country: 'Germany',
    direction: 'German adult: fair-to-light Central-European skin, blue, gray or brown eyes, ash-blonde to dark brown hair. Names must be German.',
  },
  {
    id: 'thailand',
    country: 'Thailand',
    direction: 'Thai adult: light-to-medium warm Southeast-Asian skin, dark brown eyes, black hair, softly rounded midface. Names must be Thai.',
  },
  {
    id: 'egypt',
    country: 'Egypt',
    direction: 'Egyptian adult: olive-to-warm-brown North-African skin, dark eyes, dark hair, defined brows. Names must be Egyptian/Arabic.',
  },
  {
    id: 'greece',
    country: 'Greece',
    direction: 'Greek adult: olive Mediterranean skin, dark brown or green-hazel eyes, dark or chestnut hair. Names must be Greek.',
  },
  {
    id: 'ireland',
    country: 'Ireland',
    direction: 'Irish adult: fair skin that can freckle, green, blue or hazel eyes, hair from copper-red to dark brown. Names must be Irish.',
  },
] as const;

const originHairColorIds: Record<string, readonly string[]> = {
  'south-korea': ['deep-black', 'warm-brunette', 'ash-brown', 'honey-blonde'],
  japan: ['deep-black', 'warm-brunette', 'ash-brown'],
  china: ['deep-black', 'warm-brunette'],
  philippines: ['deep-black', 'warm-brunette', 'caramel-morena'],
  mexico: ['deep-black', 'warm-brunette', 'caramel-morena', 'copper-red'],
  colombia: ['deep-black', 'warm-brunette', 'caramel-morena'],
  argentina: ['warm-brunette', 'honey-blonde', 'ash-brown', 'copper-red', 'deep-black'],
  nigeria: ['deep-black', 'warm-brunette'],
  ethiopia: ['deep-black', 'warm-brunette'],
  italy: ['warm-brunette', 'deep-black', 'caramel-morena', 'honey-blonde'],
  france: ['ash-brown', 'honey-blonde', 'warm-brunette', 'copper-red'],
  spain: ['deep-black', 'warm-brunette', 'caramel-morena'],
  portugal: ['deep-black', 'warm-brunette', 'caramel-morena'],
  turkey: ['deep-black', 'warm-brunette', 'ash-brown'],
  lebanon: ['deep-black', 'warm-brunette', 'honey-blonde'],
  india: ['deep-black', 'warm-brunette', 'caramel-morena'],
  sweden: ['honey-blonde', 'ash-brown', 'copper-red'],
  usa: ['deep-black', 'warm-brunette', 'caramel-morena'],
  brazil: ['copper-red', 'honey-blonde', 'warm-brunette', 'deep-black', 'caramel-morena', 'ash-brown'],
  uk: ['honey-blonde', 'ash-brown', 'copper-red', 'warm-brunette'],
  germany: ['ash-brown', 'honey-blonde', 'warm-brunette'],
  thailand: ['deep-black', 'warm-brunette'],
  egypt: ['deep-black', 'warm-brunette'],
  greece: ['warm-brunette', 'deep-black', 'honey-blonde'],
  ireland: ['copper-red', 'honey-blonde', 'ash-brown', 'warm-brunette'],
};

const originAliasMatchers: Array<[(typeof originPackages)[number]['id'], RegExp]> = [
  ['south-korea', /\b(corean[oa]?|korean)\b/i],
  ['japan', /\b(japon[eê]s[oa]?|japanese)\b/i],
  ['china', /\b(chines[aeoa]?|chinese)\b/i],
  ['philippines', /\b(filipin[oa]?)\b/i],
  ['mexico', /\b(mexican[oa]?)\b/i],
  ['colombia', /\b(colombian[oa]?)\b/i],
  ['argentina', /\b(argentin[oa]?)\b/i],
  ['nigeria', /\b(nigerian[oa]?)\b/i],
  ['ethiopia', /\b(et[ií]ope|ethiopian)\b/i],
  ['italy', /\b(italian[oa]?)\b/i],
  ['france', /\b(frances[aeoa]?|french)\b/i],
  ['spain', /\b(espanhol[oa]?|spanish)\b/i],
  ['portugal', /\b(portugu[eê]s[oa]?)\b/i],
  ['turkey', /\b(turkish|turc[oa])\b/i],
  ['lebanon', /\b(liban[eê]s[oa]?|lebanese)\b/i],
  ['india', /\b(indian[oa]?)\b/i],
  ['sweden', /\b(suec[oa]?|swedish)\b/i],
  ['usa', /\b(estadunidense|united states|black american)\b/i],
  ['brazil', /\b(brasileir[oa]?|brazilian)\b/i],
  ['uk', /\b(brit[aâ]nic[oa]?|british|ingl[eê]s[ea]?|united kingdom)\b/i],
  ['germany', /\b(alem[aã][oa]?|german)\b/i],
  ['thailand', /\b(tailand[eê]s[oa]?|thai)\b/i],
  ['egypt', /\b(eg[ií]pci[oa]?|egyptian)\b/i],
  ['greece', /\b(greg[oa]?|greek)\b/i],
  ['ireland', /\b(irland[eê]s[oa]?|irish)\b/i],
];

const namedOriginId = (
  facts: string,
): (typeof originPackages)[number]['id'] | undefined => {
  const text = facts.toLocaleLowerCase('pt-BR');
  for (const pack of originPackages) {
    if (text.includes(pack.country.toLowerCase())) return pack.id;
  }
  for (const [id, matcher] of originAliasMatchers) {
    if (matcher.test(text)) return id;
  }
  return undefined;
};

const hasNamedOrigin = (facts: string): boolean =>
  Boolean(namedOriginId(facts))
  || /\b(origem\s*:|nascid[oa] em|pais de origem|país de origem)\b/i.test(facts);

const hasNamedHairColor = (facts: string): boolean =>
  /\b(ruiv[oa]|loir[oa]|blond|redhead|brunette|moren[oa]|castanh[oa]|cabelo (preto|preta|castanho|loiro|ruivo|vermelho)|black hair|platinad|honey-blonde|copper)\b/i
    .test(facts);

const hasNamedHairTexture = (facts: string): boolean =>
  /\b(liso|ondulad[oa]|cachead[oa]|crespo|pixie|curto|longo|straight hair|wavy|curly|buzzed|raspado|bob|coque|bun|pony|fade|undercut|slicked|repicad|wolf[- ]cut|franja|curtain)\b/i
    .test(facts);

const hasNamedBody = (facts: string): boolean =>
  /\b(fitness|atl[eé]tic|sarad[oa]|magr[oa]|plus[- ]size|corpo (fit|definido|esbelto)|broad[- ]shoulder|runner)\b/i
    .test(facts);

const hasNamedWardrobe = (facts: string): boolean =>
  /\b(terno|blazer|vestido|jaqueta|leather|couro|uniforme|scrubs|kimono|hanbok|sari|hijab|gravata|scarf|casaco|trench|tweed)\b/i
    .test(facts);

const inferPresentation = (input: ReferenceImagePromptInput): HairPresentation => {
  const role = readableValue(metadataValue(input.metadata || {}, [
    'role',
    'gender',
    'sexo',
    'presentation',
  ]));
  const text = `${role} ${characterFacts(input)}`.toLocaleLowerCase('pt-BR');
  if (/\b(mulher|moça|rapariga|heroína|atriz|gata|feminina|she\/her|female|woman|girl)\b/i.test(text)) {
    return 'femme';
  }
  if (/\b(homem|rapaz|herói|ator|galã|masculin|he\/him|male|man|boy)\b/i.test(text)) {
    return 'masc';
  }
  return 'unspecified';
};

const pickHashed = <T>(items: ReadonlyArray<T>, seed: number, salt: number): T =>
  items[Math.floor(seed / salt) % items.length];

const hairColorsForOrigin = (originId: string | undefined) => {
  if (!originId) return leadHairColors;
  const allowed = originHairColorIds[originId];
  if (!allowed) return leadHairColors;
  const filtered = leadHairColors.filter((item) => allowed.includes(item.id));
  return filtered.length ? filtered : leadHairColors;
};

const silhouettesForPresentation = (presentation: HairPresentation) => {
  const filtered = hairSilhouettes.filter((item) => {
    if (presentation === 'unspecified') {
      return item.presentation.includes('unspecified');
    }
    return item.presentation.includes(presentation)
      || item.presentation.includes('unspecified');
  });
  return filtered.length ? filtered : hairSilhouettes;
};

const faceGeometries = [
  {
    id: 'long-narrow-dorsal-bump',
    direction: 'Long rectangular face, high forehead, slightly close-set deep-set eyes, long straight nose with a small dorsal bump, thin lips, softly undefined jaw and a long lower third.',
  },
  {
    id: 'broad-square-wide-set',
    direction: 'Broad square face, low hairline, wide-set rounder eyes, short wide nose with a rounded tip, full mouth, strong gonial angle and a short thick neck.',
  },
  {
    id: 'heart-hooded-pointed-chin',
    direction: 'Heart-shaped face, wide temples, pointed chin, large hooded eyes, small slightly upturned nose, high uneven brows and a receding chin.',
  },
  {
    id: 'round-soft-off-center-nose',
    direction: 'Round soft face, full cheeks, short midface, a slightly off-center nose with a soft bulb, sparse outer brows, a hint of gummy smile and a soft under-chin even at healthy weight.',
  },
  {
    id: 'diamond-aquiline-downturned',
    direction: 'Diamond face, high sharp cheekbones, narrow forehead, tapering jaw, downturned almond eyes, aquiline nose and a thin upper lip over a fuller lower lip.',
  },
  {
    id: 'inverted-triangle-long-philtrum',
    direction: 'Inverted-triangle face, broad forehead, narrow jaw, slightly prominent ears, long philtrum, flatter nasal bridge and heavy straight brows.',
  },
  {
    id: 'oval-offset-asymmetry',
    direction: 'Oval envelope, but not a stock oval: crooked nasal septum, one eyelid more hooded than the other, off-center cupid’s bow and a stronger left jaw than right.',
  },
  {
    id: 'compact-heavy-brow-wide-alar',
    direction: 'Compact face, short lower third, wide alar base, thick brows that nearly meet, smallish eyes, a hint of nasolabial fold and a strong chin button.',
  },
] as const;

const leadFaceLandmarks = [
  {
    id: 'beauty-mole-near-lip',
    direction: 'a tiny dark beauty mark about 8 mm left of the mouth corner, elegant and present in every view, never a scar',
  },
  {
    id: 'right-resting-dimple',
    direction: 'a shallow dimple only on the right cheek, visible even at rest',
  },
  {
    id: 'faint-bridge-freckles',
    direction: 'a faint pretty dusting of freckles only across the nose bridge, never heavy sun damage',
  },
  {
    id: 'higher-left-brow-arch',
    direction: 'the left brow arch sits 1-2 mm higher than the right, a subtle identity cue without looking injured',
  },
  {
    id: 'widow-peak-hairline',
    direction: 'a soft widow’s-peak hairline that stays identical in every view',
  },
  {
    id: 'inner-corner-beauty-mark',
    direction: 'a pin-prick beauty mark just below the inner corner of the left eye',
  },
] as const;

const faceLandmarks = [
  {
    id: 'mole-left-of-mouth',
    direction: 'a small dark mole about 1 cm left of the mouth corner, present in every view',
  },
  {
    id: 'faint-brow-scar',
    direction: 'a faint pale linear scar breaking the right eyebrow, never omitted',
  },
  {
    id: 'left-cheek-freckle-cluster',
    direction: 'a tight cluster of freckles only on the left cheek, not a full-face sprinkle',
  },
  {
    id: 'chipped-incisor',
    direction: 'a slightly chipped upper-left incisor, visible when the mouth is even slightly open',
  },
  {
    id: 'uneven-ear-height',
    direction: 'the right ear sits visibly higher than the left, readable in front and profile',
  },
  {
    id: 'old-nasal-bump',
    direction: 'an old healed nasal-bridge bump, like a childhood break, stable in every angle',
  },
  {
    id: 'inherited-under-eye',
    direction: 'inherited dark under-eyes that makeup does not fully hide, especially the inner corners',
  },
  {
    id: 'right-resting-dimple',
    direction: 'a dimple only on the right cheek, visible even at rest',
  },
] as const;

const hasCraniofacialLock = (facts: string): boolean => {
  const text = facts.toLocaleLowerCase('pt-BR');
  return (
    /\b(face shape|formato do rosto|formato de (rosto|cora[cç][aã]o|diamante|quadrado)|oval face|rosto oval|rosto (oval|redondo|quadrado|alongado)|square jaw|maxilar|jawline|linha da mand[ií]bula|cheekbone|ma[cç]ãs? do rosto|philtrum|filtro nasal|hooded|monolid|aquiline|adunco|gonial|canthal|interpupillary|deep-set|olhos fundos|ponte nasal|nasal bridge|queixo recuado|receding chin|wide-set|close-set|olhos afastados|olhos juntos|brow ridge|lower third|ter[cç]o inferior|dorsal bump|septo|cupid'?s bow|arco do cupido)\b/i
      .test(text)
    || /\bnariz\b.{0,48}\b(largo|estreito|adunco|curvo|quebrado|achatado|respingado|reto|osso)\b/i
      .test(text)
    || /\b(queixo|mand[ií]bula|testa|sobrancelhas?)\b.{0,40}\b(largo|estreito|forte|fraco|recuado|quadrad|alto|baixo|assim[eé]tric)/i
      .test(text)
  );
};

const requestedAttractivenessRegister = (
  facts: string,
): (typeof faceAttractivenessRegisters)[number]['id'] | undefined => {
  const text = facts.toLocaleLowerCase('pt-BR');
  if (/\b(ordinary|average[- ]looking|pessoa comum|rosto comum|n[aã]o (t[aã]o )?bonit|not (that |very )?pretty|not a model|casting extra|vizinho|pessoa normal)\b/i.test(text)) {
    return 'ordinary_real';
  }
  if (/\b(lived[- ]in|weathered|vivid[oa]|idade no rosto|linhas de express[aã]o|marca de vida)\b/i.test(text)) {
    return 'lived_in';
  }
  if (/\b(striking|marcante|interessante|magnetic|not conventionally|n[aã]o convencionalmente)\b/i.test(text)) {
    return 'striking_irregular';
  }
  if (/\b(gal[aã]|gata|leading[- ]?(wo)?man|love interest|interesse rom[aâ]ntico)\b/i.test(text)) {
    return 'lead_camera_beauty';
  }
  if (/\b(pretty|beautiful|handsome|bonit[oa]|lind[oa]|atraente|glamour|modelo de passarela|fashion model)\b/i.test(text)) {
    return 'attractive_distinctive';
  }
  return undefined;
};

const isLeadCharacter = (input: ReferenceImagePromptInput): boolean => {
  const role = readableValue(metadataValue(input.metadata || {}, [
    'role',
    'dramatic_function',
    'dramaticFunction',
  ]));
  const text = `${role} ${input.category || ''} ${characterFacts(input)}`
    .toLocaleLowerCase('pt-BR');
  return (
    /\b(protagonista|protagonist|hero[ií]na|for[cç]a oposta|opposing.?force|antagonista|antagonist|interesse rom[aâ]ntico|par rom[aâ]ntico|love interest)\b/i
      .test(text)
    || /OPPOSING_FORCE/.test(cleanText(input.category, 120).toUpperCase())
  );
};

const compileFaceIdentityLock = (
  input: ReferenceImagePromptInput,
): { block: string; metadata: Record<string, string> } => {
  const facts = characterFacts(input);
  const seed = stableHash(
    `${cleanText(input.label, 180).toLocaleLowerCase('pt-BR')}|${facts.toLocaleLowerCase('pt-BR')}`,
  );
  const lead = isLeadCharacter(input);
  const presentation = inferPresentation(input);
  const requestedRegister = requestedAttractivenessRegister(facts);
  const useLeadBeauty = lead
    && requestedRegister !== 'ordinary_real'
    && requestedRegister !== 'lived_in';
  const storyAsWritten = faceAttractivenessRegisters.find(
    (item) => item.id === 'story_as_written',
  ) || faceAttractivenessRegisters[faceAttractivenessRegisters.length - 1];
  const attractiveness = useLeadBeauty
    ? faceAttractivenessRegisters[0]
    : requestedRegister
      ? faceAttractivenessRegisters.find((item) => item.id === requestedRegister)
        || storyAsWritten
      : storyAsWritten;
  const geometry = useLeadBeauty
    ? pickHashed(leadFaceGeometries, seed, supportingAttractivenessRegisters.length)
    : pickHashed(faceGeometries, seed, supportingAttractivenessRegisters.length);
  const landmark = useLeadBeauty
    ? pickHashed(leadFaceLandmarks, seed, 11)
    : pickHashed(faceLandmarks, seed, 11);
  const hashedOrigin = pickHashed(originPackages, seed, 13);
  const factsOriginId = namedOriginId(facts);
  const preserveOrigin = hasNamedOrigin(facts);
  const origin = hashedOrigin;
  const originForHair = factsOriginId || (preserveOrigin ? undefined : origin.id);
  const hairPool = hairColorsForOrigin(originForHair);
  const hairColor = pickHashed(hairPool, seed, 7);
  const silhouettePool = silhouettesForPresentation(presentation);
  const silhouette = pickHashed(silhouettePool, seed, 19);
  const body = pickHashed(leadBodies, seed, 41);
  const presence = pickHashed(cinematicPresences, seed, 17);
  const wardrobe = pickHashed(wardrobeLanes, seed, 23);
  const hook = pickHashed(phoneScreenHooks, seed, 29);
  const contradiction = pickHashed(leadContradictions, seed, 31);
  const originLine = preserveOrigin
    ? 'ORIGIN LOCK: keep the country and visible ancestry already named in APPROVED CHARACTER FACTS. The person must look like they come from that country. Hair color from any look package must stay plausible for that origin.'
    : `ORIGIN LOCK — country: ${origin.country}. Visible ancestry to preserve: ${origin.direction} Hair color from any look package must stay plausible for this origin.`;
  const preserveGeometry = hasCraniofacialLock(facts);
  const geometryLine = preserveGeometry
    ? 'Keep the craniofacial geometry already named in APPROVED CHARACTER FACTS. Do not replace it with a stock oval beautified face.'
    : `Craniofacial geometry to preserve exactly: ${geometry.direction}`;
  const landmarkLine = preserveGeometry
    ? 'Keep any mole, scar, dental, brow or asymmetry landmark already named; do not invent a conflicting mark.'
    : `Signature landmark, visible in every face view: ${landmark.direction}.`;
  const presenceLine = `SCREEN PRESENCE — ${presence.id}: ${presence.direction} Keep this presence plausible for the origin lock. Never imitate a real actor.`;
  const silhouetteLine = hasNamedHairTexture(facts)
    ? 'SILHOUETTE LOCK: keep the hair architecture already named in APPROVED CHARACTER FACTS. It must stay readable from behind and in a 9:16 freeze-frame.'
    : `SILHOUETTE LOCK — ${silhouette.id}: ${silhouette.direction}. The back of the head must identify this person. Never default to long dark straight hair unless this exact lock says so.`;
  const wardrobeLine = hasNamedWardrobe(facts)
    ? `WARDROBE LANE — keep the clothes already named, but stay inside this color/temperature: ${wardrobe.direction}.`
    : `WARDROBE LANE — ${wardrobe.id}: ${wardrobe.direction}. Recurring clothes stay in this lane so the ensemble does not dress as clones.`;
  const hookLine = `PHONE-SCREEN HOOK — ${hook.id}: ${hook.direction}. This must be readable on a 9:16 phone, larger than a hidden mole.`;
  const styleLine = useLeadBeauty
    ? `LEAD LOOK PACKAGE — a galã whose look must not clone another series: hair color: ${hasNamedHairColor(facts) ? 'keep the hair color already named in APPROVED CHARACTER FACTS' : hairColor.direction}; body: ${hasNamedBody(facts) ? 'keep the body already named' : body.direction}.`
    : 'SUPPORTING DISTINCTIVENESS: do not upgrade this person into a protagonist-galã unless the facts already demand it, but they MUST still be a specific silhouette + wardrobe lane so they cannot be mistaken for the leads in a freeze-frame.';
  const contradictionLine = useLeadBeauty
    ? `LEAD CONTRADICTION — ${contradiction.id}: ${contradiction.direction}. Famous-series method: beauty plus one specific break, so they are not a catalog model.`
    : '';
  const samefaceLine = useLeadBeauty
    ? 'ANTI-SAMEFACE: This is a vertical-drama GALÃ: extremely attractive on a phone, like a ReelShort/DramaBox lead, but NOT the same cloned runway/Instagram model used in every series. Identity comes from bone structure, eye spacing, nose silhouette, hair architecture, wardrobe lane and the contradiction. Do NOT add scars, crooked teeth, dark circles, a broken nose, receding chin, gummy smile or fatigue unless already named. Keep only a barely-visible 1-2 mm left-right asymmetry. Skin: healthy, glowing, camera-ready — not airbrushed plastic. Different series must produce different beautiful people, not the same face with a new hair dye.'
    : 'ANTI-SAMEFACE: Do not keep a generic oval face and only change hair color, eye color or clothes. Follow the attractiveness register above. Bone structure, silhouette, wardrobe lane and hook must make this character distinguishable from the leads of this series.';

  return {
    block: [
      'FACE IDENTITY LOCK — invent one specific person, never the default GPT Image 2 / Instagram / stock-model composite.',
      'ENSEMBLE RULE: this person must be identifiable in a freeze-frame lineup by hair silhouette + wardrobe lane. Forbidden default: long dark straight hair + black blazer + oval pretty face, unless this exact package specifies it.',
      'AGE READ: neck, hands, grooming and facial maturity must match the approved age. Do not default every adult to a 24-year-old beauty filter.',
      `ATTRACTIVENESS REGISTER — ${attractiveness.id}: ${attractiveness.direction}`,
      originLine,
      presenceLine,
      geometryLine,
      landmarkLine,
      silhouetteLine,
      wardrobeLine,
      hookLine,
      styleLine,
      contradictionLine,
      samefaceLine,
    ].filter(Boolean).join('\n'),
    metadata: {
      faceAttractivenessRegister: attractiveness.id,
      faceCastBand: useLeadBeauty ? 'lead' : 'supporting',
      faceGeometryVariant: preserveGeometry ? 'facts-owned' : geometry.id,
      faceLandmarkVariant: preserveGeometry ? 'facts-owned' : landmark.id,
      originCountry: preserveOrigin ? 'facts-owned' : origin.country,
      originVariant: preserveOrigin ? 'facts-owned' : origin.id,
      screenPresenceVariant: presence.id,
      silhouetteVariant: hasNamedHairTexture(facts) ? 'facts-owned' : silhouette.id,
      wardrobeLaneVariant: wardrobe.id,
      phoneHookVariant: hook.id,
      presentationGuess: presentation,
      ...(useLeadBeauty
        ? {
          leadHairColorVariant: hasNamedHairColor(facts) ? 'facts-owned' : hairColor.id,
          leadHairTextureVariant: hasNamedHairTexture(facts) ? 'facts-owned' : silhouette.id,
          leadBodyVariant: hasNamedBody(facts) ? 'facts-owned' : body.id,
          leadContradictionVariant: contradiction.id,
        }
        : {}),
    },
  };
};

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
  const identity = compileFaceIdentityLock(input);
  return `Create one clean horizontal 3:2 character identity sheet on an off-white
background for the original fictional adult character ${name}. Put the exact name
“${name}” once in large, correctly spelled, readable editorial type at the top,
centered across the complete sheet.

APPROVED CHARACTER FACTS — PRESERVE EXACTLY: ${facts}

${identity.block}

LEFT 70% — THREE FULL-BODY TURNAROUND VIEWS: show exactly three believable,
unretouched, live-action color bodies at matching head-to-toe scale: (1)
straight-on front, (2) strict 90-degree side profile, and (3) direct back. Use the
same neutral stance, body proportions, complete outfit, accessories, colors and
materials in all three views. Keep both shoes fully inside the sheet. Necks below
the jaw, clothing, arms, hands, legs and footwear remain continuous photographic
images with no cracks, glass or missing areas. The back view must face completely
away and reveal no facial feature or facial profile; its back-of-head hair remains
a normal photorealistic photograph.

HEAD-TO-BODY SCALE LOCK: every head — drawn or photographic — must be a normal
adult head on that same body, about 1/7.5 to 1/8 of the full standing height. The
drawn jaw sits exactly on the photographic neck and matches its width. Hard
failure: bobblehead, oversized sketch cranium, manga-scale head, or a drawn head
wider than the shoulders.

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
restrained contrast, true-to-life color and subtle sensor grain.

RIGHT PANEL GROUND: the entire right 30% uses the SAME flat off-white sheet
background as the left (#F7F6F2). Do NOT place snow, trees, sky, street, bokeh
landscape, studio seamless or any real environment behind the portrait. Shoulders,
collar, tie and upper chest remain one intact photographic garment on off-white.
Only the head plus all head hair is shattered. A winter scene or outdoor
background anywhere on the sheet is a hard failure.

THE RIGHT PORTRAIT IS THE ONLY SHATTERED ELEMENT: this is NOT cracked glass laid
over an intact photo. Cut the COMPLETE VISIBLE PHOTOGRAPHIC HEAD — FACE PLUS ALL
SURROUNDING HEAD HAIR — into EXACTLY SIX large, physically disconnected, closed
glass polygons floating on empty off-white. Together, the six pieces must
unmistakably reconstruct one aligned readable head: eyes/brow, nose, cheeks, lips,
chin, jaw, skin, hairline and outer hair silhouette. Every piece carries
substantial photographic face and/or hair content; never create transparent empty
panes, blank wedges or a hollow mask. Use exactly two upper pieces, two middle
pieces and two lower pieces — upper-left, upper-right, middle-left, middle-right,
lower-left and lower-right — around one empty pure-white impact opening near the
lower nose or mouth. There is NO central seventh piece and NO star-shaped hole
that eats the eyes.

PURE-WHITE GAP CONTRACT: use broad clean gaps around 6-8% of the complete
head-portrait width and a central opening around 12-15%. Between all six pieces
show ONLY flat pure white #FFFFFF, completely empty. No face, hair, skin, body,
coat, landscape, portrait continuation, texture, reflection, translucent glass or
hidden intact head may exist beneath or between the shards. Shadows may touch only
the immediate shard edge and must not fill or darken a gap. Each piece has its own
complete thin silver-gray perimeter; the pieces do not touch or share a center
ring. No drawn crack-line overlay, secondary cracks, small chips or internal
subdivisions.

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
  const identity = compileFaceIdentityLock(input);
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
${identity.block}
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
    const compiledPrompt = canonicalPrompt
      ? suppliedPrompt
      : visualReferenceMode === 'hybrid_face_compat'
        ? compileHybridCharacterPrompt(input)
        : compileStandardCharacterPrompt(input);
    return {
      prompt: compiledPrompt,
      promptContract: REFERENCE_IMAGE_PROMPT_CONTRACT,
      visualReferenceMode,
      promptMetadata: canonicalPrompt
        ? undefined
        : compileFaceIdentityLock(input).metadata,
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
