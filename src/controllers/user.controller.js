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
            $unset: {
             refreshToken: 1
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

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) throw new apiError(401, "Unauthorized request")

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)
        if (!user) throw new apiError(401, "invalid refresh token")
        if (incomingRefreshToken !== user?.refreshToken) {
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
            .cookie("refreshToken", newRefreshToken, options)
            .json(ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed successfully"))
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")

    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) throw new apiError(400, "Old password is incorrect")

    user.password = newPassword;
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(
        200,
        {},
        "Password changed successfully"
    ))

}
)

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "Current  user fetched successfully")
    )
})

const updateAcountDetails = asyncHandler(async (req, res) => {
    const { fullname, email, username } = req.body;
    if ([fullname, email, username].some(field => field?.trim() === "")) {
        throw new apiError(400, "All fields are required")
    }
    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            fullname,
            email,
            username: username.toLowerCase()
        }
    },
        {
            new: true,

        }).select("-password ")
    return res.status(200).json(new ApiResponse(
        200,
        user,
        "User account updated successfully"
    ))
})

const UpdateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) throw new apiError(400, "Avatar file is required")
    // delete old image
    if (user.avatar) {
        const deleteOldImage = await uploadOnCloudinary(user.avatar, true); // assuming 2nd param triggers deletion
        if (!deleteOldImage) throw new apiError(400, "Error while deleting old image");
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) throw new apiError(400, "Error while uploading on avatar")
    const user = await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }

    ).select("-password")
    return res.status(200).json(new ApiResponse(
        200,
        user,
        "User avatar updated successfully"
    ))

})
const UpdateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) throw new apiError(400, "Cover image file is required")
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) throw new apiError(400, "Error while uploading on cover image")
    const user = await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }

    ).select("-password")
    return res.status(200).json(new ApiResponse(
        200,
        user,
        "User cover image updated successfully"
    ))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) throw new apiError(400, "Username is required")
    const channel = await User.aggregate([

        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"

            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true, 
                        else: false
                    }
                },
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                email,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        },
       
    ])

    if (!channel?.length) throw new apiError(404, "Channel does not exist")
        return res.status(200).json(new ApiResponse(
            200,
            channel[0],
            "Channel profile fetched successfully"
        ))
})

const getWatchHistory = asyncHandler(async (req, res) => {
const user = await User.aggregate([
    {
        $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
                {
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"owner",
                        pipeline:[
                            {
                                $project:{
                                    fullname:1,
                                    username:1,
                                    avatar:1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                    }
                }
            ]
        }
    },
   
])

return res.status(200).json(new ApiResponse(
    200,
    user[0]?.watchHistory || [],
    "Watch history fetched successfully"
))
})



export { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser, changeCurrentPassword, updateAcountDetails, UpdateUserAvatar, UpdateUserCoverImage, getUserChannelProfile , getWatchHistory } 