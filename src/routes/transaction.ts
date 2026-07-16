import { Router } from "express";
import {
  transfer,
  deposit,
  getTransactions,
  getTransactionById,
  sendTransferOTP,
} from "../controllers/transaction.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All transaction routes require authentication
router.use(protect);

router.post("/otp", sendTransferOTP);      // POST /api/v1/transactions/otp
router.post("/transfer", transfer);        // POST /api/v1/transactions/transfer
router.post("/deposit", deposit);          // POST /api/v1/transactions/deposit
router.get("/", getTransactions);          // GET  /api/v1/transactions
router.get("/:id", getTransactionById);    // GET  /api/v1/transactions/:id

export default router;
