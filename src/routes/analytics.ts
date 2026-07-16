import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSummary,
  getMonthly,
  getBreakdown,
  getRecentActivity,
} from "../controllers/analytics.controller";
import { chatWithAssistant } from "../controllers/ai.controller";

const router = Router();
router.use(authenticate);

router.get("/summary",         getSummary);
router.get("/monthly",         getMonthly);
router.get("/breakdown",       getBreakdown);
router.get("/recent-activity", getRecentActivity);
router.post("/chat",            chatWithAssistant);

export default router;
