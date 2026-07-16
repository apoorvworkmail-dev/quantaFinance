import { Router } from "express";
import {
  getMyCards,
  issueCard,
  updateCardStatus,
  updateCardLimit,
} from "../controllers/card.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All card routes require authentication
router.use(protect);

router.get("/", getMyCards);                        // GET   /api/v1/cards
router.post("/", issueCard);                        // POST  /api/v1/cards
router.patch("/:id/status", updateCardStatus);      // PATCH /api/v1/cards/:id/status
router.patch("/:id/limits", updateCardLimit);       // PATCH /api/v1/cards/:id/limits

export default router;
