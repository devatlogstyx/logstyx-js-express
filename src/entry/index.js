//@ts-check
const os = require("os");
const { generateSignature } = require("./../lib/node");
const useLogstyx = require("logstyx-js-core");
const { createExpressMiddleware } = require("../lib/middleware");

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
    throw new Error(
        "Logstyx SDK requires Node.js version 18 or higher. Please upgrade your Node.js runtime."
    );
}

module.exports = (options) => {

    let device;

    device = {
        type: "express",
        origin: null,
        os: os.type(),
        platform: os.platform(),
        browser: null,
        screen: null
    };

    const logstyx = useLogstyx({
        ...options,
        device,
        signatureFunc: generateSignature,
    })

    if (options?.captureUncaught === true) {
        try {
            if (typeof process !== "undefined" && typeof window === "undefined") {
                process.on("uncaughtException", (err) =>
                    logstyx.critical({
                        title: err?.name || "Unknown Error",
                        message: err?.message,
                        stack: err?.stack || null
                    })
                );
            }
        } catch (e) {
            console.error(e)
        }
    }

    if (options?.captureUnhandledRejections === true) {
        try {
            const handler = (reason) => {
                const message = reason instanceof Error ? reason.message : String(reason);
                const stack = reason instanceof Error ? reason.stack : undefined;
                const title = reason instanceof Error ? reason.name : "Unhandled Rejection";
                logstyx.critical({
                    title, message, stack
                });
            };

            process.on("unhandledRejection", handler);
        } catch (e) {
            console.error(e)
        }
    }


    // Create and return the Express middleware
    const expressMiddleware = createExpressMiddleware({
        ...options,
        // Pass the logstyx instance to the middleware
        logstyxInstance: logstyx,
        // Map your existing log levels
        logLevels: {
            success: 'SUCCESS',  
            error: 'ERROR',
            critical: 'CRITICAL',
            warning:"WARNING"
        }
    });

    return {
        // The logstyx instance for direct logging
        ...logstyx,

        // Individual handlers for advanced usage
        successHandler: expressMiddleware.successHandler,
        errorHandler: expressMiddleware.errorHandler,
        notFoundHandler: expressMiddleware.notFoundHandler,
        asyncHandler:expressMiddleware.asyncHandler,
    };
};