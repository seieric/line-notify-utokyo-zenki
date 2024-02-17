import DailyMessagesGenerator from "#/lib/notify/DailyMessagesGenerator";
import NewsItem from "#/lib/zenki/NewsItem";

// テストデータ
const newsItems = [
  new NewsItem("お知らせ0", "link0", 0, new Date()),
  new NewsItem("お知らせ1", "link1", 1, new Date()),
  new NewsItem("お知らせ2", "link2", 2, new Date()),
];

test("generate should return proper messages", () => {
  const generator = new DailyMessagesGenerator(newsItems, "フッター");
  const messages = generator.generate();
  expect(messages).toEqual([
    `${newsItems[0].toString()}\n${newsItems[1].toString()}\n${newsItems[2].toString()}\nフッター`,
    `${newsItems[0].toString()}\n${newsItems[1].toString()}\nフッター`,
    `${newsItems[0].toString()}\n${newsItems[2].toString()}\nフッター`,
  ]);
});

test("generate should return undefined when no news for target type", () => {
  const generator = new DailyMessagesGenerator(newsItems.filter((item) => item.type == 2), "フッター");
  const messages = generator.generate();
  expect(messages).toEqual([
    `${newsItems[2].toString()}\nフッター`,
    undefined,
    `${newsItems[2].toString()}\nフッター`,
  ]);
});
