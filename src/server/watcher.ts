import { Project } from "./entity/project";
import {
  AlreadyHasActiveConnectionError,
  createConnection,
  getManager,
} from "typeorm";
import { getWatcher } from "./watcher/watch";

let running = false;

export async function watch(): Promise<void> {
  if (!running) {
    try {
      await createConnection();
    } catch (error) {
      if (!(error instanceof AlreadyHasActiveConnectionError)) {
        throw error;
      }
    }
  }

  running = true;
  const projects = await getManager().find(Project);
  console.log(new Date().toLocaleString() + ": Started watch round");

  const now = Date.now();
  const runInterval = 1000 * 3600; // run every hour

  const promises = projects.map(async (project) => {
    const lastRun = project.meta?.lastRun?.getTime() || now;
    let checked = false;

    if (lastRun + runInterval < now) {
      const result = await getWatcher(project.type).check(project, {
        validityOnly: false,
      });
      getManager().save(result);
      checked = true;
    }
    return [project.name, checked];
  });
  const results = await Promise.allSettled(promises);
  const finished = new Date().toLocaleString();

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        `${finished}: A Project check failed with: ${result.reason}`
      );
    } else {
      console.log(
        `${finished}: Project '${result.value[0]}' was checked: ${result.value[1]}`
      );
    }
  }
  setTimeout(watch, 1000 * 60 * 10);
}

export function isRunning(): boolean {
  return running;
}

export function stop(): void {
  running = false;
}
