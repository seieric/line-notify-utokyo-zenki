import RealtimeMessagesGenerator from "#/lib/notify/RealtimeMessagesGenerator";
import NewsItem from "#/lib/zenki/NewsItem";
import { PrismaClient } from "@prisma/client";

// 条件分岐を網羅できるテストデータ
const notifiedNewsItems = [
  { id: 1, link: "https://example.com/1", type: 1 },
  { id: 2, link: "https://example.com/2", type: 1 },
  { id: 3, link: "https://example.com/3", type: 0 },
];
const newsItems = [
  new NewsItem("お知らせ1", "https://example.com/1", 1, new Date()), // 既存のお知らせ
  new NewsItem("お知らせ2", "https://example.com/2", 0, new Date()), // 対象の学年が増えたお知らせ(1年生向け→全学年向け)
  new NewsItem("お知らせ3", "https://example.com/3", 2, new Date()), // 対象の学年が減ったお知らせ(全学年向け→2年生向け)
  new NewsItem("お知らせ4", "https://example.com/4", 1, new Date()), // 新しいお知らせ
];
// notifiedNewsItemsと同じ内容のデータを持つNewsItem
const sameNewsItems = [
  new NewsItem("お知らせ1", "https://example.com/1", 1, new Date()),
  new NewsItem("お知らせ2", "https://example.com/2", 1, new Date()),
  new NewsItem("お知らせ3", "https://example.com/3", 0, new Date()),
];
const prisma = new PrismaClient();

test("detectNewNewsItem should return new or updated NewsItem", () => {
  const generator = new RealtimeMessagesGenerator(newsItems, "フッター", prisma);
  const detectNewNewsItem = generator["detectNewNewsItem"].bind(generator);
  // 新しいお知らせを検出する
  const newNewsItems = detectNewNewsItem(notifiedNewsItems);
  expect(newNewsItems).toEqual({
    new: [newsItems[3]], // 新しいお知らせ
    updated: [newsItems[1], newsItems[2]], // 学年が更新されたお知らせ
    updatedIds: [2, 3], // 学年が更新されたお知らせのデータベース上のID
  });
});

test("detectNewsItem should return empty arrays when no new news given", () => {
  const generator = new RealtimeMessagesGenerator(sameNewsItems, "フッター", prisma);
  const detectNewNewsItem = generator["detectNewNewsItem"].bind(generator);
  // 新しいお知らせがない場合
  const newNewsItems = detectNewNewsItem(notifiedNewsItems);
  expect(newNewsItems).toEqual({
    new: [], // 新しいお知らせ
    updated: [], // 学年が更新されたお知らせ
    updatedIds: [], // 学年が更新されたお知らせのデータベース上のID
  });
});