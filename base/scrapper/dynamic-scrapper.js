import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "output");

const DEFAULT_LIST_URL =
  "https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=%EC%BB%A4%ED%94%BC";

/** @typedef {{ author: string, writtenAt: string, title: string, body: string, imageUrls: string[], url: string }} BlogListItem */

/**
 * 목록 URL의 `query`에서 검색어를 꺼낸다.
 * @param {string} listUrl
 * @returns {string}
 */
function keywordFromListUrl(listUrl) {
  try {
    const q = new URL(listUrl).searchParams.get("query");
    if (q) return decodeURIComponent(q).trim();
  } catch {
    /* ignore */
  }
  return "search";
}

/**
 * 파일명에 쓸 수 없는 문자만 제거·치환한다.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFileSegment(name) {
  const s = name
    .replace(/[/\\?%*:|"<>]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return s || "keyword";
}

/**
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DD
 */
function formatDateForFilename(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {BlogListItem[]} posts
 * @param {{
 *   keyword: string,
 *   date: Date,
 *   outputDir: string,
 * }} opts
 * @returns {Promise<string>} 저장된 파일 절대 경로
 */
async function savePostsJson(posts, opts) {
  const { keyword, date, outputDir } = opts;
  const safeKw = sanitizeFileSegment(keyword);
  const dateStr = formatDateForFilename(date);
  const fileName = `${safeKw}_${dateStr}.json`;
  const dir = path.resolve(outputDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  const payload = JSON.stringify(posts, null, 2);
  await fs.writeFile(filePath, payload, "utf8");
  return filePath;
}

/**
 * 목록 DOM(`data-template-id="ugcItem"`)에서 카드 단위로 필드를 추출한다. 상세 페이지는 열지 않는다.
 * @returns {Omit<BlogListItem, never>[]}
 */
function parseUgcItemsInDocument() {
  const roots = document.querySelectorAll('[data-template-id="ugcItem"]');
  /** @type {Omit<BlogListItem, never>[]} */
  const out = [];

  roots.forEach((root) => {
    const t = (el) =>
      (el?.textContent ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+\n/g, "\n")
        .trim();

    const profile = root.querySelector('[data-template-id="articleSource"]');
    let author = "";
    let writtenAt = "";
    if (profile) {
      author = t(profile.querySelector(".sds-comps-profile-info-title-text"));
      writtenAt = t(profile.querySelector(".sds-comps-profile-info-subtext"));
    }

    const titleEl = root.querySelector(".sds-comps-text-type-headline1");
    const title = t(titleEl);

    const bodyAnchor =
      root.querySelector("a.fds-ugc-ellipsis2") ||
      root.querySelector("a[class*='fds-ugc-ellipsis']");
    const body = t(
      bodyAnchor?.querySelector(".sds-comps-text-type-body1") || bodyAnchor,
    );

    /** @type {string} */
    let url = "";
    const keepBtn = root.querySelector("button._keep_trigger[data-url]");
    const dataUrl = keepBtn?.getAttribute("data-url")?.trim();
    if (dataUrl) url = dataUrl;

    if (!url) {
      const titleLink = titleEl?.closest("a");
      if (titleLink?.href) url = titleLink.href.split("#")[0];
    }

    if (!url) {
      const postLink = root.querySelector(
        'a[href*="blog.naver.com/"][href*="/"]:not([href*="PostView.naver"])',
      );
      if (postLink?.href) {
        try {
          const u = new URL(postLink.href);
          if (/\/[^/]+\/\d+/.test(u.pathname)) url = u.href.split("#")[0];
        } catch {
          /* ignore */
        }
      }
    }

    const imageUrls = [];
    root.querySelectorAll("img").forEach((img) => {
      if (profile?.contains(img)) return;
      const raw = img.getAttribute("src") || img.getAttribute("data-src") || "";
      if (!raw || raw.startsWith("data:")) return;
      try {
        imageUrls.push(new URL(raw, location.href).href);
      } catch {
        /* ignore */
      }
    });

    if (!title && !url && !body) return;

    out.push({
      author,
      writtenAt,
      title,
      body,
      imageUrls: [...new Set(imageUrls)],
      url,
    });
  });

  return out;
}

/**
 * @param {import('puppeteer').Page} page
 * @returns {Promise<BlogListItem[]>}
 */
async function extractListItems(page) {
  return page.evaluate(parseUgcItemsInDocument);
}

/**
 * 하단으로 스크롤해 추가 목록을 로드한다.
 * 최소 `minScrolls`회 스크롤한 뒤, 문서 높이가 연속으로 늘지 않으면 종료한다.
 * @param {import('puppeteer').Page} page
 * @param {{
 *   minScrolls?: number,
 *   stableRoundsToStop?: number,
 *   maxIterations?: number,
 *   pauseMs?: number,
 * }} [opts]
 */
async function scrollFeedUntilStable(page, opts = {}) {
  const {
    minScrolls = 10,
    stableRoundsToStop = 2,
    maxIterations = 120,
    pauseMs = 800,
  } = opts;

  let noGrowthStreak = 0;

  for (let i = 0; i < maxIterations; i++) {
    const beforeScroll = await page.evaluate(() =>
      Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
      ),
    );

    await page.evaluate(() => {
      const y = Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
      );
      window.scrollTo(0, y);
    });

    await new Promise((r) => setTimeout(r, pauseMs));

    const afterScroll = await page.evaluate(() =>
      Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
      ),
    );

    if (afterScroll > beforeScroll) noGrowthStreak = 0;
    else noGrowthStreak += 1;

    if (i + 1 >= minScrolls && noGrowthStreak >= stableRoundsToStop) break;
  }
}

