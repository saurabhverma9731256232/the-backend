import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import ApiError from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const userId = req.user?._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    // Check if like already exists
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    })

    let message, result
    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id)
        message = "Video like removed successfully"
        result = null
    } else {
        const newLike = await Like.create({
            video: videoId,
            likedBy: userId
        })
        message = "Video liked successfully"
        result = newLike
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result, message))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    const userId = req.user?._id

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId
    })

    let message, result
    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id)
        message = "Comment like removed successfully"
        result = null
    } else {
        const newLike = await Like.create({
            comment: commentId,
            likedBy: userId
        })
        message = "Comment liked successfully"
        result = newLike
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result, message))
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    const userId = req.user?._id

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    })

    let message, result
    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id)
        message = "Tweet like removed successfully"
        result = null
    } else {
        const newLike = await Like.create({
            tweet: tweetId,
            likedBy: userId
        })
        message = "Tweet liked successfully"
        result = newLike
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result, message))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id
    const {page = 1, limit = 10} = req.query

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: {
            path: "video",
            select: "title description duration thumbnail views owner",
            populate: {
                path: "owner",
                select: "username avatar"
            }
        }
    }

    const likedVideos = await Like.paginate(
        {
            likedBy: userId,
            video: {$exists: true}
        },
        options
    )

    if (!likedVideos) {
        throw new ApiError(500, "Failed to fetch liked videos")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}