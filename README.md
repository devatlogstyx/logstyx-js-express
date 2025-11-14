# Logstyx Express Middleware

Zero-configuration error tracking and monitoring middleware for Express.js applications. Automatically catch, log, and monitor errors with full context and security features.

## Features

- 🚀 **Zero Configuration** - Works out of the box with common Express patterns
- 🔒 **Automatic Security** - Sensitive data redaction built-in
- 📊 **Performance Monitoring** - Track slow requests and response times
- 🎯 **Smart Context** - Automatic user authentication detection
- 🔍 **Error Tracking** - Comprehensive error logging with stack traces
- ⚡ **Async Support** - Automatic error handling for async routes

## Installation

```bash
npm install github:devatlogstyx/logstyx-js-express#release
```

## Quick Start

```javascript
const express = require('express');
const logstyx = require('logstyx-js-express')({
   projectId: 'YOUR_PROJECT_ID',
   apiKey: 'YOUR_API_KEY',
});

const app = express();
app.use(express.json());

// 1. Add success handler first
app.use(logstyx.successHandler);

// 2. Add your routes - wrap async routes with asyncHandler
app.get('/users/:id', logstyx.asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id); // Errors auto-caught!
  res.json(user);
}));

app.post('/users', logstyx.asyncHandler(async (req, res) => {
  const user = await createUser(req.body); // Errors auto-caught!
  res.json(user);
}));

// Sync routes don't need asyncHandler
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 3. Add error handlers LAST (after all routes)
app.use(logstyx.notFoundHandler);
app.use(logstyx.errorHandler);

app.listen(3000);
```

## Async Route Handling

### Why Use `asyncHandler`?

In Express 4.x, unhandled promise rejections in async routes won't reach error handlers. The `asyncHandler` wrapper ensures all async errors are properly caught and logged.

### With asyncHandler (Recommended)

```javascript
// ✅ Errors automatically caught and logged
app.get('/users/:id', logstyx.asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
}));
```

### Without asyncHandler (Manual)

```javascript
// ❌ Requires manual error handling
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error); // Must manually pass to error handler
  }
});
```

### Express 5.x Users

If you're using Express 5.x, async errors are handled automatically. You can skip `asyncHandler`, but it won't hurt to use it for consistency.

## Configuration

```javascript
const logstyx = require('logstyx-express')({
  // Required
  apiKey: 'your-api-key',
  
  // Optional
  captureUncaught: true,           // Catch uncaught exceptions
  captureUnhandledRejections: true, // Catch unhandled promise rejections
  trackPerformance: true,          // Track response times
  slowRequestThreshold: 1000,      // Flag requests slower than 1000ms
  
  // Security
  redactFields: ['password', 'token', 'email', 'creditCard'],
  
  // Custom context
  buildRequestPayload: (req) => ({
    user: req.currentUser,         // Custom user property
    tenant: req.organization       // Business context
  })
});
```

## Authentication Patterns

Works automatically with common authentication libraries:

### Passport.js

```javascript
// Works automatically - Passport uses req.user
app.use(logstyx.successHandler);
app.use(passport.initialize());

app.get('/profile', logstyx.asyncHandler(async (req, res) => {
  // req.user is automatically captured in logs
  const profile = await getProfile(req.user.id);
  res.json(profile);
}));
```

### Custom Authentication

```javascript
const logstyx = require('logstyx-express')({
  apiKey: 'your-key',
  buildRequestPayload: (req) => ({
    user: req.currentUser,        // Your custom property
    session: req.session,
    permissions: req.scopes
  })
});
```

### JWT Tokens

```javascript
const logstyx = require('logstyx-express')({
  apiKey: 'your-key',
  buildRequestPayload: (req) => ({
    user: req.tokenPayload?.user, // From your JWT middleware
    clientId: req.tokenPayload?.client_id
  })
});
```

## Manual Logging

You can also use Logstyx for custom logging:

```javascript
const logstyx = require('logstyx-express')({
  apiKey: 'your-api-key'
});

// Use custom log levels
app.post('/webhook', logstyx.asyncHandler(async (req, res) => {
  logstyx.send("SUCCESS", 'Webhook received', {
    source: req.headers['user-agent'],
    payload: req.body
  });
  
  await processWebhook(req.body);
  res.json({ received: true });
}));

// Use default log levels
app.get('/health', (req, res) => {
  logstyx.info('Health check', {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
  
  res.json({ status: 'healthy' });
});
```

## API Reference

### Middleware Functions

