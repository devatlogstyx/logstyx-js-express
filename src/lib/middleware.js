// your-sdk-express/express-middleware.js
function createExpressMiddleware(options = {}) {
    const config = {
        // Use the provided logstyx instance or create a default logger
        logstyx: options.logstyxInstance || console,


        // Security
        redactFields: options.redactFields || ['mobile', 'phone', 'email', 'password', 'token', 'authorization', 'creditCard'],

        // Payload configuration
        buildRequestPayload: options.buildRequestPayload || defaultBuildRequestPayload,
        contextHook: options.contextHook || null,

        // Performance
        trackPerformance: options.trackPerformance !== false,
        slowRequestThreshold: options.slowRequestThreshold || 1000,

        // Log levels
        logLevels: options.logLevels || {
            success: 'SUCCESS',
            error: 'ERROR',
            critical: 'CRITICAL'
        },

        ...options
    };

    return {
        successHandler: createSuccessHandler(config),
        notFoundHandler: createNotFoundHandler(config),
        errorHandler: createErrorHandler(config),
        asyncHandler: (fn) => (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        }

    };
}

// Success Handler
function createSuccessHandler(config) {
    return (req, res, next) => {
        const methods = ["send", "json", "end"];
        const originals = {};
        let logged = false;

        methods.forEach((m) => {
            originals[m] = res[m];
            res[m] = ((method) => {
                return function (...args) {
                    // Auto-logging for successful requests
                    if (!logged && shouldLogSuccess(res, req)) {
                        logged = true;
                        logSuccess(req, res, method, args, config);
                    }

                    return originals[method].apply(this, args);
                };
            })(m);
        });

        // Performance tracking
        if (config.trackPerformance) {
            req._startTime = Date.now();
        }

        next();
    };
}

function logSuccess(req, res, method, args, config) {
    const responseTime = config.trackPerformance ? Date.now() - req._startTime : null;
    const requestPayload = buildFinalPayload(req, config);

    const logData = {
        title: `${req.method} ${req.path}`,
        message: "Request completed successfully",
        ...requestPayload,
        body: redactObject(req.body, config.redactFields),
        response: method === "json" || method === "send" ?
            redactObject(args[0], config.redactFields) : null,
        responseTime: responseTime,
        statusCode: res.statusCode,
        isSlow: responseTime > config.slowRequestThreshold
    };

    config.logstyx[config.logLevels.success](logData);
}

// Error Handler
function createErrorHandler(config) {
    return (err, req, res, next) => {
        const statusCode = err.statusCode || err.status || 500;
        res.status(statusCode).json({
            error: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });

        logError(err, req, config);
        next(err);
    };
}

function logError(err, req, config) {
    const responseTime = config.trackPerformance ? Date.now() - req._startTime : null;
    const requestPayload = buildFinalPayload(req, config);

    const logData = {
        title: `${req.method} ${req.path}`,
        message: err?.message,
        ...requestPayload,
        stack: err?.stack,
        errorType: err?.constructor?.name,
        code: err?.code,
        body: redactObject(req.body, config.redactFields),
        responseTime: responseTime,
        statusCode: err?.statusCode || err?.status || 500
    };

    const logLevel = err.statusCode >= 500 ? config.logLevels.critical : config.logLevels.error;
    config.logstyx[logLevel](logData);
}

// Not Found Handler
function createNotFoundHandler(config) {
    return (req, res, next) => {
        const notFoundError = new Error(`Route not found: ${req.method} ${req.path}`);
        notFoundError.statusCode = 404;
        notFoundError.code = 'NOT_FOUND';
        next(notFoundError);
    };
}

// Helper functions
function defaultBuildRequestPayload(req) {
    const context = {
        method: req.method,
        url: req.url,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.id || req.headers['x-request-id'],
        user: findUserInRequest(req),
        admin: findAdminInRequest(req),
        session: req.session ? { id: req.session.id } : null,
        query: req.query,
        params: req.params
    };
    return context;
}

function findUserInRequest(req) {
    const userSources = [
        req.user, req.auth?.user, req.session?.user,
        req.locals?.user, req.context?.user, req.currentUser,
        req.account, req.profile
    ];
    const user = userSources.find(source =>
        source && (source.id || source.email || source.username)
    );
    return user || null;
}

function findAdminInRequest(req) {
    return req.admin ||
        (req.user?.isAdmin ? req.user : null) ||
        req.session?.admin;
}

function shouldLogSuccess(res, req) {
    return res.statusCode >= 200 &&
        res.statusCode < 300 &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
}

function buildFinalPayload(req, config) {
    let context = config.buildRequestPayload(req);
    if (config.contextHook) {
        const customPayload = config.contextHook(req);
        context = { ...context, ...customPayload };
    }
    return redactObject(context, config.redactFields);
}

function redactObject(obj, redactFields) {
    if (!obj || typeof obj !== "object") return obj;

    // Convert Mongoose documents to plain objects
    if (obj.toObject && typeof obj.toObject === 'function') {
        obj = obj.toObject();
    }

    const out = Array.isArray(obj) ? [] : {};

    for (const [k, v] of Object.entries(obj)) {
        if (redactFields.includes(k.toLowerCase())) {
            out[k] = "[REDACTED]";
        } else if (v !== null && typeof v === "object") {
            out[k] = redactObject(v, redactFields);
        } else {
            out[k] = v;
        }
    }
    return out;
}

// Export the middleware creator
module.exports = {
    createExpressMiddleware
};