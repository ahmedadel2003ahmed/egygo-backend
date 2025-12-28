import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { generalLimiter } from "./middlewares/rateLimiterMiddleware.js";
import * as paymentController from "./controllers/paymentController.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import touristRoutes from "./routes/touristRoutes.js";
import guideRoutes from "./routes/guideRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import attractionRoutes from "./routes/attractionRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import placeRoutes from "./routes/placeRoutes.js";
import newTripFlowRoutes from "./routes/newTripFlowRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import { fixBrokenIsoDateStringsMiddleware } from "./middlewares/fixBrokenIsoDateStringsMiddleware.js";

const app = express();

/**
 * Security Middlewares
 */
app.use(helmet());

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://bjptwzt0-5173.uks1.devtunnels.ms",
    "https://bjptwzt0-5173.uks1.devtunnels.ms/"
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

/**
 * Stripe Webhook Route (MUST be before body parsers)
 * Uses raw body for signature verification
 */
app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhookHandler
);

/**
 * Body Parsers (after webhook route)
 */ 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Hotfix: Normalize broken ISO 8601 strings before sending JSON
 */
app.use(fixBrokenIsoDateStringsMiddleware);

/**
 * Rate Limiting
 */
app.use(generalLimiter);

/**
 * Swagger API Documentation
 */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "LocalGuide API Documentation",
  })
);

// Swagger JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

/**
 * Health Check
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
app.use("/api/auth", authRoutes);
app.use("/api", newTripFlowRoutes); // NEW: Redesigned trip flow (mount FIRST to override old routes)
app.use("/api/tourist", touristRoutes);
app.use("/api/guide", guideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/attractions", attractionRoutes);
app.use("/api/calls", callRoutes);
app.use("/api", placeRoutes); // Task 1: Provinces and Places
app.use("/api/reviews", reviewRoutes); // Reviews for guides
app.use("/api/chat", chatRoutes); // Trip chat messages

/**
 * Root Route
 */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LocalGuide API",
    version: "1.0.0",
    documentation: "/api-docs",
    endpoints: {
      auth: "/api/auth",
      tourist: "/api/tourist",
      guide: "/api/guide",
      admin: "/api/admin",
      trips: "/api/trips",
      attractions: "/api/attractions",
      provinces: "/api/provinces",
      places: "/api/places",
      chat: "/api/chat",
    },
  });
});

/**
 * 404 Handler
 */
app.use(notFoundHandler);

/**
 * Error Handler (must be last)
 */
app.use(errorHandler);

export default app;
