import { spawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { fstat } from "node:fs";
import { join } from "path";
import { compare } from "semver";
import { Dependency, Project, ProjectMeta } from "../entity/project";
import { available, CheckOptions, Watcher } from "./watcher";

interface NpmProject {
  version?: string;
  name: string;
  dependencies: Record<string, NpmDependency>;
}

interface NpmDependency {
  version: string;
  resolved: string;
}

interface NpmOutdatedDependency {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location: string;
}

export class NodeWatcher extends Watcher {
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
    console.log("Method not implemented.");
  }

  public async upgradeDeps(
    project: Project,
    dependencies: Dependency[]
  ): Promise<void> {
    const packageFile = join(project.path, "package.json");
    let content = await readFile(packageFile, { encoding: "utf-8" });

    for (const dependency of dependencies) {
      let newVersion = dependency.currentVersion;

      for (const version of JSON.parse(dependency.availableVersions)) {
        if (compare(version, newVersion) > 0) {
          newVersion = version;
        }
      }
      content = content.replace(
        new RegExp(`("${dependency.name}":\\s*"[~^]?).+?"`),
        `$1${newVersion}"`
      );
    }
    await writeFile(packageFile, content, { encoding: "utf-8" });
  }

  private async checkPathValidity(project: Project): Promise<boolean> {
    const [_out, _err, exitCode] = await this.run(project, "npm");
    return (
      exitCode === 1 &&
      (project.isGlobal ||
        (await available(join(project.path, "package.json"))))
    );
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

    Object.entries(all.dependencies).forEach(([name, value]) => {
      let dependency = nameMap.get(name);

      if (!dependency) {
        nameMap.set(name, (dependency = new Dependency()));
      }

      dependency.name = name;
      dependency.currentVersion = value.version;
      return dependency;
    });

    Object.entries(outdated).forEach(([name, value]) => {
      const dependency = nameMap.get(name);
      if (!dependency) {
        throw new Error(
          "Outdated Package was not listed together with all Packages"
        );
      }
      dependency.data = JSON.stringify([value]);
      const availableVersions = [];
      if (value.latest !== value.current) {
        availableVersions.push(value.latest);
      }
      if (value.wanted !== value.current && value.wanted !== value.latest) {
        availableVersions.push(value.wanted);
      }
      dependency.availableVersions = JSON.stringify(availableVersions);
      return dependency;
    });
    return [...nameMap.values()];
  }

  private async listAllDependencies(project: Project): Promise<NpmProject> {
    const args = ["ls", "--json"];

    if (project.isGlobal) {
      args.push("-g");
    }

    const [output, error] = await this.run(project, "npm", ...args);

    if (error) {
      throw Error(error);
    }
    return JSON.parse(output);
  }

  private async listOutdatedDependencies(
    project: Project
  ): Promise<Record<string, NpmOutdatedDependency>> {
    const args = ["outdated", "--json"];

    if (project.isGlobal) {
      args.push("-g");
    }

    const [output, error] = await this.run(project, "npm", ...args);

    if (error) {
      throw Error(error);
    }
    return JSON.parse(output);
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
