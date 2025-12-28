import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "LocalGuide API",
    version: "1.0.0",
    description:
      "Complete backend API for LocalGuide platform - connecting tourists with local guides",
    contact: {
      name: "LocalGuide Team",
      email: "support@localguide.com",
    },
  },
  servers: [
    {
      url: "http://localhost:5001/api",
      description: "Development server",
    },
    {
      url: "https://api.localguide.com/api",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "507f1f77bcf86cd799439011" },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          name: { type: "string", example: "John Doe" },
          phone: { type: "string", example: "+1234567890" },
          role: {
            type: "string",
            enum: ["tourist", "guide", "admin"],
            example: "tourist",
          },
          isEmailVerified: { type: "boolean", example: true },
          isActive: { type: "boolean", example: true },
          avatar: {
            type: "object",
            properties: {
              url: { type: "string" },
              publicId: { type: "string" },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Guide: {
        type: "object",
        properties: {
          _id: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
          isVerified: { type: "boolean", example: false },
          canEnterArchaeologicalSites: { type: "boolean", example: false },
          isLicensed: { type: "boolean", example: true },
          languages: {
            type: "array",
            items: { type: "string" },
            example: ["English", "Arabic"],
          },
          pricePerHour: { type: "number", example: 50 },
          bio: {
            type: "string",
            example: "Experienced guide with 5 years of experience",
          },
          rating: { type: "number", minimum: 0, maximum: 5, example: 4.5 },
          totalTrips: { type: "number", example: 120 },
          documents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                url: { type: "string" },
                publicId: { type: "string" },
                type: {
                  type: "string",
                  enum: [
                    "id_document",
                    "tourism_card",
                    "english_certificate",
                    "other",
                  ],
                },
                status: {
                  type: "string",
                  enum: ["pending", "approved", "rejected"],
                },
                note: { type: "string" },
                uploadedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      Trip: {
        type: "object",
        properties: {
          _id: { type: "string" },
          tourist: { $ref: "#/components/schemas/User" },
          guide: { $ref: "#/components/schemas/Guide" },
          startAt: {
            type: "string",
            format: "date-time",
            example: "2024-12-25T10:00:00Z",
          },
          durationHours: { type: "number", example: 4 },
          meetingPoint: {
            type: "object",
            properties: {
              type: { type: "string", example: "Point" },
              coordinates: {
                type: "array",
                items: { type: "number" },
                example: [31.2357, 30.0444],
              },
              address: { type: "string", example: "Pyramids of Giza" },
            },
          },
          notes: { type: "string", example: "Interested in ancient history" },
          status: {
            type: "string",
            enum: [
              "pending",
              "confirmed",
              "in_progress",
              "completed",
              "cancelled",
            ],
          },
          totalPrice: { type: "number", example: 200 },
          cancellationReason: { type: "string" },
          cancelledBy: { type: "string", enum: ["tourist", "guide", "admin"] },
          cancelledAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Attraction: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "Pyramids of Giza" },
          description: { type: "string" },
          location: {
            type: "object",
            properties: {
              type: { type: "string", example: "Point" },
              coordinates: {
                type: "array",
                items: { type: "number" },
                example: [31.2357, 30.0444],
              },
              address: { type: "string", example: "Al Haram, Giza" },
              city: { type: "string", example: "Giza" },
            },
          },
          images: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                publicId: { type: "string" },
              },
            },
          },
          openingHours: { type: "string", example: "8:00 AM - 5:00 PM" },
          ticketPrice: { type: "number", example: 200 },
          category: {
            type: "string",
            enum: [
              "historical",
              "museum",
              "religious",
              "natural",
              "entertainment",
              "other",
            ],
          },
          isActive: { type: "boolean", example: true },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error message" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "object" },
        },
      },
    },
  },
  tags: [
    {
      name: "Authentication",
      description: "User authentication and authorization endpoints",
    },
    {
      name: "Tourist",
      description: "Tourist-specific endpoints",
    },
    {
      name: "Guide",
      description: "Guide-specific endpoints",
    },
    {
      name: "Admin",
      description: "Admin-only endpoints",
    },
    {
      name: "Trips",
      description: "Trip management endpoints",
    },
    {
      name: "Attractions",
      description: "Attraction endpoints",
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/routes/*.js", "./src/controllers/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
