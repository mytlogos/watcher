import { Project } from "./entity/project";
import {
  AlreadyHasActiveConnectionError,
  createConnection,
  getManager,
} from "typeorm";
import { getWatcher } from "./watcher/watch";
import { checkRemotes } from "./watcher/git";

let running = false;

async function watchProjects() {
  const projects = await getManager().find(Project);
  console.log(new Date().toLocaleString() + ": Started watch round");

  const now = Date.now();
  const runInterval = 1000 * 1; // run every hour

  const promises = projects.map(async (project) => {
    const lastRun = project.meta?.lastRun?.getTime() || now;
    let checked = false;

    if (lastRun + runInterval < now) {
      console.log("Checking project " + project.name);
      const watcher = getWatcher(project.type);
      // const result = await watcher.check(project, {
      //   validityOnly: false,
      // });
      try {
        console.log("Checking Remotes of " + project.name);
        await checkRemotes(project);
        console.log("Upgrade Dependencies of " + project.name);
        await watcher.upgrade(project);
        console.log("Finished watch for " + project.name);
      } catch (error) {
        console.error(project, error);
      }
      // getManager().save(result);
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
