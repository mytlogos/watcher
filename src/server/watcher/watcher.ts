import { Dependency, Project } from "../entity/project";
import fs from "fs/promises";
import { checkout, commitAndPush, createPullRequest, isRepo } from "./git";
import { compare } from "semver";
import { homedir } from "os";
import { join } from "path";

export async function available(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export interface CheckOptions {
  validityOnly: boolean;
}

export abstract class Watcher {
  public abstract check(
    project: Project,
    checkOptions: CheckOptions
  ): Promise<Project>;

  public abstract createCiFile(project: Project): Promise<void>;

  public abstract upgradeDeps(
    project: Project,
    dependencies: Dependency[]
  ): Promise<void>;

  public async upgrade(project: Project): Promise<void> {
    if (!(await isRepo(project))) {
      return;
    }

    const dummyProject = new Project();
    dummyProject.path = join(homedir(), ".watcher", project.name);
    dummyProject.type = project.type;
    dummyProject.remotes = project.remotes;
    dummyProject.name = project.name;

    if (!(await available(dummyProject.path))) {
      await fs.mkdir(dummyProject.path, { recursive: true });
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${now.getMonth()}-${now.getDay()}`;
    await checkout(dummyProject, "upgrade-" + date);
    await this.createCiFile(dummyProject);

    const dependencies = (project.meta?.dependencies || []).filter((value) => {
      if (!value.availableVersions) {
        return false;
      }
      try {
        const versions = JSON.parse(value.availableVersions) as string[];
        return (
          versions.findIndex(
            (version) => compare(version, value.currentVersion) > 0
          ) > 0
        );
      } catch (error) {
        if (error instanceof TypeError) {
          console.error(error.message);
        } else {
          console.error(error);
        }
        return false;
      }
    });

    if (dependencies.length) {
      await this.upgradeDeps(dummyProject, dependencies);
      await commitAndPush(dummyProject);
      await createPullRequest(dummyProject);
    } else {
      console.log("No Updates available for " + project.name);
    }
    return;
  }
}
