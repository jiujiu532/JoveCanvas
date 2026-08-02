type OramaTokenizer = {
  language: string;
  normalizationCache: Map<string, string>;
  tokenize: (raw: string, language?: string, prop?: string, withCache?: boolean) => string[];
};

const wordPattern = /[\p{Script=Han}]+|[a-z0-9][a-z0-9_'-]*/giu;
const hanPattern = /^\p{Script=Han}+$/u;
const chineseSegmenter = 'Segmenter' in Intl ? new Intl.Segmenter('zh-CN', { granularity: 'word' }) : null;

function getChineseSegments(value: string) {
  if (!chineseSegmenter) return [];

  return Array.from(chineseSegmenter.segment(value))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment);
}

function addChineseTokens(tokens: string[], value: string) {
  const chars = Array.from(value);
  if (chars.length <= 12) tokens.push(value);
  tokens.push(...getChineseSegments(value));

  for (let size = 1; size <= 3; size += 1) {
    if (chars.length < size) continue;
    for (let i = 0; i <= chars.length - size; i += 1) {
      tokens.push(chars.slice(i, i + size).join(''));
    }
  }
}

/**
 * Custom bilingual tokenizer for docs search.
 * `language` on the tokenizer object is required by Orama's type, but
 * fumadocs i18n must not also pass a top-level create `language` option
 * (NO_LANGUAGE_WITH_CUSTOM_TOKENIZER) — route.ts uses localeMap for that.
 */
export function createDocsSearchTokenizer(): OramaTokenizer {
  return {
    // Dummy stemmer language; actual splitting is fully custom below.
    language: 'english',
    normalizationCache: new Map(),
    tokenize(raw) {
      if (typeof raw !== 'string') return [raw];

      const tokens: string[] = [];
      const input = raw.normalize('NFKC').toLowerCase();

      for (const match of input.matchAll(wordPattern)) {
        const value = match[0];
        if (hanPattern.test(value)) {
          addChineseTokens(tokens, value);
        } else {
          tokens.push(value);
        }
      }

      return Array.from(new Set(tokens.filter(Boolean)));
    },
  };
}
