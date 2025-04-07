import asyncHandler from '../utils/asyncHandler.js'
import apiError from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import uploadOnCloudinary from '../utils/cloudinary.js'
import ApiResponse from '../utils/ApiResponse.js'
import { set } from 'mongoose'
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new apiError(500, "something went wrong while generating access and refresh token")
    }
}




const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body;
    // console.log("Email : ", email);
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new apiError(400, "All fields are required")
    }
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new apiError(409, "User with email or username already exists")
    }
    // console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path

    }


    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new apiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new apiError(500, "something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})
// login user
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email , password
    //find the user
    //password check
    //access and refresh token
    // send cookie
    const { email, password } = req.body;

    if ([email, password].some(field => field?.trim() === "")) {
        throw new apiError(400, "All fields are required")
    }
    const user = await User.findOne({
        $or: [{ email }, { password }]
    });
    if (!user) {
        throw new apiError(404, "user does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new apiError(401, "password is incorrect")
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200).cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            "User logged in successfully"
        ))



})

// logout user 
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true,
        }

    )
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200).clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(
            200,
            {},
            "User logged out successfully"
        ))


})

const refreshAccessToken = asyncHandler(async (req, res) =>{
      const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if(incomingRefreshToken) throw new apiError(401, "Unauthorized request")

           try {
            const decodedToken =  jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
 
        const user = await User.findById(decodedToken?._id)
          if(!user) throw new apiError(401, "invalid refresh token")
             if(incomingRefreshToken !==user?.refreshToken){
                 throw new apiError(401, "Refresh token expired or used")
             }
 
           const options = {
             httpOnly: true,
             secure: true,
            }
         const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken",  newRefreshToken, options)
        .json(ApiResponse(
         200,
         {accessToken,refreshToken: newRefreshToken},
         "Access token refreshed successfully"))
           } catch (error) {
               throw new apiError(401, error?.message || "Invalid refresh token")
            
           }
})
export { registerUser, loginUser, logoutUser, refreshAccessToken } 