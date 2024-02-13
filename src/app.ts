// Fastify
import fastify from "fastify";
import fastifySession from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import fastifyView from "@fastify/view";
import fastifyFormBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import { Type, TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
// OAuth周りの処理用
import axios from "axios";
import * as querystring from "querystring";
// Redis
import RedisStore from "connect-redis";
import { Redis } from "ioredis";
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

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

// initialize fastify
const app = fastify({
  logger: true,
  trustProxy: "127.0.0.1",
}).withTypeProvider<TypeBoxTypeProvider>();

// session
// redis
const redisClient = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379"
);
redisClient.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
// @fastify/session
app.register(fastifyCookie);
app.register(fastifySession, {
  cookieName: "session",
  secret:
    process.env.SESSION ||
    "your-secret-key-must-be-at-least-32-characters-long",
  saveUninitialized: true,
  store: new RedisStore({ client: redisClient }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
declare module "@fastify/session" {
  interface FastifySessionObject {
    state: string | undefined;
    csrfToken: string;
    tokenId: number;
    token: string;
    trackingTag: string;
  }
}

// view engine
app.register(fastifyView, {
  engine: {
    pug: require("pug"),
  },
  root: path.join(__dirname, "../views"),
});

// publicディレクトリを公開
app.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
  cacheControl: true,
  maxAge: "7d",
});

// x-www-form-urlencodedに対応
app.register(fastifyFormBody);

// カスタムエラーページ
app.setErrorHandler((error, req, res) => {
  req.log.error(error);
  res.status(error.statusCode || 500).view("error", {
    message: error.message,
  });
});

// routes
app.get("/", (req, res) => {
  res.view("index.pug");
});

app.get(
  "/t/:name",
  {
    schema: {
      params: Type.Object({
        name: Type.String(),
      }),
    },
  },
  async (req, res) => {
    const trackingTag = await prisma.trackingTag.findFirst({
      where: {
        name: req.params.name,
      },
    });
    if (!trackingTag) {
      return res.status(404).send("Invalid parameter.")
    } else {
      req.session.touch();
      req.session.trackingTag = req.params.name;
      return res.redirect("/");
    }
  }
);

app.get("/auth", (req, res) => {
  const state = generateRandomString();
  req.session.state = state;

  const params = querystring.stringify({
    response_type: "code",
    client_id: process.env.LINE_NOTIFY_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    scope: "notify",
    state,
  });

  res.redirect(`https://notify-bot.line.me/oauth/authorize?${params}`);
});

app.get(
  "/callback",
  {
    schema: {
      querystring: Type.Union([
        Type.Object({
          error: Type.String(),
        }),
        Type.Object({
          code: Type.String(),
          state: Type.String(),
        }),
      ]),
    },
  },
  async (req, res) => {
    if ("error" in req.query) {
      return res.view("finish", {
        title: "連携エラー",
        message:
          "認証連携が中断されました。本サービスに登録したい場合は、もう一度トップページから進んでください。",
      });
    } else {
      if (req.query.state !== req.session.state) {
        req.session.state = undefined;
        return res.status(400).view("error", {
          message: "Invalid request",
        });
      }

      // 2回目からのアクセスはstateを削除
      req.session.state = undefined;

      try {
        const tokenResponse = await axios.post(
          "https://notify-bot.line.me/oauth/token",
          querystring.stringify({
            code: req.query.code,
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
        const registrationHistory = await prisma.registrationHistory.create({
          data: {
            ip_address: req.ip || "",
            user_agent: req.headers["user-agent"] || "",
          }
        });
        if (req.session.trackingTag) {
          const trackingTag = await prisma.trackingTag.findFirst({
            where: {
              name: req.session.trackingTag
            }
          });
          if(trackingTag){
            await prisma.registrationHistory.update({
              where: {
                id: registrationHistory.id
              },
              data: {
                tracking_tag_id: trackingTag.id
              }
            });
          }
        }
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

        return res.view("select.pug", {
          title: "通知内容の選択",
          message:
            "通知を受け取りたいお知らせの学年を選択してください。本ページで回答せずに閉じると、すべてのお知らせが通知されます。",
          csrfToken: csrfToken,
        });
      } catch (error) {
        req.log.error(error);
        return res.status(500).view("finish.pug", {
          title: "エラー",
          message:
            "連携情報を保存するのに失敗しました。しばらく時間をおいてもう一度お試しください。",
        });
      }
    }
  }
);

app.post(
  "/finish",
  {
    schema: {
      body: Type.Object({
        notify_type: Type.Enum(NotifyType),
        _csrf: Type.String(),
      }),
    },
  },
  async (req, res) => {
    if (req.body._csrf !== req.session.csrfToken) {
      return res.status(400).view("error", {
        message: "CSRF verification failed",
      });
    }

    if (req.session.tokenId === undefined || req.session.token === undefined) {
      return res.status(400).view("error", {
        message: "Invalid session",
      });
    }

    const notifyType = req.body.notify_type;
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

      return res.view("finish", {
        title: "連携完了",
        message:
          "連携しました。お知らせは毎日18時に配信されます。このページは閉じて問題ありません。",
        isHideLink: true,
      });
    } catch (error) {
      req.log.error(error);
      return res.status(500).view("finish", {
        title: "エラー",
        message:
          "通知内容を保存するのに失敗しました。すべてのお知らせが通知されます。希望しない場合は、一度登録を解除してもう一度登録し直してください。",
      });
    }
  }
);

const port = parseInt(process.env.PORT || "3000");
app.listen({ port }, (err) => {
  if (err) throw err;
});
