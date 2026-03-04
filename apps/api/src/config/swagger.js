const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TestTrack Pro API",
      version: "1.0.0",
      description: `
TestTrack Pro Backend API

Features:
- JWT Authentication (Access + Refresh Tokens)
- Role-based Authorization (Tester / Developer)
- Test Case Management
- Execution Workflow Engine
- Bug Lifecycle Management
- Analytics Dashboard
- Reports & Export (CSV / Excel / PDF)
      `,
    },

    servers: [
      {
        url: process.env.BASE_URL || "http://localhost:5000",
        description: "Local Development Server",
      },
    ],

    tags: [
      { name: "Health", description: "API health monitoring" },
      { name: "Authentication", description: "Auth & session management" },
      { name: "TestCases", description: "Test case management APIs" },
      { name: "Executions", description: "Execution workflow APIs" },
      { name: "Bugs", description: "Bug lifecycle management APIs" },
      { name: "Dashboard", description: "Dashboard & analytics APIs" },
      { name: "Reports", description: "Reporting & export APIs" },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      schemas: {

        // ================= USER =================
        User: {
          type: "object",
          required: ["id", "email", "role"],
          properties: {
            id: { type: "integer", example: 1 },
            email: { type: "string", example: "tester@example.com" },
            role: { 
              type: "string",
              enum: ["TESTER", "DEVELOPER"],
              example: "TESTER"
            }
          }
        },

        // ================= TEST CASE =================
        TestCase: {
          type: "object",
          required: ["title"],
          properties: {
            id: { type: "integer", example: 101 },
            title: { type: "string", example: "Verify login with valid credentials" },
            description: { type: "string" },
            priority: { 
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              example: "HIGH"
            },
            module: { type: "string", example: "Authentication" },
            status: { 
              type: "string",
              enum: ["DRAFT", "READY", "ARCHIVED"],
              example: "READY"
            }
          }
        },

        // ================= BUG =================
        Bug: {
          type: "object",
          properties: {
            id: { type: "integer", example: 12 },
            bugId: { type: "string", example: "BUG-2026-00001" },
            title: { type: "string" },
            description: { type: "string" },
            severity: { 
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            },
            priority: { 
              type: "string",
              enum: ["P1_URGENT", "P2_HIGH", "P3_MEDIUM", "P4_LOW"]
            },
            status: { 
              type: "string",
              enum: [
                "NEW",
                "OPEN",
                "IN_PROGRESS",
                "FIXED",
                "VERIFIED",
                "REOPENED",
                "CLOSED",
                "WONT_FIX",
                "DUPLICATE"
              ]
            }
          }
        },

        // ================= EXECUTION =================
        Execution: {
          type: "object",
          properties: {
            id: { type: "integer", example: 55 },
            testcaseId: { type: "integer", example: 101 },
            status: { 
              type: "string",
              enum: ["IN_PROGRESS", "PASS", "FAIL", "BLOCKED", "SKIPPED"]
            },
            executedBy: { type: "integer", example: 3 },
            startedAt: { type: "string", format: "date-time" },
            completedAt: { type: "string", format: "date-time" },
            duration: { type: "integer", description: "Duration in seconds" }
          }
        }

      },
    },

    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  apis: ["./src/routes/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;