import axios, { AxiosStatic } from "axios";
import { load } from "cheerio";
import NewsItem from "./NewsItem";
import { NotifyType } from "./NotifyType";

export default class ZenkiNewsFetcher {
  private axios: AxiosStatic;
  private load: any;

  constructor() {
    this.axios = axios;
    this.load = load;
  }

  public async fetch(): Promise<Array<NewsItem>> {
    const response = await this.axios.get(
      "https://www.c.u-tokyo.ac.jp/zenki/news/index.html"
    );
    const $ = this.load(response.data);

    const newsList = $("#newslist2 dl");
    const newsItems: Array<NewsItem> = [];

    newsList.each((index: number, element: any) => {
      const dl = $(element);
      const ddElements = dl.find("dd");
      const dtElements = dl.find("dt");

      if (ddElements.length !== dtElements.length) {
        throw new Error(
          "お知らせ内の日付要素の数とタイトル要素の数が一致しません。"
        );
      }

      for (let i = 0; i < ddElements.length; i++) {
        const dateText = dtElements.eq(i).text().trim();
        const dateMatch = dateText.match(/(\d{4}\.\d{2}\.\d{2})/);
        if (dateMatch) {
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
          newsItems.push(
            new NewsItem(
              ddElements.eq(i).find("a").text().trim(),
              this.formatURL(ddElements.eq(i).find("a").attr("href")),
              type,
              new Date(dateMatch[1])
            )
          );
        }
      }
    });

    return newsItems;
  }

  private formatURL(url: string): string {
    if (url && url.match(/^\//)) {
      url = `https://www.c.u-tokyo.ac.jp${url}`;
    }
    return url;
  }
}
