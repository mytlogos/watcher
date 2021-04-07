import { Project } from "../entity/project";
import { CheckOptions, Watcher } from "./watcher";

export class MavenWatcher extends Watcher {
  public async check(
    project: Project,
    checkOptions?: CheckOptions
  ): Promise<Project> {
    throw new Error("Method not implemented.");
  }
}
