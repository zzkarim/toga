import { PrismaClient } from "@prisma/client";
const globalDb = globalThis;
export const db = globalDb.togaDb || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.togaDb = db;
