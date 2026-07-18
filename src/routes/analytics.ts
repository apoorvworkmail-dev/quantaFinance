import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSummary,
  getMonthly,
  getBreakdown,
  getRecentActivity,
} from "../controllers/analytics.controller";
import { chatWithAssistant, streamChatWithAssistant } from "../controllers/ai.controller";

const router = Router();
router.use(authenticate);

router.get("/summary",         getSummary);
router.get("/monthly",         getMonthly);
router.get("/breakdown",       getBreakdown);
router.get("/recent-activity", getRecentActivity);
router.post("/chat",            chatWithAssistant);
router.post("/chat/stream",     streamChatWithAssistant);

export default router;
