import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const target = path.join(root, "client", "public", "build-info.json");

const getGitCommit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
};

const payload = {
  builtAt: new Date().toISOString(),
  commit: getGitCommit(),
  node: process.version,
};

fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`✅ build-info written: ${target}`);
console.log(payload);
