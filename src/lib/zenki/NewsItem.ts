import { NotifyType } from "./NotifyType";

export default class NewsItem {
  private title: string;
  private link: string | undefined;
  private type: NotifyType;
  private date: Date;

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
