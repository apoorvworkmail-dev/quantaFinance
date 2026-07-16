import { Router } from "express";
import {
  getStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAuditLogs,
  deleteUser,
  verifyUserKYC,
  freezeAccountByAdmin,
  reverseTransaction,
  getAllLoans,
  approveRejectLoan,
} from "../controllers/admin.controller";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

// All admin routes: must be logged in AND have role = "admin"
router.use(protect);
router.use(restrictTo("admin"));

router.get("/stats", getStats);                          // GET   /api/v1/admin/stats
router.get("/users", getAllUsers);                       // GET   /api/v1/admin/users
router.get("/users/:id", getUserById);                   // GET   /api/v1/admin/users/:id
router.patch("/users/:id/status", updateUserStatus);     // PATCH /api/v1/admin/users/:id/status
router.delete("/users/:id", deleteUser);                 // DELETE /api/v1/admin/users/:id
router.patch("/users/:id/verify", verifyUserKYC);        // PATCH /api/v1/admin/users/:id/verify
router.patch("/accounts/:id/status", freezeAccountByAdmin); // PATCH /api/v1/admin/accounts/:id/status
router.post("/transactions/:id/reverse", reverseTransaction); // POST /api/v1/admin/transactions/:id/reverse
router.get("/loans", getAllLoans);                       // GET   /api/v1/admin/loans
router.patch("/loans/:id/status", approveRejectLoan);    // PATCH /api/v1/admin/loans/:id/status
router.get("/audit-logs", getAuditLogs);                 // GET   /api/v1/admin/audit-logs

export default router;
