process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST;
process.env.PORT = process.env.PORT || process.env.SERVER_PORT || "3000";

await import("../.output/server/index.mjs");
