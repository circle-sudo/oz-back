import axios from "axios";
import fs from "fs";
import * as cheerio from "cheerio";

const URL = "https://ezdegree.co.kr/";

async function crawl() {
  try {
    const response = await axios.get(URL);
    console.log(response.data);
    // fs.writeFileSync("response.html", response.data);
    const $ = cheerio.load(response.data);
    const title = $("title").text();
    console.log(title);
  } catch (error) {
    console.log(error.response.data);
    console.error(error);
  }
}

export { crawl };