import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
import LINENotify from "./lib/LINENotify";
import ZenkiNewsFetcher from "./lib/zenki/NewsFetcher";
import { NotifyType } from "./lib/zenki/NotifyType";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const MESSAGE_FOOTER = "\n連携解除はこちら(https://notify-bot.line.me/my/)";

async function notify(token: string, message: string, tokenId: number) {
  const notify = new LINENotify();
  try {
    await notify.notify(token, message);
  } catch (error) {
    if (notify.isTokenInvalidError(error)) {
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

  let messages: string[] = [];

  for (const type of [
    NotifyType.ALL,
    NotifyType.FIRST_YEAR,
    NotifyType.SECOND_YEAR,
  ]) {
    let message = "";
    for (const item of newsItems) {
      if (
        item.isType(type) &&
        item.isNotOlderThan(new Date(new Date().setHours(0, 0, 0, 0)))
      ) {
        message += item.toString() + "\n";
      }
    }

    if (message === "") continue;

    message += MESSAGE_FOOTER;
    messages.push(message);
  }

  try {
    const results = await prisma.line_notify_tokens.findMany({
      select: {
        id: true,
        token: true,
        notify_type: true,
      },
    });

    for (const result of results) {
      if (messages[result.notify_type]) {
        await notify(result.token, messages[result.notify_type], result.id);
      }
    }
  } catch (error) {
    console.error("Error querying tokens from database:", error);
  }

  process.exit(0);
}

main();
