import axios from "axios";
import { load } from "cheerio";
import { getDBConnection, endPool } from "./db";
import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
import LINENotify from "./lib/LINENotify";

enum NotifyType {
  ALL,
  FIRST_YEAR,
  SECOND_YEAR,
}

type newsItem = {
  title: string;
  link: string | undefined;
  type: NotifyType;
};

async function notify(token: string, message: string) {
  const notify = new LINENotify();
  try {
    await notify.notify(token, message);
  } catch (error) {
    if (notify.isTokenInvalidError(error)) {
      const connection = await getDBConnection();
      try {
        await connection.query(
          "DELETE FROM line_notify_tokens WHERE token = ?",
          [token]
        );
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "message" in error) {
          console.error(
            `Error deleting token ${token} from database:`,
            (error as Error).message
          );
        }
      } finally {
        connection.release();
      }
    } else {
      console.error(
        `Error sending LINE Notify message(token: ${token}):`,
        error
      );
    }
  }
}

async function getNews() {
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
        const dateImgs = dtElements.eq(i).find("img");
        let type: NotifyType = NotifyType.ALL;
        if (dateImgs.length == 2 && dateImgs.eq(1).attr("src")) {
          const typeMatch = dateImgs
            .eq(1)
            .attr("src")
            ?.match(/news_z_(all|firstyear|secondyear)\.gif/);
          if (typeMatch) {
            switch (typeMatch[1]) {
              case "firstyear":
                type = NotifyType.FIRST_YEAR;
                break;
              case "secondyear":
                type = NotifyType.SECOND_YEAR;
                break;
              default:
                type = NotifyType.ALL;
                break;
            }
          }
        }

        if (dateMatch) {
          // 今日の0時0分0秒より前の日付の場合は終了
          if (
            new Date(dateMatch[1]) < new Date(new Date().setHours(0, 0, 0, 0))
          ) {
            continue;
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
            type,
          };

          newsData.push(newsItem);
        }
      }
    });

    return newsData;
  } catch (error) {
    console.error("[Error]", error);
    return [];
  }
}

async function main() {
  const newsData = await getNews();
  if (newsData.length == 0) return;

  let messages: string[] = [];

  for (const type of [
    NotifyType.ALL,
    NotifyType.FIRST_YEAR,
    NotifyType.SECOND_YEAR,
  ]) {
    let message = "";

    for (const item of newsData) {
      if (
        type === NotifyType.ALL ||
        item.type === type ||
        item.type === NotifyType.ALL
      ) {
        message += `${item.title}(${item.link})\n`;
      }
    }

    if (message === "") continue;

    message += "\n連携解除はこちら(https://notify-bot.line.me/my/)";
    messages.push(message);
  }

  const connection = await getDBConnection();
  try {
    const [rows] = await connection.query(
      "SELECT token, notify_type FROM line_notify_tokens"
    );

    for (const row of rows as { token: string; notify_type: number }[]) {
      const token = row.token;
      await notify(token, messages[row.notify_type]);
    }
  } catch (error) {
    console.error("Error querying tokens from database:", error);
  } finally {
    connection.release();
  }

  await endPool();
  process.exit(0);
}

main();
