import { Router, type IRouter } from "express";
import { engine } from "../lib/llm/engine.js";
import { listModelNames } from "../lib/llm/store.js";

const router: IRouter = Router();

router.get("/models", async (_req, res): Promise<void> => {
  const trained = await listModelNames();
  const available = engine.availableModels().map((name) => ({
    name,
    trained: trained.includes(name),
  }));
  res.json({ models: available });
});

export default router;
