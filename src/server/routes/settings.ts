import { RemoteSetting } from "../entity/settings";
import express from "express";
import { getManager, IsNull } from "typeorm";

function map<T>(body: T, newValue: T, keys: Array<keyof T>): T {
  for (const key of keys) {
    newValue[key] = body[key];
  }
  return newValue;
}

function mapRemoteSetting(body: RemoteSetting) {
  return map(body, new RemoteSetting(), [
    "id",
    "host",
    "name",
    "project",
    "projectId",
    "token",
    "username",
  ]);
}

const router = express.Router();

router.get("/", async function (req, res) {
  // return all global remote settings
  const result = await getManager().find(RemoteSetting, {
    where: { projectId: IsNull() },
  });
  res.json({ remotes: result });
});

router.post("/remote", async function (req, res) {
  const setting = mapRemoteSetting(req.body);
  const result = await getManager().save(setting);
  // do not leak token
  result.token = "";
  res.json(result);
});

export default router;
