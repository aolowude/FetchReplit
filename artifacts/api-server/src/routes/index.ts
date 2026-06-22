import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import memoryRouter from "./memory";
import scansRouter from "./scans";
import fridgeRouter from "./fridge";
import homeRouter from "./home";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(memoryRouter);
router.use(scansRouter);
router.use(fridgeRouter);
router.use(homeRouter);

export default router;
