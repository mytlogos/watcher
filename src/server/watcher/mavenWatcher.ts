import { spawn } from "child_process";
import { join } from "path";
import { Dependency, Project, ProjectMeta } from "../entity/project";
import { available, CheckOptions, Watcher } from "./watcher";

interface MavenProject {
  version: string;
  name: string;
  group: string;
  os: string;
  zipType: string;
  dependencies: MavenDependency[];
}

interface MavenDependency extends MavenProject {
  depType?: string;
}

interface MavenOutdatedDependency {
  current: string;
  latest: string;
  group: string;
  name: string;
}

type DependecyIndices<V = MavenDependency> = {
  [K in keyof V]: NonNullable<V[K]> extends string ? number : never;
};

function createDependency(
  regResult: string[],
  { group, name, os, version, zipType, depType }: DependecyIndices
): MavenDependency {
  return {
    group: regResult[group],
    name: regResult[name],
    os: regResult[os],
    version: regResult[version],
    zipType: regResult[zipType],
    depType: regResult[depType as number],
    dependencies: [],
  };
}

function equals<T>(value: T, other: T, ...keys: Array<keyof T>): boolean {
  for (const key of keys) {
    if (value[key] !== other[key]) {
      return false;
    }
  }
  return true;
}

function buildTree(graph: MavenDependency[]): MavenProject {
  // collapse multiple same dependants into one
  for (let outer = 0; outer < graph.length; outer++) {
    const item = graph[outer];

    for (let inner = outer + 1; inner < graph.length; inner++) {
      const other = graph[inner];

      if (
        item !== other &&
        equals(item, other, "name", "group", "version", "os")
      ) {
        graph.splice(inner, 1);
        item.dependencies.push(...other.dependencies);
      }
    }
  }
  const removed = [] as MavenDependency[];
  // remove any dependants which are dependencies
  for (let outer = 0; outer < graph.length; outer++) {
    const item = graph[outer];

    let isDependency = false;

    // check current graph
    for (const dependant of graph) {
      const dependencyIndex = dependant.dependencies.findIndex((other) =>
        equals(item, other, "name", "group", "version", "os")
      );

      if (dependencyIndex >= 0) {
        isDependency = true;
        dependant.dependencies[dependencyIndex] = item;
      }
    }

    // check removed graph nodes
    for (const dependant of removed) {
      const dependencyIndex = dependant.dependencies.findIndex((other) =>
        equals(item, other, "name", "group", "version", "os")
      );

      if (dependencyIndex >= 0) {
        isDependency = true;
        dependant.dependencies[dependencyIndex] = item;
      }
    }

    if (isDependency) {
      // remove item and decrement the index afterwards
      removed.push(...graph.splice(outer--, 1));
    }
  }

  if (graph.length !== 1) {
    throw Error("Did not get a single root dependant, got: " + graph);
  }
  return graph[0];
}

/**
 * Parses the Maven Output of the dependency:tree Command in the "dot" OutputType.
 *
 * @param value output of the mvn command
 * @returns maven projects
 */
