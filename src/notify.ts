import axios from "axios";
import {load} from "cheerio";
import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });

type newsItem = {
  title: string;
  link: string | undefined;
};

async function scrapeWebsite() {
  const url = "https://www.c.u-tokyo.ac.jp/zenki/news/index.html";

  try {
    const response = await axios.get(url);
    const html = response.data;

    const $ = load(html);
    const newsList = $("#newslist2 dl");

    const newsData: Array<newsItem> = [];

    newsList.each((index, element) => {
      const dl = $(element);
      const ddElements = dl.find("dd");
      const dtElements = dl.find("dt");

      if (ddElements.length !== dtElements.length) {
        throw new Error(
          "お知らせ内の日付要素の数とタイトル要素の数が一致しません。終了します。"
        );
      }

      for (let i = 0; i < ddElements.length; i++) {
        const dateText = dtElements.eq(i).text().trim();
        const dateMatch = dateText.match(/(\d{4}\.\d{2}\.\d{2})/);

        if (dateMatch) {
          // 今日の0時0分0秒より前の日付の場合は終了
          if (new Date(dateMatch[1]) < new Date(new Date().setHours(0, 0, 0, 0))) {
            break;
          }
          const title = ddElements.eq(i).find("a").text().trim();
          let link = ddElements.eq(i).find("a").attr("href");

          // linkが相対リンクの場合は絶対リンクに変換
          if (link && link.match(/^\//)) {
            link = `https://www.c.u-tokyo.ac.jp${link}`;
          }

          const newsItem = {
            title,
            link,
          };

          newsData.push(newsItem);
        }
      }
    });

    console.log(JSON.stringify(newsData, null, 2));
  } catch (error) {
    console.error("[Error]", error);
  }
}

scrapeWebsite();
