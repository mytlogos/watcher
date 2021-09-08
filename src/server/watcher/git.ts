import { Project, RemoteProject } from "../entity/project";
import simpleGit, { SimpleGit } from "simple-git";
import { getManager } from "typeorm";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/core";

/**
 * Checks whether the path in the given string is accessible by this process.
 *
 * @param fsPath file system path to check
 * @returns true if the path is accessible
 */
export async function available(fsPath: string): Promise<boolean> {
  try {
    await fs.access(fsPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Naively parses the lines in an env file
 * skipping any lines which do not match "KEY=VALUE".
 * Expects Line-Endings in LF Format.
 *
 * @param content contents of an env file
 * @returns record of env keys and their values
 */
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

/**
 * Tries to read the Git credentials from the env.env in the nearest (parent-)directory
 * containing a package.json file. Starts from the directory which contains this file,
 * not the current working directory.
 *
 * @returns Git Credential Values
 */
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

/**
 * Creates a simpleGit instance (with email and username
 * configured if a git repo) and base path set to the project path.
 *
 * @param project project to get a SimpleGit instance from
 * @returns a SimpleGit Instance
 */
async function getGit(project: Project): Promise<SimpleGit> {
  const values = await gitEnv;
  const settings = await getManager().find(RemoteSetting);

  const remoteConfig = [] as string[];

  for (const setting of settings) {
    if (!setting.projectId || setting.projectId === project.id) {
      remoteConfig.push(
        `user.https://${setting.host}.name=${setting.username}`,
        `credential.https://${setting.host}.username=${setting.username}`,
        `credential.https://${setting.host}.helper=!foo() { echo "password=${setting.token}"; }; foo`
      );
    }
  }

  return simpleGit({
    baseDir: project.path,
    config: ["user.email=" + values.mail, ...remoteConfig],
  });
}

/**
 * "Syncs" the Remotes of the Project with the Remotes of
 * the Git Repository at the Path of the Project.
 * Currently adds only Git Remotes unknown to the project.
 *
 * @param project project to sync the remotes of
 * @returns nothing
 */
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

/**
 * Checks whether the Project Path is
 * a Git Repository.
 *
 * @param project project to check
 * @returns true if it is an git repository
 */
export async function isRepo(project: Project): Promise<boolean> {
  if (project.isGlobal) {
    return Promise.resolve(false);
  }
  const git = await getGit(project);

  return git.checkIsRepo();
}

/**
 * Checkout the Git repository of the Project to the given branch.
 * Creates the Branch locally if it does not exist.
 * Tries to push branch to the watcher remote.
 * Tries to pull changes from remote.
 *
 * @param project project to checkout
 * @param branch branch name to checkout to
 * @returns nothing
 */
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
  // TODO: remotes should be configured by user etc.
  // TODO: Do not create weird remotes, pull only if remote is configured (which it should always do?)
  const remote = await createAuthenticatedRemote(git, project.remotes);

  await git.remote(["show", remote?.name || ""]);

  if (remote) {
    await git.push(["-u", remote.name, branch]);
  }
  await git.pull();
}

const WATCHER_SUFFIX = "-watcher";

/**
 * Get the name of a watcher remote.
 * This method should be removed, as watcher remotes should be removed.
 *
 * @param git configured SimpleGit Instance
 * @param remotes current remotes
 * @returns a remote name with the watcher-suffix
 */
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

/**
 * Get a RemoteProject with Authentication
 * embedded in it's URL or undefined if
 * it could not create such an object.
 * (Does not save it in database, only adding it to the git repository).
 * TODO: This method should be removed.
 *
 * @param git SimpleGit Instance
 * @param remotes available Remotes
 * @returns Authenticated RemoteProject or undefined
 */
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

/**
 * Clone a Project from its first defined Remote, if available
 * into the path of the project.
 *
 * @param project project to clone
 * @returns true if it succeeded
 */
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

/**
 * Commits all changes with a standard message
 * and pushed the current branch to its remote.
 *
 * TODO: make commit message a parameter (more fine-grined commit message)
 * TODO: "stage all changes" as boolean parameter
 * @param project project with git repo to commit and push
 */
export async function commitAndPush(project: Project): Promise<void> {
  const git = await getGit(project);
  await git.add("*");
  const result = await git.commit("chore: upgrade dependencies");

  if (result.summary.changes) {
    console.log(`Committed ${result.summary.changes}`);
    await git.push();
  }
}

/**
 * Create a Pull Request from the current branch to the base
 * which it finds it first in this list: "next", "develop", "master", "main"
 *
 * Currently only github.com Remotes are supported.
 *
 * TODO: support gitea
 *
 * @param project project with git repo to create a Pull Request for
 * @returns undefined
 */
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
