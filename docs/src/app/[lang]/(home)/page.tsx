import Link from "next/link";
import { ArrowUpRight, BookOpen, Rocket } from "lucide-react";
import { getDictionary } from "@/lib/dictionaries";
import { localePath, normalizeLocale } from "@/lib/i18n";
import { appName, gitConfig } from "@/lib/shared";

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
const starHistoryUrl = `https://www.star-history.com/?repos=${gitConfig.user}%2F${gitConfig.repo}&type=date`;
const starHistoryChart = `https://api.star-history.com/chart?repos=${gitConfig.user}/${gitConfig.repo}&type=date&transparent=true`;
const darkStarHistoryChart = `${starHistoryChart}&theme=dark`;

export default async function HomePage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  const dict = getDictionary(lang);
  const previewImages = dict.home.previewImages;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 pt-8 md:px-10 md:pt-14">
      <section className="grid min-h-[520px] items-center gap-10 border-b border-zinc-200 pb-12 dark:border-zinc-800 lg:grid-cols-[0.88fr_1.12fr]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Rocket className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {dict.home.badge}
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50 md:text-6xl [font-family:var(--font-display)]">
            {appName}
            <span className="block text-zinc-500 dark:text-zinc-400">
              {dict.home.docsCenter}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 dark:text-zinc-400">
            {dict.home.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={localePath(lang, "/docs/overview/quick-start")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <BookOpen className="size-4" />
              {dict.home.quickStart}
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
            >
              <img src="/github.svg" alt="" className="size-4" />
              GitHub
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
            >
              {dict.home.projectRepo}
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl lg:w-[108%] lg:max-w-none">
          <img
            src={previewImages[3].src}
            alt={dict.home.previewAlt}
            className="aspect-[16/10] w-full rounded-xl object-cover"
          />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 md:text-3xl">
              {dict.home.showcase}
            </h2>
          </div>
          <Link
            href={localePath(lang, "/docs/overview/features")}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-800 transition hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
          >
            {dict.home.features}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {previewImages.map((item) => (
            <img
              key={item.src}
              src={item.src}
              alt={`${item.title}`}
              loading="lazy"
              decoding="async"
              className="aspect-[16/10] w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 w-full max-w-4xl text-center">
        <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 md:text-3xl">
          {dict.home.contributors}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {dict.home.contributorsHint}
        </p>
        <div className="mt-7 flex justify-center">
          <a
            href={`${githubUrl}/graphs/contributors`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full"
          >
            <img
              src={`https://contrib.rocks/image?repo=${gitConfig.user}/${gitConfig.repo}`}
              alt={dict.home.contributorsAlt}
              loading="lazy"
              decoding="async"
              className="max-w-full"
            />
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 w-full max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 md:text-3xl">
          Star History
        </h2>
        <div className="mt-7 flex justify-center">
          <a
            href={starHistoryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block w-full max-w-4xl"
          >
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={darkStarHistoryChart}
              />
              <source
                media="(prefers-color-scheme: light)"
                srcSet={starHistoryChart}
              />
              <img
                src={starHistoryChart}
                alt="Star History Chart"
                loading="lazy"
                decoding="async"
                className="mx-auto w-full"
              />
            </picture>
          </a>
        </div>
      </section>
    </main>
  );
}
