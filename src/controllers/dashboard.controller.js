import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import ApiError from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID")
    }

    // Get total video views using aggregation
    const totalViews = await Video.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" }
            }
        }
    ])

    // Get other statistics in parallel
    const [videos, subscribers, likes] = await Promise.all([
        Video.countDocuments({ owner: userId }),
        Subscription.countDocuments({ channel: userId }),
        Like.countDocuments({
            video: { $in: await Video.find({ owner: userId }).distinct('_id') }
        })
    ])

    const stats = {
        totalViews: totalViews[0]?.totalViews || 0,
        totalVideos: videos,
        totalSubscribers: subscribers,
        totalLikes: likes
    }

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id
    const { page = 1, limit = 10 } = req.query

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: {
            path: "owner",
            select: "username avatar"
        }
    }

    const videos = await Video.paginate(
        { owner: userId },
        options
    )

    if (!videos) {
        throw new ApiError(500, "Failed to fetch channel videos")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
}