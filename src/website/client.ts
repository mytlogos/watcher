import { Project } from "src/server/entity/project";
import { RemoteSetting } from "src/server/entity/settings";

enum Method {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

function templateString(
  path: string,
  values: Record<string, any>,
  removeMatched = false
) {
  const regex = /:\w+/;
  const variables = regex.exec(path);

  variables?.forEach((v) => {
    const varName = v.slice(1);

    if (varName in values) {
      const value = values[varName];
      path = path.replaceAll(v, value);

      if (removeMatched) {
        delete values[varName];
      }
    } else {
      console.warn("Variable in Path has no value: " + v);
    }
  });
  return path;
}

class HttpError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

async function queryServer<
  R = void,
  QueryValue extends Record<string, any> = any
>(
  { path, method }: { path: string; method: Method },
  query?: QueryValue
): Promise<R> {
  const init = {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: undefined as undefined | string,
  };
  if (query) {
    if (method === Method.GET) {
      path = templateString(path, query, true);
    } else {
      path = templateString(path, query);
    }
  }
  const url = new URL(`${window.location.origin}/api/${path}`);

  if (query) {
    if (method === Method.GET) {
      Object.keys(query).forEach((key) => {
        const value = query[key];
        if (Array.isArray(value)) {
          // TODO: handle array values better
          url.searchParams.append(key, `[${value.join(",")}]`);
        } else {
          url.searchParams.append(key, value);
        }
      });
    } else {
      init.body = JSON.stringify(query);
    }
  }
  const response = await fetch(url.toString(), init);

  if (!response.ok) {
    throw new HttpError(response.statusText, response.status);
  }

  const result = await response.json();

  if (result.error) {
    return Promise.reject(result.error);
  }
  return result;
}

export interface Entity {
  id: number;
}

type Create<T extends Entity> = Omit<T, "id">;

interface RestAPI<T extends Entity> {
  create(value: Create<T>): Promise<T>;
  update(value: T): Promise<T>;
  delete(value: T): Promise<T>;
  get(id: number): Promise<T>;
  getAll(): Promise<T[]>;
}

type FormatOptions<T> = {
  [P in keyof T]?: Formatter<T[P]> | FormatOptions<T[P]>;
};

interface Formatter<T, V = string> {
  to?: (value: T) => V;

  from?: (s: V) => T;
}

function createRest<T extends Entity>(
  path: string,
  formatOptions?: FormatOptions<T>
): RestAPI<T> {
  function rehydrate(value: T, options = formatOptions): T {
    if (!options || !value) {
      return value;
    }
    for (const [key, formatter] of Object.entries(options)) {
      if (formatter.from && typeof formatter.from === "function") {
        // @ts-expect-error rehydrate values like Date
        value[key] = formatter.from(value[key]);
      } else if (!formatter.from || typeof formatter.from !== "function") {
        // @ts-expect-error rehydrate nested object values
        rehydrate(value[key], formatter);
      }
    }
    return value;
  }
  return {
    create: (value) => {
      return queryServer<T, Create<T>>(
        {
          path,
          method: Method.POST,
        },
        value
      ).then(rehydrate);
    },
    update: (entity) => {
      return queryServer<T, T>(
        {
          path: path + "/:id",
          method: Method.PUT,
        },
        entity
      ).then(rehydrate);
    },
    delete: async (entity) => {
      return queryServer(
        {
          path: path + "/:id",
          method: Method.DELETE,
        },
        entity
      );
    },
    get: (id) => {
      return queryServer<T, Entity>(
        {
          path: path + "/:id",
          method: Method.GET,
        },
        {
          id: id,
        }
      ).then(rehydrate);
    },
    getAll: async () => {
      return queryServer<T[], never>({
        path,
        method: Method.GET,
      }).then((values) => values.map((value) => rehydrate(value)));
    },
  };
}

export const projectApi = {
  ...createRest<Project>("project", {
    meta: {
      lastRun: {
        from(s): Date {
          return new Date(s);
        },
      },
    },
  }),
  check<T extends Project | Create<Project>>(
    project: T,
    validityOnly?: boolean
  ): Promise<T> {
    return queryServer<T, T>(
      {
        path: `project/check?check=${validityOnly ? "valid" : "full"}`,
        method: Method.POST,
      },
      project
    ).then((value) => {
      if (value.meta?.lastRun) {
        value.meta.lastRun = new Date(value.meta?.lastRun);
      }
      return value;
    });
  },
};

export const settingsApi = {
  get(): Promise<{ remotes: RemoteSetting[] }> {
    return queryServer<{ remotes: RemoteSetting[] }>({
      path: `settings`,
      method: Method.GET,
    });
  },

  createRemoteSetting(remote: Create<RemoteSetting>): Promise<RemoteSetting> {
    return queryServer<RemoteSetting, Create<RemoteSetting>>(
      {
        path: `settings/remote`,
        method: Method.POST,
      },
      remote
    );
  },
};
