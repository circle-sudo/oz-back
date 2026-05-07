// const { testCreateFiles } = require("./base/FileManager");
// const { main } = require("./base/sum");
// const { logMessage } = require("./base/LogManager");
// import { crawl } from "./base/scrapper/static-scrapper.js";
// import { crawl, crawlNaverBlog } from "./base/scrapper/dynamic-scrapper.js";
// crawlNaverBlog("물병");

import { crawl } from "./base/scrapper/yozm-scrapper.js";
crawl();
// crawl();
// main();
// testCreateFiles();