import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
import LINENotify from "./lib/LINENotify";
import { TwitterApi } from "twitter-api-v2";
import ZenkiNewsFetcher from "./lib/zenki/NewsFetcher";
import { NotifyCycle } from "./lib/NotifyCycle";
import { PrismaClient } from "@prisma/client";
import DailyMessagesGenerator from "./lib/notify/DailyMessagesGenerator";
import RealtimeMessagesGenerator from "./lib/notify/RealtimeMessagesGenerator";
import { program } from "commander";
program
  .option("-d, --daily", "Send daily notifications")
  .option("-r, --realtime", "Send realtime notifications")
  .option("-x, --with-x", "Also send realtime notifications via X ")
  .parse(process.argv);
const options = program.opts();

const prisma = new PrismaClient();

const MESSAGE_FOOTER = "\n連携解除はこちら(https://notify-bot.line.me/my/)";

async function notify(token: string, message: string, tokenId: number) {
  const notify = new LINENotify();
  try {
    await notify.notify(token, message);
  } catch (error) {
    if (notify.isTokenInvalidError(error) || notify.isNotifyNotJoinGroupError(error)) {
      try {
        await prisma.line_notify_tokens.delete({
          where: { id: tokenId },
        });
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "message" in error) {
          console.error(
            `Error deleting token ${token} from database:`,
            (error as Error).message
          );
        }
      }
    } else {
      console.error(
        `Error sending LINE Notify message(token: ${token}):`,
        error
      );
    }
  }
}

async function main() {
  const newsFetcher = new ZenkiNewsFetcher();
  const newsItems = await newsFetcher.fetch();
  if (newsItems.length == 0) return;

  if (options.daily) {
    const generator = new DailyMessagesGenerator(newsItems, MESSAGE_FOOTER);
    const messages = await generator.generate();
    try {
      const results = await prisma.line_notify_tokens.findMany({
        select: {
          id: true,
          token: true,
          notify_type: true,
        },
        where: {
          notify_cycle: NotifyCycle.Daily,
        },
      });

      for (const result of results) {
        const message = messages[result.notify_type];
        if (message) {
          await notify(result.token, message, result.id);
        }
      }
    } catch (error) {
      console.error("Error querying tokens from database:", error);
    }
  } else if (options.realtime) {
    const generator = new RealtimeMessagesGenerator(
      newsItems,
      MESSAGE_FOOTER,
      prisma
    );
    await generator.update();
    const messages = await generator.generate();
    try {
      const results = await prisma.line_notify_tokens.findMany({
        select: {
          id: true,
          token: true,
          notify_type: true,
        },
        where: {
          notify_cycle: NotifyCycle.Realtime,
        },
      });

      for (const result of results) {
        const message = messages[result.notify_type];
        if (message) {
          await notify(result.token, message, result.id);
        }
      }
    } catch (error) {
      console.error("Error querying tokens from database:", error);
    }

    if (
      options.withX &&
      process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET
    ) {
      const XClient = new TwitterApi({
        appKey: process.env.X_API_KEY,
        appSecret: process.env.X_API_SECRET,
        accessToken: process.env.X_ACCESS_TOKEN,
        accessSecret: process.env.X_ACCESS_SECRET,
      });
      const posts = await generator.generateForX();
      for (const post of posts) {
        await XClient.v2.tweet(post);
      }
    }
  } else {
    console.error("You must specify either --daily or --realtime");
    process.exit(1);
  }
}

main();
