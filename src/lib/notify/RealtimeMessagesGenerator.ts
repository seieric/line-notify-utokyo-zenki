import NewsItem from "../zenki/NewsItem";
import { PrismaClient } from "@prisma/client";
import { NotifyType } from "../zenki/NotifyType";

type updatedNewsItemsInfo = {
  new: Array<NewsItem>; // 新しいお知らせ
  updated: Array<NewsItem>; // 学年が更新されたお知らせ
  updatedIds: Array<number>; // 学年が更新されたお知らせのデータベース上のID
};

export default class RealtimeMessagesGenerator {
  private newsItems: Array<NewsItem>;
  private messageFooter: string;
  private prisma: PrismaClient;

  constructor(
    freshNewsItems: Array<NewsItem>,
    messageFooter: string,
    prisma: PrismaClient
  ) {
    this.newsItems = freshNewsItems;
    this.messageFooter = messageFooter;
    this.prisma = prisma;
  }

  public async generate() {
    // その日に配信したお知らせをデータベースから取得する
    const notifiedNewsItems = await this.prisma.newsItem.findMany({
      select: {
        id: true,
        link: true,
        type: true,
      },
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });

    const updatedNewsItemsInfo = this.detectNewNewsItem(notifiedNewsItems);
    // 新しいお知らせや更新されたお知らせがない場合は何もしない
    if (
      updatedNewsItemsInfo.new.length == 0 &&
      updatedNewsItemsInfo.updated.length == 0
    )
      return [];

    // 更新されたお知らせをデータベースに反映する
    for (const i in updatedNewsItemsInfo.updatedIds) {
      await this.prisma.newsItem.update({
        where: { id: updatedNewsItemsInfo.updatedIds[i] },
        data: { type: updatedNewsItemsInfo.updated[i].type },
      });
    }
    // 新しいお知らせをデータベースに追加する
    for (const item of updatedNewsItemsInfo.new) {
      await this.prisma.newsItem.create({
        data: {
          title: item.title,
          link: item.link || "",
          type: item.type,
        },
      });
    }

    const messages = this._generate(updatedNewsItemsInfo);
    return messages;
  }

  private _generate(updatedNewsItemsInfo: updatedNewsItemsInfo) {
    const messages: Array<string | undefined> = [];
    for (const type of [
      NotifyType.ALL,
      NotifyType.FIRST_YEAR,
      NotifyType.SECOND_YEAR,
    ]) {
      let message = "";
      for (const item of updatedNewsItemsInfo.new) {
        if (item.isType(type) && item.isNotOlderThan(new Date())) {
          message += item.toString() + "\n";
        }
      }
      for (const item of updatedNewsItemsInfo.updated) {
        const originalItem = this.newsItems.find(
          (newsItem) => newsItem.link === item.link
        );
        if (!originalItem) continue;

        const isNotified = originalItem.type == NotifyType.ALL || originalItem.type == type;
        if (!isNotified && !item.isType(type) && item.isNotOlderThan(new Date())) {
          message += item.toString() + "\n";
        }
      }

      if (message === "") messages.push(undefined);

      message += this.messageFooter;
      messages.push(message);
    }

    return messages;
  }

  // 新しいお知らせや更新されたお知らせを検出する
  private detectNewNewsItem(
    notifiedNewsItems: Array<{ id: number; link: string; type: number }>
  ): updatedNewsItemsInfo {
    const result: updatedNewsItemsInfo = {
      new: Array<NewsItem>(),
      updated: Array<NewsItem>(),
      updatedIds: Array<number>(),
    };
    // 新しいお知らせを検出する
    for (const freshItem of this.newsItems) {
      // URLが一致するお知らせが通知済みのお知らせにあるか
      const linkMatchItem = notifiedNewsItems.find(
        (notifiedItem) => notifiedItem.link === freshItem.link
      );
      if (!linkMatchItem) {
        // 新しいお知らせ
        result.new.push(freshItem);
      } else if (linkMatchItem.type !== freshItem.type) {
        // 既存のお知らせで学年が更新されたお知らせ
        result.updated.push(freshItem);
        result.updatedIds.push(linkMatchItem.id);
      }
    }

    return result;
  }
}
