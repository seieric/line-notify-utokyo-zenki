import { NotifyType } from "./NotifyType";

export default class NewsItem {
  public title: string;
  public link: string | undefined;
  public type: NotifyType;
  public date: Date;

  constructor(
    title: string,
    link: string | undefined,
    type: NotifyType,
    date: Date
  ) {
    this.title = title;
    this.link = link;
    this.type = type;
    this.date = date;
  }

  public isType(type: NotifyType): boolean {
    if (type === NotifyType.ALL) return true;
    return this.type === type || this.type === NotifyType.ALL;
  }

  public isNotOlderThan(date: Date): boolean {
    return this.date >= date;
  }

  public toString(): string {
    return `${this.title}(${this.link})`;
  }
}
