import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getBeneficiaries,
  addBeneficiary,
  updateBeneficiary,
  toggleBeneficiaryStatus,
  deleteBeneficiary,
} from "../controllers/beneficiary";

const router = Router();

// All beneficiary routes require authentication
router.use(authenticate);

router.get("/",           getBeneficiaries);
router.post("/",          addBeneficiary);
router.put("/:id",        updateBeneficiary);
router.patch("/:id/status", toggleBeneficiaryStatus);
router.delete("/:id",     deleteBeneficiary);

export default router;
