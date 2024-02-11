import express from "express";
import axios from "axios";
import * as querystring from "querystring";
import RedisStore from "connect-redis";
import session from "express-session";
import { createClient } from "redis";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { NotifyType } from "./lib/zenki/NotifyType";
import LINENotify from "./lib/LINENotify";
const notify = new LINENotify();
const prisma = new PrismaClient();

const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
const app = express();
const port = process.env.PORT || 3000;

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
redisClient.connect().catch(console.error);

const redisStore = new RedisStore({
  client: redisClient,
});

declare module "express-session" {
  interface SessionData {
    state: string;
    csrfToken: string;
    tokenId: number;
    token: string;
  }
}

app.use(
  session({
    name: "session",
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
    store: redisStore,
  })
);
app.set("view engine", "pug");

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

app.set("trust proxy", "loopback");
// publicディレクトリを公開
app.use(express.static(path.join(__dirname, "../public")));

app.use(express.urlencoded({ extended: true }));

app.get("/auth", (req, res) => {
  const state = generateRandomString();
  if (req.session) {
    req.session.state = state;
  } else {
    res.status(400).send("Invalid session");
  }

  const params = querystring.stringify({
    response_type: "code",
    client_id: process.env.LINE_NOTIFY_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    scope: "notify",
    state,
  });

  res.redirect(`https://notify-bot.line.me/oauth/authorize?${params}`);
});

app.get("/callback", async (req, res) => {
  if (req.query.error) {
    return res.render("finish", {
      title: "連携エラー",
      message:
        "認証連携が中断されました。本サービスに登録したい場合は、もう一度トップページから進んでください。",
    });
  }

  if (
    !req.query.state ||
    !req.query.code ||
    !req.session.state ||
    req.query.state !== req.session.state
  ) {
    req.session.state = undefined;
    return res.status(400).send("Invalid request");
  }

  // 2回目からのアクセスはstateを削除
  req.session.state = undefined;

  try {
    const code = req.query.code as string;
    const tokenResponse = await axios.post(
      "https://notify-bot.line.me/oauth/token",
      querystring.stringify({
        code,
        client_id: process.env.LINE_NOTIFY_CLIENT_ID,
        client_secret: process.env.LINE_NOTIFY_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log("LINE Notify Access Token:", accessToken);
    // データベースにトークンと関連情報を保存
    const result = await prisma.line_notify_tokens.create({
      data: {
        token: accessToken,
        access_time: new Date(),
        ip_address: req.ip || "", // Set a default value of an empty string if req.ip is undefined
        user_agent: req.headers["user-agent"] || "",
      },
    });

    req.session.tokenId = result.id;
    req.session.token = accessToken;

    // CSRFトークンを生成
    const csrfToken = generateRandomString();
    req.session.csrfToken = csrfToken;

    res.render("select", {
      title: "通知内容の選択",
      message:
        "通知を受け取りたいお知らせの学年を選択してください。本ページで回答せずに閉じると、すべてのお知らせが通知されます。",
      csrfToken: csrfToken,
    });
  } catch (error) {
    console.error("Error saving token to database: " + error);
    res.status(500).render("finish", {
      title: "エラー",
      message:
        "連携情報を保存するのに失敗しました。しばらく時間をおいてもう一度お試しください。",
    });
  }
});

app.post("/finish", async (req, res) => {
  if (!req.session || !req.body || req.body._csrf !== req.session.csrfToken) {
    return res.status(400).send("Invalid CSRF token");
  }

  if (
    !req.body.notify_type ||
    ![NotifyType.ALL, NotifyType.FIRST_YEAR, NotifyType.SECOND_YEAR].includes(
      Number(req.body.notify_type)
    )
  ) {
    return res.status(400).send("Invalid request");
  }

  if (!req.session.tokenId || !req.session.token) {
    return res.status(400).send("Invalid session");
  }

  // notify_typeを数字に変換
  const notifyType = parseInt(req.body.notify_type);
  try {
    // 通知設定を反映
    await prisma.line_notify_tokens.update({
      where: {
        id: req.session.tokenId,
      },
      data: {
        notify_type: notifyType,
      },
    });

    let message = "";
    switch (notifyType) {
      case NotifyType.FIRST_YEAR:
        message = "1年生向けのお知らせを通知します。";
        break;
      case NotifyType.SECOND_YEAR:
        message = "2年生向けのお知らせを通知します。";
        break;
      case NotifyType.ALL:
      default:
        message = "すべてのお知らせを通知します。";
        break;
    }

    await notify.notify(
      req.session.token,
      `通知設定が完了しました。${message}毎日18時にお知らせを配信します。`
    );

    res.render("finish", {
      title: "連携完了",
      message:
        "連携しました。お知らせは毎日18時に配信されます。このページは閉じて問題ありません。",
      isHideLink: true,
    });
  } catch (error) {
    console.error("Error updating notify_type to database: " + error);
    res.status(500).render("finish", {
      title: "エラー",
      message:
        "通知内容を保存するのに失敗しました。すべてのお知らせが通知されます。希望しない場合は、一度登録を解除してもう一度登録し直してください。",
    });
  }
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
