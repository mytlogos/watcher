import { Project } from "./entity/project";
import {
  AlreadyHasActiveConnectionError,
  createConnection,
  getManager,
} from "typeorm";
import { getWatcher } from "./watcher/watch";
import { checkRemotes } from "./watcher/git";
import log from "npmlog";
Object.defineProperty(log, "heading", {
  get: () => {
    return new Date().toLocaleString();
  },
});
log.headingStyle = { bg: "", fg: "grey" };

let running = false;

async function watchProjects() {
  const projects = await getManager().find(Project);
  console.log(new Date().toLocaleString() + ": Started watch round");

  const now = Date.now();
  const runInterval = 1000 * 1; // run every hour

  const promises = [] as Promise<[string, boolean]>[];

  for (const project of projects) {
    const lastRun = project.meta?.lastRun?.getTime() || now;
    let checked = false;

    if (lastRun + runInterval < now) {
      log.info(project.name, "Checking project");
      const watcher = getWatcher(project.type);
      // const result = await watcher.check(project, {
      //   validityOnly: false,
      // });
      try {
        log.info(project.name, "Checking Remotes");
        await checkRemotes(project);
        log.info(project.name, "Upgrade Dependencies");
        await watcher.upgrade(project);
        log.info(project.name, "Finished watch");
      } catch (error) {
        log.error(project.name, String(error));
      }
      // getManager().save(result);
      checked = true;
    }
    promises.push(Promise.resolve([project.name, checked]));
  }
  // const promises = projects.map(async (project) => {

  // });
  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === "rejected") {
      log.error("", `A Project check failed with: ${result.reason}`);
    } else {
      log.info(result.value[0], `checked: ${result.value[1]}`);
    }
  }
}

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
  try {
    await watchProjects();
  } catch (error) {
    console.error(error);
  }
  setTimeout(watch, 1000 * 60 * 10);
}

export function isRunning(): boolean {
  return running;
}

export function stop(): void {
  running = false;
}
