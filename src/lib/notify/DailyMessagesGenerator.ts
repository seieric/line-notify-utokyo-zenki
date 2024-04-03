import { NotifyType } from "../zenki/NotifyType";
import NewsItem from "../zenki/NewsItem";
import prisma from "../db";

export default class DailyMessagesGenerator{
  private newsItems: Array<NewsItem>;
  private messageFooter: string;

  constructor(freshNewsItems: Array<NewsItem>, messageFooter: string){
    this.newsItems = freshNewsItems;
    this.messageFooter = messageFooter;
  }

  public async generate(){
    let messages: (string | undefined)[]= [];
    for (const type of [
      NotifyType.ALL,
      NotifyType.FIRST_YEAR,
      NotifyType.SECOND_YEAR,
    ]) {
      let message = "";
      const yesterdayNewsItems = await this.getYesterdayNewsItems();
      for (const item of yesterdayNewsItems) {
        if (item.isType(type)) {
          message += item.toString() + "\n";
        }
      }
      for (const item of this.newsItems) {
        if (
          item.isType(type) &&
          item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0)))
        ) {
          message += item.toString() + "\n";
        }
      }
      if (message === "") {
        messages.push(undefined);
      } else {
        message += this.messageFooter;
        messages.push(message);
      
      }
    }
    return messages;
  }

  // 前日の18時以降に投稿されたニュースを取得
  private async getYesterdayNewsItems(): Promise<Array<NewsItem>> {
    const yesterdayNewsItems = await prisma.newsItem.findMany({
      select: {
        link: true,
        type: true,
        title: true,
        updated_at: true,
      },
      where: {
        updated_at: {
          gte: new Date(new Date(new Date().setDate(new Date().getDate() - 1)).setHours(18, 0, 0, 0)),
          lt: new Date(new Date(new Date().setDate(new Date().getDate() - 1)).setHours(23, 59, 59, 999)),
        },
      },
    });
    return yesterdayNewsItems.map(
      (item) => new NewsItem(item.title, item.link, item.type, item.updated_at)
    );
  }
}