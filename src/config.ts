import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const cwd = process.cwd();

export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: path.resolve(cwd, process.env.DB_PATH || "./data/activity.db"),
  /** Enable SQLite WAL mode (recommended for concurrent reads/writes). */
  sqliteWal: process.env.SQLITE_WAL !== "0",
};
