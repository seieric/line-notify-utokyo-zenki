import {
  Type,
  FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import prisma from "../lib/db";

const trackingRoutes: FastifyPluginAsyncTypebox = async function (fastify) {
  fastify.get(
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
        return res.callNotFound();
      } else {
        req.session.touch();
        req.session.trackingTag = req.params.name;
        return res.redirect("/");
      }
    }
  );
};

export default trackingRoutes;
