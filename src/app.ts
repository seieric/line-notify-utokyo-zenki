// Fastify
import fastify from "fastify";
import fastifySession from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import fastifyView from "@fastify/view";
import fastifyFormBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
// Redis
import RedisStore from "connect-redis";
import { Redis } from "ioredis";
import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, "/../.env");
dotenv.config({ path: ENV_PATH });

// routes
import trackingRoutes from "./routes/t";
import indexRoutes from "./routes/index";
import authRoutes from "./routes/auth";

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

app.setNotFoundHandler((req, res) => {
  res.status(404).view("error", {
    title: "404 Not Found",
    message: "お探しのページは見つかりませんでした。",
  });
});

// routes
app.register(indexRoutes);
app.register(trackingRoutes);
app.register(authRoutes);

const port = parseInt(process.env.PORT || "3000");
app.listen({ port }, (err) => {
  if (err) throw err;
});
