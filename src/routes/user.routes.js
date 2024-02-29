import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";

import {upload} from "../middlewares/multer.middleware.js"

import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar", // name should be same in backend and frontend
            maxCount: 1 // maximum number of files to be accepted
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// secured routes
router.route("/logout").post(verifyJWT, logoutUser)




export default router

// import { Router } from "express";
// import { registerUser } from "../controllers/user.controller.js";

// const router = Router();

// router.route("/register").post(registerUser);

// export default router;
