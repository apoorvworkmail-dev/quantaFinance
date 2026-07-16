import { Router } from "express";
import { openFD, getMyFDs, getFDById, closeFD } from "../controllers/fd.controller";
import { protect } from "../middleware/auth";

const router = Router();

// All FD routes require authentication
router.use(protect);

router.post("/", openFD);
router.get("/", getMyFDs);
router.get("/:id", getFDById);
router.post("/:id/close", closeFD);

export default router;
