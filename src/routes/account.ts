import { Router } from "express";
import {
  getMyAccounts,
  getAccountById,
  openAccount,
  updateAccountStatus,
} from "../controllers/account.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All account routes are protected — must be logged in
router.use(protect);

router.get("/", getMyAccounts);            // GET  /api/v1/accounts
router.post("/", openAccount);             // POST /api/v1/accounts
router.get("/:id", getAccountById);        // GET  /api/v1/accounts/:id
router.patch("/:id/status", updateAccountStatus); // PATCH /api/v1/accounts/:id/status

export default router;
