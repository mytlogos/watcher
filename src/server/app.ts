import createError, { HttpError } from "http-errors";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import logger from "morgan";
import compression from "compression";
// helps by preventing some known http vulnerabilities by setting http headers appropriately
import helmet from "helmet";
import { AlreadyHasActiveConnectionError, createConnection } from "typeorm";
import apiRouter from "./routes/api";
import { watch } from "./watcher";

export const app = express();

const parentDirName = path.dirname(path.dirname(__dirname));

let started = false;
watch();

app.use(async (_req, _res, next) => {
  if (!started) {
    started = true;
    try {
      await createConnection();
    } catch (error) {
      if (!(error instanceof AlreadyHasActiveConnectionError)) {
        throw error;
      }
    }
  }
  console.log("Incoming request: " + _req.method + " " + _req.url);
  next();
});

app.use(
  // @ts-expect-error morgan types do not match express types?
  logger(":method :url :status :response-time ms - :res[content-length]", {
    stream: {
      write(str: string): void {
        console.log(str.trim());
      },
    },
  })
);

// @ts-expect-error wrong typings??
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// only accept json as req body
// @ts-expect-error wrong typings??
app.use(express.json());

app.use("/api", apiRouter);

// map root to app.html first, before the static files, else it will map to index.html by default
app.get("/", (_req, res) =>
  res.sendFile(
    path.join(parentDirName, path.join("dist", "website", "app.html"))
  )
);

app.use(express.static(path.join(parentDirName, "dist", "website")));

app.use((req, res) => {
  if (!req.path.startsWith("/api") && req.method === "GET") {
    res.sendFile(
      path.join(parentDirName, path.join("dist", "website", "app.html"))
    );
  }
});

// catch 404 and forward to error handler
app.all("*", (req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.sendStatus(err.status || 500);
});

// TODO what is with tls (https), cloudflare?
// TODO does it redirect automatically to https when http was typed?
// TODO what options does https need
