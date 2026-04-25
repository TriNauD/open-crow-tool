import { load } from 'cheerio';

export interface TrendingRepo {
  name: string;        // "owner/repo"
  url: string;         // "https://github.com/owner/repo"
  description: string;
  language: string;
  totalStars: number;
  weeklyStars: number;
}

function parseStarCount(text: string): number {
  const cleaned = text.replace(/,/g, '').replace(/\s/g, '');
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function fetchTrending(languageFilter?: string): Promise<TrendingRepo[]> {
  const languages = languageFilter
    ? languageFilter.split(',').map((l) => l.trim()).filter(Boolean)
    : [''];

  const allRepos: TrendingRepo[] = [];

  for (const lang of languages) {
    const url = lang
      ? `https://github.com/trending/${encodeURIComponent(lang)}?since=weekly`
      : 'https://github.com/trending?since=weekly';

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`[github-trending] fetch failed: ${res.status} for ${url}`);
      continue;
    }

    const html = await res.text();
    const $ = load(html);
    const repos: TrendingRepo[] = [];

    $('article.Box-row').each((_, el) => {
      try {
        const anchor = $(el).find('h2 a').first();
        const href = anchor.attr('href') ?? '';
        const name = href.replace(/^\//, '').trim();
        if (!name || !name.includes('/')) return;

        const repoUrl = `https://github.com/${name}`;
        const description = $(el).find('p').first().text().trim();
        const language =
          $(el).find('[itemprop="programmingLanguage"]').first().text().trim() || '未知';

        // Stars: first Link--muted is total, last float-sm-right contains weekly
        const starLinks = $(el).find('a.Link--muted');
        let totalStars = 0;
        let weeklyStars = 0;

        starLinks.each((_, a) => {
          const text = $(a).text().trim();
          if (text.includes('stars this week') || text.includes('star this week')) {
            weeklyStars = parseStarCount(text);
          } else if ($(a).attr('href')?.endsWith('/stargazers')) {
            totalStars = parseStarCount(text);
          }
        });

        repos.push({ name, url: repoUrl, description, language, totalStars, weeklyStars });
      } catch (err) {
        console.error('[github-trending] parse error for one repo:', err);
      }
    });

    allRepos.push(...repos);
  }

  // Deduplicate by name, keep top 20
  const seen = new Set<string>();
  return allRepos.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  }).slice(0, 20);
}
