import { Router } from "express";
import { applyForLoan, getMyLoans, getLoanById, payLoan } from "../controllers/loan.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All loan routes require authentication
router.use(protect);

router.post("/", applyForLoan);
router.get("/", getMyLoans);
router.get("/:id", getLoanById);
router.post("/:id/pay", payLoan);

export default router;
