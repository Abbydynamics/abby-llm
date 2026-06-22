import { Router, type IRouter } from "express";
import { engine } from "../lib/llm/engine.js";

const router: IRouter = Router();

router.post("/chat", async (req, res): Promise<void> => {
  const { message, model, temperature, topK, maxTokens } = req.body ?? {};
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const modelName = typeof model === "string" ? model : "AbbyCoder 150M";
  const result = await engine.chat(modelName, message, {
    temperature: typeof temperature === "number" ? temperature : undefined,
    topK: typeof topK === "number" ? topK : undefined,
    maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
  });
  res.json(result);
});

export default router;