- `asyncHandler(fn)` - Wraps async route handlers to catch errors automatically
- `successHandler` - Logs successful requests (place before routes)
- `notFoundHandler` - Handles 404 routes (place after routes, but before error handler)
- `errorHandler` - Catches and logs errors (place after routes)

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your Logstyx API key |
| `projectId` | string | required | Your Logstyx Project Id |
| `endpoint` | string | required | Your Logstyx Project Endpoint |
| `captureUncaught` | boolean | false | Catch uncaught exceptions |
| `captureUnhandledRejections` | boolean | false | Catch unhandled promise rejections |
| `trackPerformance` | boolean | true | Track response times |
| `slowRequestThreshold` | number | 1000 | Slow request threshold in ms |
| `redactFields` | string[] | [...] | Fields to redact from logs |
| `buildRequestPayload` | function | auto | Custom context builder |

## Security Features

### Automatic Redaction

Sensitive fields are automatically redacted:

- Passwords, tokens, API keys
- Email addresses, phone numbers
- Credit card information
- Custom fields you specify

### Safe Logging

- Mongoose documents are converted to plain objects
- Nested objects are recursively scanned
- Circular references are handled safely

## Error Examples

### Automatic Error Capture

```javascript
// Wrap async routes with asyncHandler
app.get('/users/:id', logstyx.asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id); // Auto-caught if fails
  res.json(user);
}));

// Multiple async operations
app.post('/orders', logstyx.asyncHandler(async (req, res) => {
  const user = await User.findById(req.body.userId);
  const order = await Order.create({ ...req.body, userId: user.id });
  await sendConfirmationEmail(user.email, order);
  res.json(order);
}));
```

### Custom Error Context

```javascript
app.get('/admin/data', logstyx.asyncHandler(async (req, res, next) => {
  try {
    const data = await getSensitiveData();
    res.json(data);
  } catch (error) {
    // Add custom context before passing to error handler
    logstyx.error('Admin data access failed', {
      adminId: req.user.id,
      action: 'sensitive_data_access'
    });
    next(error);
  }
}));
```

## Best Practices

### 1. Correct Middleware Order

```javascript
const app = express();

// 1. Basic middleware
app.use(express.json());
app.use(cors());

// 2. Logstyx success handler
app.use(logstyx.successHandler);

// 3. Authentication middleware
app.use(passport.initialize());

// 4. YOUR ROUTES (wrap async routes with asyncHandler)
app.get('/api/users', logstyx.asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(users);
}));

// 5. Error handlers (LAST)
app.use(logstyx.notFoundHandler);
app.use(logstyx.errorHandler);
```

### 2. When to Use asyncHandler

```javascript
// ✅ Use asyncHandler for async routes
app.get('/users', logstyx.asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(users);
}));

// ✅ Don't need asyncHandler for sync routes
app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

// ✅ Use asyncHandler even if you have try-catch (for consistency)
app.post('/users', logstyx.asyncHandler(async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (error) {
    // Add custom logging
    logstyx.error('User creation failed', { body: req.body });
    throw error; // Re-throw to be caught by asyncHandler
  }
}));
```

### 3. Custom Context for Business Logic

```javascript
const logstyx = require('logstyx-express')({
  apiKey: 'your-key',
  buildRequestPayload: (req) => ({
    businessUnit: req.headers['x-business-unit'],
    featureFlags: req.featureFlags,
    deployment: process.env.DEPLOYMENT_ID
  })
});
```

### 4. Environment-Specific Configuration

```javascript
const logstyx = require('logstyx-express')({
  apiKey: process.env.LOGSTYX_API_KEY,
  trackPerformance: process.env.NODE_ENV === 'production',
  captureUncaught: process.env.NODE_ENV === 'production',
  captureUnhandledRejections: process.env.NODE_ENV === 'production'
});
```

## Troubleshooting

### Middleware Order Issues

Ensure the correct order:

1. Success handler → BEFORE routes
2. Your routes → IN THE MIDDLE  
3. Error handlers → AFTER all routes

### Async Errors Not Being Caught

If errors in async routes aren't being logged:

```javascript
// ❌ Missing asyncHandler wrapper
app.get('/users', async (req, res) => {
  const users = await User.find(); // Errors won't be caught!
  res.json(users);
});

// ✅ Properly wrapped
app.get('/users', logstyx.asyncHandler(async (req, res) => {
  const users = await User.find(); // Errors caught automatically!
  res.json(users);
}));
```

### Authentication Not Captured

If user data isn't being captured automatically:

```javascript
// Provide custom context builder
buildRequestPayload: (req) => ({
  user: req.currentUser || req.auth?.user || req.session?.user
})
```

## Migration Guide

### Updating Existing Code

If you're adding Logstyx to an existing Express app:

```javascript
// Before
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// After - much cleaner!
app.get('/users/:id', logstyx.asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
}));
```

## Support

- **Issues**: [GitHub Issues](https://github.com/devatlogstyx/logstyx-js-express/issues)
- **Email**: support@logstyx.com