function parseDependencyTree(value: string): MavenProject[] {
  // remove ansi-color codes
  // eslint-disable-next-line no-control-regex
  value = value.replace(/\u001b[^m]*?m/g, "");
  // remove any log levels like: '[INFO]' at the start of a line
  value = value.replace(/\n\[.+?\]\s*/g, "\n");
  // this regex catches the start of the "dot" output type
  const startRegex = /digraph\s+"([^:\s]+):([^:\s]+):([^:\s]+):([^:\s]:)*([^:\s]+)"\s{\s+/g;
  // a line with a closing curvy brace marks the end
  const endRegex = /}\s+/g;

  let startResult = startRegex.exec(value);

  if (!startResult) {
    throw Error("Could not find dependency tree start");
  }
  const depReg = /"([^:\s]+):([^:\s]+):([^:\s]+):([^:\s]+:)*(\d+(\.[^:\s]+)*)(:([^:\s]+))?" -> "([^:\s]+):([^:\s]+):([^:\s]+):([^:\s]+:)*(\d+(\.[^:\s.]+)*):([^:\s]+)"\s*;\s+/g;

  const projects = [];

  while (startResult) {
    const endResult = endRegex.exec(value);

    if (!endResult) {
      throw Error("Could not find dependency tree end");
    }

    if (startResult.index >= endResult.index) {
      throw Error("Dependency tree start is after its end and not before");
    }

    let depResult = depReg.exec(value);
    const graph = [];

    while (depResult) {
      const dependant = createDependency(depResult, {
        group: 1,
        name: 2,
        zipType: 3,
        os: 4,
        version: 5,
        depType: 8,
      } as DependecyIndices);

      const dependency = createDependency(depResult, {
        group: 9,
        name: 10,
        zipType: 11,
        os: 12,
        version: 13,
        depType: 15,
      } as DependecyIndices);

      dependant.dependencies.push(dependency);

      graph.push(dependant, dependency);

      // stop if dependency is right before the end line of the current graph
      if (depResult.index + depResult[0].length + 1 >= endResult.index) {
        break;
      }
      depResult = depReg.exec(value);
    }

    projects.push(buildTree(graph));
    startResult = startRegex.exec(value);
  }

  return projects;
}

function parseOutdatedDependencies(value: string): MavenOutdatedDependency[] {
  // remove ansi-color codes
  // eslint-disable-next-line no-control-regex
  value = value.replace(/\u001b[^m]*?m/g, "");
  // remove any log levels like: '[INFO]' at the start of a line
  value = value.replace(/\n\[.+?\]\s*/g, "\n");

  const depReg = /([^:\s]+):([^:\s]+)[\s.]+(\S+(\.\S)*)\s*->\s*(\S+(\.\S)*)\s+/g;

  let result = depReg.exec(value);
  const dependencies = [];

  while (result) {
    const dependency = {
      group: result[1],
      name: result[2],
      current: result[3],
      latest: result[5],
    } as MavenOutdatedDependency;

    dependencies.push(dependency);
    result = depReg.exec(value);
  }
  return dependencies;
}

export class MavenWatcher extends Watcher {
  public async check(
    project: Project,
    checkOptions?: CheckOptions
  ): Promise<Project> {
    if (project.isGlobal) {
      throw Error("Global Maven Projects are currently not allowed");
    }
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

  private async checkPathValidity(project: Project): Promise<boolean> {
    const [_out, _err, exitCode] = await this.run(project, "mvn");
    return exitCode === 1 && (await available(join(project.path, "pom.xml")));
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

    all.dependencies.forEach((value) => {
      const name = value.group + ":" + value.name;
      let dependency = nameMap.get(name);

      if (!dependency) {
        nameMap.set(name, (dependency = new Dependency()));
      }

      dependency.data = JSON.stringify([value]);
      dependency.name = name;
      dependency.currentVersion = value.version;
      return dependency;
    });

    outdated.forEach((value) => {
      const name = value.group + ":" + value.name;
      const dependency = nameMap.get(name);
      if (!dependency) {
        throw new Error(
          "Outdated Package was not listed together with all Packages"
        );
      }
      const availableVersions = [];
      if (value.latest !== value.current) {
        availableVersions.push(value.latest);
      }
      dependency.availableVersions = JSON.stringify(availableVersions);
      return dependency;
    });
    return [...nameMap.values()];
  }

  private async listAllDependencies(project: Project): Promise<MavenProject> {
    const args = ["dependency:tree", "-DoutputType=dot"];

    if (project.isGlobal) {
      args.push("-g");
    }

    const [output, error, exitCode] = await this.run(project, "mvn", ...args);

    if (error && exitCode) {
      throw Error(error);
    }
    // TODO: return all items
    return parseDependencyTree(output)[0];
  }

  private async listOutdatedDependencies(
    project: Project
  ): Promise<MavenOutdatedDependency[]> {
    const args = ["versions:display-dependency-updates"];

    if (project.isGlobal) {
      args.push("-g");
    }

    const [output, error, exitCode] = await this.run(project, "mvn", ...args);

    if (error && exitCode) {
      throw Error(error);
    }
    return parseOutdatedDependencies(output);
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
