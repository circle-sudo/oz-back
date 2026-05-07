import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "./base/scrapper/output";

async function saveToFile(posts, outputDir = OUTPUT_DIR) {
  const filePath = path.join(outputDir, `yozm-${Date.now()}.json`);
  await fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
}

async function crawl(options = {}) {
  const {
    listUrl = "https://yozm.wishket.com/magazine/list/itservice/?page=4",
    headless = false,
    minScrolls = 10,
    stableRoundsToStop = 2,
    scrollPauseMs = 800,
    printJson = true,
    outputDir = "./base/scrapper/output",
    fileDate = new Date(),
  } = options;

  const browser = await puppeteer.launch({
    headless,
    devtools: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
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

    const posts = await page.evaluate(() => {
      // debugger;
      const items = document.querySelectorAll(
        "[data-testid=contentsItem-item-link]",
      );
      return Array.from(items, (el) => {
        const infoSpans = el.querySelectorAll(
          '[data-testid="contents-info-root"] > span, [data-testid="contents-info-root"] > div > span',
        );
        const readTime = infoSpans[0]?.textContent?.trim() ?? "";
        const date = infoSpans[1]?.textContent?.trim() ?? "";
        const popular = infoSpans[2]?.textContent?.trim() ?? "";

        return {
          url: el.href,
          title: el.querySelector("h3")?.textContent?.trim() ?? "",
          description:
            el
              .querySelector('[data-testid="contentsItem-description"] span')
              ?.textContent?.trim() ?? "",
          thumbnail: el.querySelector("img")?.src ?? "",
          readTime,
          date,
          isPopular: popular === "인기",
        };
      });
    });

    console.error(`수집 완료: ${posts.length}건 (목록 DOM만 사용)`);
    await saveToFile(posts);
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }

  return posts;
}

export { crawl };