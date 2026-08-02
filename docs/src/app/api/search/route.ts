import { source } from '@/lib/source';
import { createDocsSearchTokenizer } from '@/lib/search-tokenizer';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// localeMap overrides getTokenizer(locale) which would inject `language`
// and conflict with our custom tokenizer (NO_LANGUAGE_WITH_CUSTOM_TOKENIZER).
const tokenizer = createDocsSearchTokenizer();

export const { staticGET: GET } = createFromSource(source, {
  localeMap: {
    zh: {
      components: { tokenizer },
    },
    en: {
      components: { tokenizer },
    },
  },
});
