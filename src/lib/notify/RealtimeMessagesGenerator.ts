import NewsItem from "../zenki/NewsItem";
import { PrismaClient } from "@prisma/client";
import { NotifyType } from "../zenki/NotifyType";

class updatedNewsItemsInfo {
  public new: Array<NewsItem>; // 新しいお知らせ
  public updated: Array<NewsItem>; // 学年が更新されたお知らせ
  public updatedIds: Array<number>; // 学年が更新されたお知らせのデータベース上のID
  constructor() {
    this.new = [];
    this.updated = [];
    this.updatedIds = [];
  }
};

export default class RealtimeMessagesGenerator {
  private newsItems: Array<NewsItem>;
  private messageFooter: string;
  private prisma: PrismaClient;
  private updatedNewsItemsInfo: updatedNewsItemsInfo;

  constructor(
    freshNewsItems: Array<NewsItem>,
    messageFooter: string,
    prisma: PrismaClient
  ) {
    this.newsItems = [];
    for (const item of freshNewsItems) {
      if (item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0))))
        this.newsItems.push(item);
    }
    this.messageFooter = messageFooter;
    this.prisma = prisma;
    this.updatedNewsItemsInfo = new updatedNewsItemsInfo();
  }

  public async update() {
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
    this.updatedNewsItemsInfo = this.detectNewNewsItem(notifiedNewsItems);
    // 更新されたお知らせをデータベースに反映する
    for (const i in this.updatedNewsItemsInfo.updatedIds) {
      await this.prisma.newsItem.update({
        where: { id: this.updatedNewsItemsInfo.updatedIds[i] },
        data: { type: this.updatedNewsItemsInfo.updated[i].type },
      });
    }
    // 新しいお知らせをデータベースに追加する
    for (const item of this.updatedNewsItemsInfo.new) {
      await this.prisma.newsItem.create({
        data: {
          title: item.title,
          link: item.link || "",
          type: item.type,
        },
      });
    }
  }

  public async generate() {
    const updatedNewsItemsInfo = this.updatedNewsItemsInfo;
    // 新しいお知らせや更新されたお知らせがない場合は何もしない
    if (
      updatedNewsItemsInfo.new.length == 0 &&
      updatedNewsItemsInfo.updated.length == 0
    )
      return [];

    const messages = this._generate(updatedNewsItemsInfo);
    return messages;
  }

  public async generateForX() {
    return this._generateForX(this.updatedNewsItemsInfo);
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
        if (item.isType(type) && item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0)))) {
          message += item.toString() + "\n";
        }
      }
      for (const item of updatedNewsItemsInfo.updated) {
        const originalItem = this.newsItems.find(
          (newsItem) => newsItem.link === item.link
        );
        if (!originalItem) continue;

        const isNotified = originalItem.type == NotifyType.ALL || originalItem.type == type;
        if (!isNotified && !item.isType(type) && item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0)))) {
          message += item.toString() + "\n";
        }
      }

      if (message === "") messages.push(undefined);

      message += this.messageFooter;
      messages.push(message);
    }

    return messages;
  }

  private _generateForX(updatedNewsItemsInfo: updatedNewsItemsInfo) {
    const posts: Array<string> = [];

    for (const item of updatedNewsItemsInfo.new) {
      if (item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0))))
        posts.push(item.toString() + "\m" + this._generateNotifyTypeTag(item.type));
    }
    for (const item of updatedNewsItemsInfo.updated) {
      const originalItem = this.newsItems.find(
        (newsItem) => newsItem.link === item.link
      );
      if (!originalItem) continue;

      const isNotified = originalItem.type == NotifyType.ALL;
      if (!isNotified && item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0))))
        posts.push(item.toString() + "\n" + this._generateNotifyTypeTag(item.type));
    }

    return posts;
  }

  private _generateNotifyTypeTag(type: NotifyType) {
    switch (type) {
      case NotifyType.FIRST_YEAR:
        return "#東大教養1年生向けお知らせ";
      case NotifyType.SECOND_YEAR:
        return "#東大教養2年生向けお知らせ";
      case NotifyType.ALL:
      default:
        return "#東大教養1年生向けお知らせ #東大教養2年生向けお知らせ";
    }
  }

  // 新しいお知らせや更新されたお知らせを検出する
  private detectNewNewsItem(
    notifiedNewsItems: Array<{ id: number; link: string; type: number }>
  ): updatedNewsItemsInfo {
    const result = new updatedNewsItemsInfo();
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
