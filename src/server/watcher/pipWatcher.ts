import { spawn } from "child_process";
import { join } from "path";
import { Dependency, Project, ProjectMeta } from "../entity/project";
import { CheckOptions, Watcher } from "./watcher";
import log from "npmlog";

interface PipDependency {
  name: string;
  version: string;
}

interface PipOutdatedDependency extends PipDependency {
  name: string;
  version: string;
  latest_version: string;
  latest_filetype: string;
}

export class PythonWatcher extends Watcher {
  public async check(
    project: Project,
    checkOptions?: CheckOptions
  ): Promise<Project> {
    // currently only local projects
    if ((!project.path && !project.isGlobal) || project.path.includes("://")) {
      throw Error("Unsupported Path: " + project.path);
    }

    if (!(await this.checkPathValidity(project))) {
      throw new Error("Invalid Project Path");
    }

    if (!checkOptions?.validityOnly) {
      if (project.meta == null) {
        project.meta = new ProjectMeta();
      }
      const dependencies = await this.loadDependencies(project);
      project.meta.dependencies = dependencies;
      project.meta.lastRun = new Date();
    }
    return project;
  }

  public async createCiFile(project: Project): Promise<void> {
    log.error("Pip", "Method 'createCiFile' not implemented.");
  }
  public async upgradeDeps(
    project: Project,
    dependencies: Dependency[]
  ): Promise<void> {
    log.error("Pip", "Method 'upgradeDeps' not implemented.");
  }

  private async checkPathValidity(project: Project): Promise<boolean> {
    const pipCommand = this.getPip(project);
    const [_out, _err, exitCode] = await this.run(project, pipCommand);
    return exitCode === 0;
  }

  public async loadDependencies(project: Project): Promise<Dependency[]> {
    const [all, outdated] = await Promise.all([
      this.listAllDependencies(project),
      this.listOutdatedDependencies(project),
    ]);

    const nameMap = new Map<string, Dependency>();

    project?.meta?.dependencies?.forEach((value) =>
      nameMap.set(value.name, value)
    );

    all.forEach((value) => {
      let dependency = nameMap.get(value.name);

      if (!dependency) {
        nameMap.set(value.name, (dependency = new Dependency()));
      }

      dependency.name = value.name;
      dependency.currentVersion = value.version;
      return dependency;
    });

    outdated.forEach((value) => {
      const dependency = nameMap.get(value.name);
      if (!dependency) {
        throw new Error(
          "Outdated Package was not listed together with all Packages"
        );
      }
      dependency.data = JSON.stringify([value]);
      dependency.availableVersions = JSON.stringify([value.latest_version]);
      return dependency;
    });
    return [...nameMap.values()];
  }

  private getPip(project: Project): string {
    if (project.isGlobal) {
      return "pip3";
    } else {
      return join(project.path, ".venv", "bin", "pip");
    }
  }

  private async listAllDependencies(
    project: Project
  ): Promise<PipDependency[]> {
    const pipCommand = this.getPip(project);
    const [output, error] = await this.run(
      project,
      pipCommand,
      "list",
      "--format",
      "json"
    );
    if (error) {
      throw Error(error);
    }
    return JSON.parse(output) as PipDependency[];
  }

  private async listOutdatedDependencies(
    project: Project
  ): Promise<PipOutdatedDependency[]> {
    const pipCommand = this.getPip(project);

    const [output, error] = await this.run(
      project,
      pipCommand,
      "list",
      "--outdated",
      "--format",
      "json"
    );
    if (error) {
      throw Error(error);
    }
    return JSON.parse(output) as PipOutdatedDependency[];
  }

  private run(
    project: Project,
    command: string,
    ...args: string[]
  ): Promise<[string, string, number | null]> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: project.path || "/",
      });

      const stdOutchunks = [] as Buffer[];

      child.stdout.on("data", (chunk) => {
        if (typeof chunk === "string") {
          stdOutchunks.push(Buffer.from(chunk));
        } else {
          stdOutchunks.push(chunk);
        }
      });

      const stdErrchunks = [] as Buffer[];

      child.stderr.on("data", (chunk) => {
        if (typeof chunk === "string") {
          stdErrchunks.push(Buffer.from(chunk));
        } else {
          stdErrchunks.push(chunk);
        }
      });

      child.on("exit", (code) => {
        const out = Buffer.concat(stdOutchunks).toString("utf-8");
        const err = Buffer.concat(stdErrchunks).toString("utf-8");
        resolve([out, err, code]);
      });
    });
  }
}
