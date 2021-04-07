import { MavenWatcher } from "./mavenWatcher";
import { NodeWatcher as NpmWatcher } from "./npmWatcher";
import { PythonWatcher as PipWatcher } from "./pipWatcher";
import { Watcher } from "./watcher";

const WatchType: Record<string, new () => Watcher> = {
  PIP: PipWatcher,
  NPM: NpmWatcher,
  MAVEN: MavenWatcher,
};

export function getWatchTypes(): string[] {
  return Object.keys(WatchType);
}

export function getWatcher(type: string): Watcher {
  // ensure it is lower case
  type = type.toLowerCase();

  for (const [key, WatcherImpl] of Object.entries(WatchType)) {
    if (key.toLowerCase() === type) {
      return new WatcherImpl();
    }
  }
  throw new Error("invalid watcher type: " + type);
}
