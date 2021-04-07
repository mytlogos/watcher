import express from "express";
import { getConnection, getManager } from "typeorm";
import { getWatcher } from "../watcher/watch";
import { Project } from "../entity/project";

const router = express.Router();

function map<T>(body: T, newValue: T, keys: Array<keyof T>): T {
  for (const key of keys) {
    newValue[key] = body[key];
  }
  return newValue;
}

function mapProject(body: Project) {
  return map(body, new Project(), ["id", "isGlobal", "name", "path", "type"]);
}

router.post("/check", async function (req, res) {
  const project = mapProject(req.body);
  const validityOnly = req.query.check === "valid";

  try {
    const result = await getWatcher(project.type).check(project, {
      validityOnly,
    });
    if (!validityOnly) {
      getManager().save(result);
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.sendStatus(400);
  }
});

router.get("/", async function (_req, res) {
  const items = await getManager().find(Project);
  res.json(items);
});

router.post("/", async function (req, res) {
  const project = mapProject(req.body);
  const item = await getManager().save(project);
  res.json(item);
});

router.get("/:id(\\d+)", async function (req, res) {
  const item = await getManager().findOne(Project, req.params.id);
  res.json(item);
});

router.put("/:id(\\d+)", async function (req, res) {
  const project = mapProject(req.body);
  const item = await getManager().save(project);
  res.json(item);
});

router.delete("/:id(\\d+)", async function (req, res) {
  const id = req.params.id;

  const result = await getConnection()
    .createQueryBuilder()
    .delete()
    .from(Project)
    .where("id = :id", { id })
    .execute();

  res.json((result.affected || 0) > 0);
});

export default router;
