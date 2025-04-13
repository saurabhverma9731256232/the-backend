
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const healthcheck = asyncHandler(async (req, res) => {
    // Healthcheck response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    status: "OK",
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime()
                },
                "Service is healthy and operational"
            )
        )
})

export {
    healthcheck
}