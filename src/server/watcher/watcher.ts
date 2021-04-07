import { Project } from "../entity/project";
import fs from "fs/promises";

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
}
