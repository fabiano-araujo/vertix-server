import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      "info",
      "warn",
      "error",
    ],
  });
  prisma.$on("query", e => {
    console.log("Query: " + e.query);
    console.log("Duration: " + e.duration + "ms");
  });
  export { prisma };