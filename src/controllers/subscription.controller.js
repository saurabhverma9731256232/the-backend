import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import ApiError from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const subscriberId = req.user?._id

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    if (channelId.equals(subscriberId)) {
        throw new ApiError(400, "Cannot subscribe to yourself")
    }

    const channel = await User.findById(channelId)
    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const existingSubscription = await Subscription.findOne({
        channel: channelId,
        subscriber: subscriberId
    })

    let subscription, message
    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id)
        message = "Unsubscribed successfully"
    } else {
        subscription = await Subscription.create({
            channel: channelId,
            subscriber: subscriberId
        })
        message = "Subscribed successfully"
    }

    return res
        .status(200)
        .json(new ApiResponse(200, subscription || null, message))
})

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const {page = 1, limit = 10} = req.query

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    const channel = await User.findById(channelId)
    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: {
            path: "subscriber",
            select: "username avatar fullName"
        }
    }

    const subscribers = await Subscription.paginate(
        { channel: channelId },
        options
    )

    return res
        .status(200)
        .json(new ApiResponse(200, subscribers, "Subscribers fetched successfully"))
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    const {page = 1, limit = 10} = req.query

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID")
    }

    const subscriber = await User.findById(subscriberId)
    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found")
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: {
            path: "channel",
            select: "username avatar fullName"
        }
    }

    const channels = await Subscription.paginate(
        { subscriber: subscriberId },
        options
    )

    return res
        .status(200)
        .json(new ApiResponse(200, channels, "Subscribed channels fetched successfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}