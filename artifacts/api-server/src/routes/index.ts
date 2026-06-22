import { Router, type IRouter } from "express";
import healthRouter from "./health";
import datasetsRouter from "./datasets";
import trainingRouter from "./training";
import chatRouter from "./chat";
import modelsRouter from "./models";

const router: IRouter = Router();

router.use(healthRouter);
router.use(datasetsRouter);
router.use(trainingRouter);
router.use(chatRouter);
router.use(modelsRouter);

export default router;
