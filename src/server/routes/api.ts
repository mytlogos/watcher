import express from "express";
import projectRouter from "./project";
import settingsRouter from "./settings";

const router = express.Router();
router.use("/project", projectRouter);
router.use("/settings", settingsRouter);

export default router;
