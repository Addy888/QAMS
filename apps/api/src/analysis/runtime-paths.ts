import * as fs from "fs";
import * as path from "path";

function uniquePaths(paths: string[]) {
  return [...new Set(paths.map((value) => path.resolve(value)))];
}

export function getApiRoot() {
  const candidates = uniquePaths([
    process.cwd(),
    path.resolve(process.cwd(), "apps", "api"),
    path.resolve(process.cwd(), ".."),
  ]);

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "src")) &&
      fs.existsSync(path.join(candidate, "package.json"))
    ) {
      return candidate;
    }
  }

  return process.cwd();
}

export function getWorkspaceRoot() {
  const apiRoot = getApiRoot();
  const candidate = path.resolve(apiRoot, "..", "..");

  if (fs.existsSync(path.join(candidate, "apps"))) {
    return candidate;
  }

  return apiRoot;
}

export function getRecordingsDirectory() {
  const workspaceDir = path.join(getWorkspaceRoot(), "uploads", "recordings");
  const apiDir = path.join(getApiRoot(), "uploads", "recordings");

  if (fs.existsSync(workspaceDir) || !fs.existsSync(apiDir)) {
    return workspaceDir;
  }

  return apiDir;
}

export function ensureRecordingsDirectory() {
  const recordingsDir = getRecordingsDirectory();
  if (!fs.existsSync(recordingsDir)) {
    try {
      fs.mkdirSync(recordingsDir, { recursive: true });
    } catch (err: any) {
      console.warn(`[runtime-paths] Cannot create recordings directory (read-only FS?): ${err.message}`);
    }
  }
  return recordingsDir;
}

export function toStoredAudioPath(absolutePath: string) {
  const recordingsDir = ensureRecordingsDirectory();
  const relativePath = path.relative(path.dirname(recordingsDir), absolutePath);
  return relativePath.split(path.sep).join("/");
}

export function resolveAudioPath(audioPath: string) {
  if (path.isAbsolute(audioPath)) {
    return audioPath;
  }

  const normalized = audioPath.replace(/\//g, path.sep);
  const candidates = uniquePaths([
    path.join(getWorkspaceRoot(), normalized),
    path.join(getApiRoot(), normalized),
    path.join(process.cwd(), normalized),
  ]);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function resolveApiPath(...segments: string[]) {
  return path.join(getApiRoot(), ...segments);
}
