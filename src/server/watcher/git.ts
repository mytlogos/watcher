import { Project, RemoteProject } from "../entity/project";
import simpleGit, { SimpleGit } from "simple-git";
import { getManager } from "typeorm";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/core";

export async function available(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function parseEnv(content: string): Record<string, string> {
  const lines = content.split("\n");
  const values = {} as Record<string, string>;

  for (const line of lines) {
    const index = line.indexOf("=");

    if (index >= 0) {
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      values[key] = value;
    }
  }
  return values;
}

interface GitEnv {
  password: string;
  user: string;
  mail: string;
}

async function readGitEnv(): Promise<GitEnv> {
  const rootFile = "package.json";
  let rootDir = __dirname;

  while (!(await available(path.join(rootDir, rootFile))) && rootDir) {
    rootDir = path.dirname(rootDir);
  }
  const contents = await fs.readFile(path.join(rootDir, "env.env"), {
    encoding: "utf-8",
  });
  const values = parseEnv(contents);

  return {
    mail: values["GIT_MAIL"],
    password: values["GIT_PASSWORD"],
    user: values["GIT_USER"],
  };
}

const gitEnv = readGitEnv();

async function getGit(project: Project): Promise<SimpleGit> {
  const git = simpleGit({
    baseDir: project.path,
  });
  const values = await gitEnv;
  git.addConfig("user.email", values.mail);
  git.addConfig("user.name", values.user);
  return git;
}

export async function checkRemotes(project: Project): Promise<void> {
  const currentRemotes = project.remotes || [];
  const git = await getGit(project);

  if (!(await git.checkIsRepo())) {
    return;
  }

  const gitRemotes = await git.getRemotes(true);

  for (const remote of gitRemotes) {
    const link = remote.refs.fetch;

    if (remote.refs.push !== link) {
      console.log("Different Push and Fetch Links for Remote");
    }
    if (
      !currentRemotes.find(
        (value) => value.name === remote.name && value.path === link
      )
    ) {
      const remoteProject = new RemoteProject();
      remoteProject.name = remote.name;
      remoteProject.path = link;
      remoteProject.project = project;

      (project.remotes || (project.remotes = [])).push(remoteProject);

      const result = await getManager().save(remoteProject);
      console.log("New: ", result);
    }
  }
}

export async function isRepo(project: Project): Promise<boolean> {
  if (project.isGlobal) {
    return Promise.resolve(false);
  }
  const git = await getGit(project);

  return git.checkIsRepo();
}

export async function checkout(
  project: Project,
  branch: string
): Promise<void> {
  const git = await getGit(project);

  if (!(await git.checkIsRepo())) {
    const cloned = await clone(project);

    if (!cloned) {
      return;
    }
  }
  const branches = await git.branchLocal();

  if (branch in branches.branches) {
    console.log("checking out to branch: ", branch);
    await git.checkout(branch);
  } else {
    console.log("checking out to new branch: ", branch);
    await git.checkout(["-b", branch]);
  }
  const remote = await createAuthenticatedRemote(git, project.remotes);

  await git.remote(["show", remote?.name || ""]);

  if (remote) {
    await git.push(["-u", remote.name, branch]);
  }
  await git.pull();
}

const WATCHER_SUFFIX = "-watcher";

async function getRemote(
  git: SimpleGit,
  remotes?: RemoteProject[]
): Promise<string | undefined> {
  const remote = (remotes || [])[0];

  if (!remote || remote.name.endsWith(WATCHER_SUFFIX)) {
    return remote?.name;
  }

  const gitRemotes = await git.getRemotes(true);
  const watcherRemoteName = remote.name + WATCHER_SUFFIX;

  const watcherRemote = gitRemotes.find(
    (value) => watcherRemoteName === value.name
  );

  return watcherRemote?.name;
}

async function createAuthenticatedRemote(
  git: SimpleGit,
  remotes?: RemoteProject[]
): Promise<RemoteProject | undefined> {
  const remoteName = getRemote(git, remotes);

  const remote = (remotes || [])[0];

  if (!remote || remote.name.endsWith(WATCHER_SUFFIX)) {
    return;
  }

  // for now only https authenticated remotes
  const httpsProtocol = "https://";

  if (!remote.path.startsWith(httpsProtocol)) {
    return;
  }

  const gitValues = await gitEnv;

  const authRemote = new RemoteProject();
  authRemote.name = remote.name + WATCHER_SUFFIX;
  authRemote.path =
    httpsProtocol +
    gitValues.user +
    ":" +
    gitValues.password +
    "@" +
    remote.path.slice(httpsProtocol.length);

  await git.addRemote(authRemote.name, authRemote.path);
  return authRemote;
}

export async function clone(project: Project): Promise<boolean> {
  if (project.isGlobal) {
    return false;
  }

  const git = await getGit(project);
  const remote = (project.remotes || [])[0];

  if (!remote) {
    return false;
  }

  await git.clone(remote.path, project.path);
  return true;
}

export async function commitAndPush(project: Project): Promise<void> {
  const git = await getGit(project);
  await git.add("*");
  const result = await git.commit("chore: upgrade dependencies");

  if (result.summary.changes) {
    console.log(`Committed ${result.summary.changes}`);
    await git.push();
  }
}

export async function createPullRequest(project: Project): Promise<void> {
  const env = await gitEnv;
  const remoteReg = /.+\/\/github.com\/.+\/(\w+)\.git/;

  const repoName = (project.remotes || [])
    .map((value) => {
      const result = remoteReg.exec(value.path);

      if (result) {
        return result[1];
      } else {
        return;
      }
    })
    .find((value) => value);

  if (!repoName) {
    console.log("No Repository Name for project: " + project.name);
    return;
  }

  const git = await getGit(project);

  const branches = await git.branch();
  const base = ["next", "develop", "master", "main"].find(
    (name) => name in branches.branches
  );

  if (!base) {
    console.warn("No default branch to base pull request on found");
    return;
  }
  const octokit = new Octokit({ auth: env.password });
  const owner = env.user;
  const repo = repoName;
  const title = "Dependencies Update";
  const head = branches.current;

  const response = await octokit.request(`POST /repos/{owner}/{repo}/pulls`, {
    owner,
    repo,
    title,
    head,
    base,
  });
  console.log(response);
}
