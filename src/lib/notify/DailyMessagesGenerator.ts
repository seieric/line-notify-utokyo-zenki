import { NotifyType } from "../zenki/NotifyType";
import NewsItem from "../zenki/NewsItem";

export default class DailyMessagesGenerator{
  private newsItems: Array<NewsItem>;
  private messageFooter: string;

  constructor(freshNewsItems: Array<NewsItem>, messageFooter: string){
    this.newsItems = freshNewsItems;
    this.messageFooter = messageFooter;
  }

  public generate(){
    let messages: (string | undefined)[]= [];
    for (const type of [
      NotifyType.ALL,
      NotifyType.FIRST_YEAR,
      NotifyType.SECOND_YEAR,
    ]) {
      let message = "";
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
}