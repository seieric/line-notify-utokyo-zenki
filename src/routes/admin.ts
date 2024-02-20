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
      const announcements = await prisma.announcement.findMany(
        {
          orderBy: {
            updated_at: "desc",
          },
          take: 50,
        },
      );
      return res.view("admin/announcement.pug", { announcements });
    });
  });
};

export default adminRoutes;
