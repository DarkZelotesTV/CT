import fs from "fs";
import path from "path";
import { app } from "electron";

type StoreData = Record<string, any>;

function getFilePath() {
  return path.join(app.getPath("userData"), "local-store.json");
}

export function readStore(): StoreData {
  try {
    const p = getFilePath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

export function writeStore(data: StoreData) {
  const p = getFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

export function getValue<T>(key: string, fallback: T): T {
  const s = readStore();
  return (s[key] ?? fallback) as T;
}

export function setValue(key: string, value: any) {
  const s = readStore();
  s[key] = value;
  writeStore(s);
}
