import { FastifyInstance } from "fastify";

const indexRoutes = async function (fastify: FastifyInstance) {
  fastify.get("/", (req, res) => {
    res.view("index.pug");
  });
};

export default indexRoutes;
