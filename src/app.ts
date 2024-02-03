import express from "express";
import axios from "axios";
import * as querystring from "querystring";
import session from "express-session";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { getDBConnection } from "./db";
import { ResultSetHeader } from "mysql2";

const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });
const app = express();
const port = process.env.PORT || 3000;

declare module "express-session" {
  interface SessionData {
    state: string;
    csrfToken: string;
    tokenId: number;
  }
}

enum NotifyType {
  ALL,
  FIRST_YEAR,
  SECOND_YEAR,
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.set("view engine", "pug");

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

app.set("trust proxy", "loopback");
// publicディレクトリを公開
app.use(express.static(path.join(__dirname, "../public")));

app.use(express.urlencoded({extended:true}))

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
    const result = await connection.execute<ResultSetHeader>(
      "INSERT INTO line_notify_tokens (token, access_time, ip_address, user_agent, notify_type) VALUES (?, NOW(), ?, ?, 0)",
      [accessToken, ipAddress, userAgent]
    );

    req.session.tokenId = result[0].insertId;

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
  } finally {
    connection.release(); // コネクションを解放
  }
});

app.post("/finish", async (req, res) => {
  const connection = await getDBConnection();

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

  if (!req.session.tokenId) {
    return res.status(400).send("Invalid session");
  }

  try {
    // 通知設定を反映
    await connection.execute(
      "UPDATE line_notify_tokens SET notify_type = ? WHERE id = ?",
      [req.body.notify_type, req.session.tokenId]
    );

    res.render("finish", {
      title: "連携完了",
      message:
        "連携しました。お知らせは毎日18時に配信されます。このページは閉じて問題ありません。",
    });
  } catch (error) {
    console.error("Error updating notify_type to database: " + error);
    res.status(500).render("finish", {
      title: "エラー",
      message:
        "通知内容を保存するのに失敗しました。すべてのお知らせが通知されます。希望しない場合は、一度登録を解除してもう一度登録し直してください。",
    });
  } finally {
    connection.release(); // コネクションを解放
  }
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
