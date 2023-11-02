import express from "express";
import axios from "axios";
import * as querystring from "querystring";
import session from "express-session";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { connectToDatabase } from "./db";

const ENV_PATH = path.join(__dirname, '/../.env');
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
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

app.get("/", (req, res) => {
  const state = generateRandomString();
  if (req.session) {
    req.session.state = state;
  }

  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/auth", (req, res) => {
  const state = req.session ? req.session.state : "";

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

  const connection = connectToDatabase();
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];

  connection.query(
    "INSERT INTO line_notify_tokens (token, access_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)",
    [accessToken, ipAddress, userAgent],
    (error) => {
      if (error) {
        console.error("Error saving token to database: " + error);
        return res.status(500).send("Error saving token to database");
      }

      res.send("LINE Notify Access Token saved to database");
    }
  );

  // データベース接続を閉じる
  connection.end();
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
