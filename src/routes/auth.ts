import {
  Type,
  FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import prisma from "../lib/db";
import axios from "axios";
import * as querystring from "querystring";
import crypto from "crypto";
import { NotifyType } from "../lib/zenki/NotifyType";
import { NotifyCycle } from "../lib/NotifyCycle";
import LINENotify from "../lib/LINENotify";
const notify = new LINENotify();

function generateRandomString() {
  return crypto.randomBytes(20).toString("hex");
}

const authRoutes: FastifyPluginAsyncTypebox = async function (fastify) {
  fastify.get("/redirect", (req, res) => {
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

  fastify.get(
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
            },
          });
          if (req.session.trackingTag) {
            const trackingTag = await prisma.trackingTag.findFirst({
              where: {
                name: req.session.trackingTag,
              },
            });
            if (trackingTag) {
              await prisma.registrationHistory.update({
                where: {
                  id: registrationHistory.id,
                },
                data: {
                  tracking_tag_id: trackingTag.id,
                },
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
              "通知を受け取りたいお知らせの学年・通知頻度を選択してください。本ページで回答せずに閉じると、すべてのお知らせが1日1回まとめて通知されます。",
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

  fastify.post(
    "/finish",
    {
      schema: {
        body: Type.Object({
          notify_type: Type.Enum(NotifyType),
          notify_cycle: Type.Enum(NotifyCycle),
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
      req.session.csrfToken = "";

      if (
        req.session.tokenId === undefined ||
        req.session.token === undefined
      ) {
        return res.status(400).view("error", {
          message: "Invalid session",
        });
      }

      const notifyType = req.body.notify_type;
      const notifyCycle = req.body.notify_cycle;
      try {
        // 通知設定を反映
        await prisma.line_notify_tokens.update({
          where: {
            id: req.session.tokenId,
          },
          data: {
            notify_type: notifyType,
            notify_cycle: notifyCycle,
          },
        });

        let message = "以下の内容で通知設定が完了しました。\n";
        switch (notifyType) {
          case NotifyType.FIRST_YEAR:
            message += "通知するお知らせ: 1年生向け\n";
            break;
          case NotifyType.SECOND_YEAR:
            message += "通知するお知らせ: 2年生向け\n";
            break;
          case NotifyType.ALL:
          default:
            message += "通知するお知らせ: すべて\n";
            break;
        }
        switch (notifyCycle) {
          case NotifyCycle.Realtime:
            message += "通知頻度: 掲載されたらすぐに";
            break;
          case NotifyCycle.Daily:
          default:
            message += "通知頻度: 1日1回まとめて(18時)";
            break;
        }

        try {
          await notify.notify(req.session.token, message);
        } catch (error) {
          if (notify.isNotifyNotJoinGroupError(error)) {
            await prisma.line_notify_tokens.delete({
              where: { id: req.session.tokenId },
            });
            return res.status(400).view("error", {
              title: "エラー",
              message:
                "あなたはLINEグループに通知設定をしましたが、LINE Notifyがグループに参加していないため、通知を送信できません。登録は完了していませんので、もう一度登録し直してください。",
            });
          } else {
            throw error;
          }
        }
        await notify.notify(req.session.token, message);

        return res.view("finish", {
          title: "連携完了",
          message: "連携しました。このページは閉じて問題ありません。",
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
};

export default authRoutes;
