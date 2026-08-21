export const INVALID_AI_JSON_MESSAGE = 'A IA retornou JSON invalido';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asJsonObject = (value: unknown): Record<string, unknown> => {
  if (isPlainObject(value)) return value;
  if (Array.isArray(value)) {
    const first = value.find(isPlainObject);
    if (first) return first;
  }
  throw new Error(INVALID_AI_JSON_MESSAGE);
};

const stripFences = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return text.replace(/```(?:json)?/gi, '').trim();
};

const sliceObject = (text: string): string => {
  const start = text.indexOf('{');
  if (start < 0) return text;
  const end = text.lastIndexOf('}');
  if (end <= start) return text.slice(start);
  return text.slice(start, end + 1);
};

const nextNonWhitespace = (text: string, index: number): string => {
  for (let i = index; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') return ch;
  }
  return '';
};

const lastSignificant = (text: string): string => {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') return ch;
  }
  return '';
};

const stripTrailingComma = (text: string): string => text.replace(/,(\s*)$/, '$1');

const isCompleteValueEnd = (ch: string): boolean =>
  ch === '}' ||
  ch === ']' ||
  ch === '"' ||
  (ch >= '0' && ch <= '9') ||
  ch === 'e' ||
  ch === 'l';

/** Repairs the LLM JSON failures that crash episode-script jobs: missing commas, raw newlines, unescaped quotes, truncation. */
export const repairAiJson = (text: string): string => {
  let out = '';
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escaped = false;
  let expectingValue = true;

  const insertCommaIfNeeded = () => {
    if (expectingValue) return;
    if (!isCompleteValueEnd(lastSignificant(out))) return;
    out += ',';
    expectingValue = true;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        const nxt = nextNonWhitespace(text, i + 1);
        if (nxt === '' || nxt === ',' || nxt === '}' || nxt === ']' || nxt === ':') {
          inString = false;
          expectingValue = false;
          out += ch;
          continue;
        }
        out += '\\"';
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') continue;
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') {
      insertCommaIfNeeded();
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      insertCommaIfNeeded();
      stack.push(ch);
      expectingValue = true;
      out += ch;
      continue;
    }
    if (ch === '}' || ch === ']') {
      out = stripTrailingComma(out);
      if (stack[stack.length - 1] === (ch === '}' ? '{' : '[')) stack.pop();
      expectingValue = false;
      out += ch;
      continue;
    }
    if (ch === ':' || ch === ',') {
      expectingValue = true;
      out += ch;
      continue;
    }
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      out += ch;
      continue;
    }
    insertCommaIfNeeded();
    expectingValue = false;
    out += ch;
  }

  if (inString) out += '"';
  out = stripTrailingComma(out);
  while (stack.length > 0) {
    const open = stack.pop();
    out += open === '{' ? '}' : ']';
  }
  return out;
};

export const parseAiJsonObject = (text: string): Record<string, unknown> => {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error(INVALID_AI_JSON_MESSAGE);
  const normalized = stripFences(raw)
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  const candidates = [normalized, sliceObject(normalized)].filter(
    (item, index, all) => item && all.indexOf(item) === index,
  );
  for (const candidate of candidates) {
    try {
      return asJsonObject(JSON.parse(candidate));
    } catch {
      try {
        return asJsonObject(JSON.parse(repairAiJson(candidate)));
      } catch {
        // try the next candidate
      }
    }
  }
  const preview = raw.replace(/\s+/g, ' ').slice(0, 280);
  throw new Error(`${INVALID_AI_JSON_MESSAGE}: ${preview}`);
};

export const parseAiJsonObjectFromModel = (
  content: string,
  reasoning?: string,
): Record<string, unknown> => {
  try {
    return parseAiJsonObject(content);
  } catch (error) {
    if (!reasoning?.trim()) throw error;
    try {
      return parseAiJsonObject(reasoning);
    } catch {
      throw error;
    }
  }
};
