import express from "express";
import axios from "axios";
import * as querystring from "querystring";
import session from "express-session";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { getDBConnection } from "./db";

const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
const app = express();
const port = process.env.PORT || 3000;

declare module "express-session" {
  interface SessionData {
    state: string;
  }
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.set('view engine', 'pug');

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

app.set('trust proxy', 'loopback');
// publicディレクトリを公開
app.use(express.static(path.join(__dirname, "../public")));

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
  const receivedState = req.query.state;
  const sessionState = req.session ? req.session.state : "";

  if (!receivedState || !sessionState || receivedState !== sessionState) {
    return res.status(400).send("Invalid state parameter");
  }
  // 2回目からのアクセスはstateを削除
  if (req.session) {
    req.session.state = undefined;
  }
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

  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];

  const connection = await getDBConnection();

  try {
    // データベースにトークンと関連情報を保存
    await connection.execute(
      "INSERT INTO line_notify_tokens (token, access_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)",
      [accessToken, ipAddress, userAgent]
    );

    res.render("finish", {title: "連携完了", message: "連携しました。お知らせは毎日18時に配信されます。このページは閉じて問題ありません。"})
  } catch (error) {
    console.error("Error saving token to database: " + error);
    res.status(500).render("finish", {title: "エラー", message: "連携情報を保存するのに失敗しました。しばらく時間をおいてもう一度お試しください。"})
  } finally {
    connection.release(); // コネクションを解放
  }
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
