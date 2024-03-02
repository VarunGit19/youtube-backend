import {asyncHandler} from "../utils/asyncHandler.js";

import {ApiError} from "../utils/ApiError.js"

import User from "../models/user.model.js"

import { uploadOnCloudinary } from "../utils/cloudinary.js";

import { ApiResponse } from "../utils/ApiResponse.js";

import jwt, { decode } from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)    

        const accessToken = user.generateAccessToken()    
        
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req, res) => {
    // get user details from frontend:

    const {fullName, email, username, password} = req.body;
    console.log(fullName, email, username, password);

    // Validation that fields are not empty

    if([fullName, email, username, password].some((field) => field?.trim() === "")) {
        
        throw new ApiError(400, "All fields are required")
    }

    // Checking if user already exits: 
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

        // checking if the images and avatar:
    const avatarLocalPath = req.files?.avatar[0]?.path;

        //const coverImageLocalPath = req.files?.coverImage[0]?.path;

        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path
        }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    // upload on Cloudinary:

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)


    // Creating a user using model and .create method:

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        password,
        email
    })


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ) // checking if user is created. mongoDB gives an id to all the entries. that id is taken using the findById method and passing the ._id parameter. The select method is used to specify what all things we don't need 

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created Successfully!")
    )

})

const loginUser = asyncHandler(async(req, res) => {
    // extract data from req.body: 

    const {email, username, password} = req.body

    if(!email && !username) {
        throw new ApiError(400, "username or email is required")
    }
    
        // find user based on the email or username in the database

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

        // if user isn't found: 
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // checking password: 
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // create access and refresh

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // sending cookies

    const options = {
        httpOnly: true,
        secure: true
    }

    // returning the response:

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )

})

const logoutUser = asyncHandler(async (req, res) => {
    await  User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(200, {}, "User logged Out")
})

const refreshAccessToken = asyncHandler(async(req, res) => {

    // getting & storing the user's refresh token
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        )
    
        // finding user information:
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        // matching the incoming refresh token (which the user has sent) and the one which we have decoded and stored in the "user" variable:
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        // if the execution has reached here, it means that the refresh tokens are matched and now we have to generate a new access token for the user:
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newrefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req, res) => {

    // getting old password and new password from the req and finding the user using the req.user (since we used the auth middleware): 
    const {oldPassword, newPassword, confirmPassword} = req.body

    if(!(newPassword === confirmPassword)) {
        throw new ApiError(400, "The new password and confirm password are different")
    }

    const user = await User.findById(req.user?._id)

    // checking if old password is correct: 
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password")
    }

    // setting new password:
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body 

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

// controller to update user Avatar:

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path // we have this access because of multer
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path // we have this access because of multer
    
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
} 