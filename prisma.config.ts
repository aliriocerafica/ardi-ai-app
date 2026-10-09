import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { getDirectDatabaseUrl } from "./lib/env";

getDirectDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