/**
 * 목록 URL에서 UGC 카드만 스크롤·파싱하여 JSON으로 모은다.
 * @param {{
 *   listUrl?: string,
 *   headless?: boolean | 'shell',
 *   minScrolls?: number,
 *   stableRoundsToStop?: number,
 *   scrollPauseMs?: number,
 *   printJson?: boolean,
 *   saveToFile?: boolean,
 *   outputDir?: string,
 *   keyword?: string,
 *   fileDate?: Date,
 * }} [options]
 * @returns {Promise<BlogListItem[]>}
 */
async function crawl(options = {}) {
  const {
    listUrl = DEFAULT_LIST_URL,
    headless = false,
    minScrolls = 10,
    stableRoundsToStop = 2,
    scrollPauseMs = 800,
    printJson = true,
    saveToFile = true,
    outputDir = DEFAULT_OUTPUT_DIR,
    keyword: keywordOverride,
    fileDate = new Date(),
  } = options;

  const keyword = keywordOverride?.trim() || keywordFromListUrl(listUrl);

  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  /** @type {BlogListItem[]} */
  const posts = [];
  const byUrl = new Map();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    );

    await page.goto(listUrl, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });

    await page
      .waitForSelector('[data-template-id="ugcItem"]', { timeout: 25000 })
      .catch(() => {});

    await scrollFeedUntilStable(page, {
      minScrolls,
      stableRoundsToStop,
      pauseMs: scrollPauseMs,
    });

    const batch = await extractListItems(page);
    for (const item of batch) {
      const key = item.url || `${item.title}|${item.author}|${item.writtenAt}`;
      if (byUrl.has(key)) continue;
      byUrl.set(key, true);
      posts.push(item);
    }

    if (printJson) {
      console.log(JSON.stringify(posts, null, 2));
    }

    if (saveToFile) {
      const filePath = await savePostsJson(posts, {
        keyword,
        date: fileDate,
        outputDir,
      });
      console.error(`저장: ${filePath}`);
    }

    console.error(`수집 완료: ${posts.length}건 (목록 DOM만 사용)`);
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }

  return posts;
}

async function crawlNaverBlog(keyword) {
  const prefixUrl =
    "https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=";
  const listUrl = prefixUrl + encodeURIComponent(keyword);
  return crawl({ listUrl });
}

export { crawl, crawlNaverBlog };