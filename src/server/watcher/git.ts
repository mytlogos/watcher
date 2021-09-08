import { Project, RemoteProject } from "../entity/project";
import { RemoteSetting } from "../entity/settings";
import simpleGit, { GitError, SimpleGit } from "simple-git";
import { getManager } from "typeorm";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/core";
import log from "npmlog";

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
      log.info(project.name, "Different Push and Fetch Links for Remote");
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

interface ShowRemote {
  name: string;
  exists: boolean;
  fetchUrl: string;
  pushUrl: string;
  headBranch: string;
  remoteBranches: string[];
  localPushBranches: string[];
  localPullBranches: string[];
}

async function showRemote(git: SimpleGit, remote: string): Promise<ShowRemote> {
  const fetchRegex = /Fetch\s+URL:\s+(\S+)/;
  const pushRegex = /Push\s+URL:\s+(\S+)/;
  const headRegex = /HEAD\s+branch:\s+(\S+)/;
  const startRemotes = "Remote branches:";
  const startPush = "Local refs configured for 'git push':";
  const startPull = "Local branches configured for 'git pull':";

  const regex = new Map<RegExp, { name: keyof ShowRemote; index: number }>();
  regex.set(fetchRegex, { name: "fetchUrl", index: 1 });
  regex.set(pushRegex, { name: "pushUrl", index: 1 });
  regex.set(headRegex, { name: "headBranch", index: 1 });

  const starts = new Map<string, keyof ShowRemote>();
  starts.set(startRemotes, "remoteBranches");
  starts.set(startPush, "localPushBranches");
  starts.set(startPull, "localPullBranches");

  const result = {
    name: remote,
    exists: false,
    pushUrl: "",
    fetchUrl: "",
    headBranch: "",
    localPullBranches: [],
    localPushBranches: [],
    remoteBranches: [],
  } as ShowRemote;

  const remotes = await git.getRemotes();

  // return early if this remote name does exist as git remote
  if (!remotes.find((value) => value.name === remote)) {
    return result;
  }

  // this should not fail, as we are sure that the remote exists
  const output = await git.remote(["show", remote]);

  if (!output) {
    throw Error("Expected Output for 'git remote show " + remote + "'");
  }

  result.exists = true;

  let branchNames = undefined as undefined | string[];

  for (const line of output.split("\n").map((s) => s.trim())) {
    let found = false;
    for (const [key, value] of regex.entries()) {
      const match = key.exec(line);

      if (match) {
        // @ts-expect-error somehow does not match
        result[value.name] = match[value.index];
        found = true;
        break;
      }
    }

    if (found) {
      continue;
    }

    for (const [key, value] of starts.entries()) {
      if (line.includes(key)) {
        branchNames = result[value] as string[];
        found = true;
        break;
      }
    }

    if (!found && branchNames) {
      const branchName = line.split(/\s/)[0];

      if (branchName) {
        branchNames.push(branchName);
      }
    }
  }
  return result;
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
    log.info(project.name, "checking out to branch:", branch);
    await git.checkout(branch);
  } else {
    log.info(project.name, "checking out to new branch:", branch);
    await git.checkout(["-b", branch]);
  }

  const remotes = await git.getRemotes();

  for (const remote of remotes) {
    try {
      const result = await showRemote(git, remote.name);

      if (!result.exists) {
        throw Error(
          "Remote should exist, as it was iterated from existing Remotes"
        );
      }

      if (!result.remoteBranches.includes(branch)) {
        await git.push(["-u", remote.name, branch]);
        log.info(
          project.name,
          "Pushed Branch",
          branch,
          "to remote",
          remote.name
        );
      }

      await git.pull(remote.name, branch);
      log.info(
        project.name,
        "pulled Branch",
        branch,
        "from remote",
        remote.name
      );
    } catch (error) {
      if (error instanceof GitError) {
        if (error.message.includes("Unauthorized")) {
          log.error(
            project.name,
            `Failed Branch ${branch} for Remote '${remote.name}': Unauthorized`
          );
        } else {
          log.error(
            project.name,
            `Failed Branch ${branch} for Remote '${remote.name}': ${error}`
          );
        }
      } else {
        log.error(
          project.name,
          branch,
          remote.name,
          typeof error,
          Object.keys(error as any),
          error
        );
      }
    }
  }
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
    log.info(project.name, `Committed ${result.summary.changes}`);
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
  const remoteReg = /.+\/\/github.com\/.+\/([\w-]+)\.git/;

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
    log.error(project.name, "No Repository Name found");
    return;
  }

  const git = await getGit(project);

  const branches = await git.branch();
  const base = ["next", "develop", "master", "main"].find(
    (name) => name in branches.branches
  );

  if (!base) {
    log.info(project.name, "No default branch to base pull request on found");
    return;
  }
  const octokit = new Octokit({ auth: env.password });
  const owner = env.user;
  const repo = repoName;
  const title = "Dependencies Update";
  const head = branches.current;

  try {
    const response = await octokit.request(`POST /repos/{owner}/{repo}/pulls`, {
      owner,
      repo,
      title,
      head,
      base,
    });
    console.log(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes(`No commits between ${base} and ${head}`)) {
        log.error(
          project.name,
          `Could not create Pull Request - No commits between ${base} and ${head}`
        );
      } else {
        log.error(project.name, error.message);
      }
    } else {
      log.error(project.name, String(error));
    }
  }
}
