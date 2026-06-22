import { Router, type IRouter } from "express";
import { engine } from "../lib/llm/engine.js";

const router: IRouter = Router();

router.get("/training/status", (_req, res): void => {
  res.json(engine.getStatus());
});

router.post("/training/start", async (req, res): Promise<void> => {
  const modelName =
    typeof req.body?.model === "string" ? req.body.model : "AbbyCoder 150M";
  const result = await engine.start(modelName);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(engine.getStatus());
});

router.post("/training/pause", (_req, res): void => {
  engine.pause();
  res.json(engine.getStatus());
});

router.post("/training/stop", (_req, res): void => {
  engine.stop();
  res.json(engine.getStatus());
});

export default router;
