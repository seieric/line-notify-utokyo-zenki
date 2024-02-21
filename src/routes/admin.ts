import {
  Type,
  FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import prisma from "../lib/db";

const adminRoutes: FastifyPluginAsyncTypebox = async function (fastify) {
  fastify.after(() => {
    fastify.addHook("preHandler", fastify.auth([fastify.basicAuth]));

    fastify.get("/", (req, res) => {
      return res.view("admin/index.pug");
    });

    fastify.get("/announcement", async (req, res) => {
      const announcements = await prisma.announcement.findMany({
        orderBy: {
          updated_at: "desc",
        },
        take: 50,
      });
      return res.view("admin/announcement.pug", { announcements });
    });

    fastify.post(
      "/announcement",
      {
        schema: {
          body: Type.Object({
            title: Type.String(),
            content: Type.String(),
            send_at: Type.String({ format: "date" }),
          }),
        },
      },
      async (req, res) => {
        const { title, content, send_at } = req.body;
        const announcement = await prisma.announcement.create({
          data: {
            title,
            content,
            send_at: new Date(send_at),
          },
        });
        return res.redirect(302, `/admin/announcement/${announcement.id}`);
      }
    );

    fastify.get(
      "/announcement/:id",
      {
        schema: {
          params: Type.Object({
            id: Type.Number(),
          }),
        },
      },
      async (req, res) => {
        const announcement = await prisma.announcement.findUnique({
          where: {
            id: req.params.id,
          },
        });
        if (!announcement) return res.status(404).send("Not Found");
        const send_at = announcement.send_at.toISOString().split("T")[0];
        return res.view("admin/announcement-detail.pug", {
          announcement,
          send_at,
        });
      }
    );

    fastify.post(
      "/announcement/:id",
      {
        schema: {
          params: Type.Object({
            id: Type.Number(),
          }),
          body: Type.Union([
            Type.Object({
              title: Type.String(),
              content: Type.String(),
              send_at: Type.String({ format: "date" }),
              _method: Type.Literal("PUT"),
            }),
            Type.Object({
              _method: Type.Literal("DELETE"),
            }),
          ]),
        },
      },
      async (req, res) => {
        if (req.body._method === "DELETE") {
          const announcement = await prisma.announcement.findUnique({
            where: {
              id: req.params.id,
            },
          });
          if (!announcement) return res.status(404).send("Not Found");
          await prisma.announcement.delete({
            where: {
              id: req.params.id,
            },
          });
          return res.redirect(302, "/admin/announcement");
        }
        const { title, content, send_at } = req.body;
        const announcement = await prisma.announcement.update({
          where: {
            id: req.params.id,
          },
          data: {
            title,
            content,
            send_at: new Date(send_at),
          },
        });
        const send_at_ = announcement.send_at.toISOString().split("T")[0];
        return res.view("admin/announcement-detail.pug", {
          announcement,
          send_at: send_at_,
        });
      }
    );
  });
};

export default adminRoutes;
