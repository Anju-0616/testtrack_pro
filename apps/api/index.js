require("dotenv").config();

console.log(require.resolve("./src/config/swagger"));
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // allow no-origin requests (mobile, curl, etc.)
    if (!origin) return callback(null, true)
    // allow localhost
    if (origin.startsWith('http://localhost')) return callback(null, true)
    // allow ANY vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true)
    // allow custom domain from env
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true
}))

app.use(express.json());

const PORT = process.env.PORT || 5000;

const healthRoutes = require("./src/routes/health.routes");
app.use("/", healthRoutes);

const authRoutes = require("./src/routes/auth");
app.use("/auth", authRoutes);

const testcaseRoutes = require("./src/routes/testcase");
app.use("/test-cases", testcaseRoutes);

const bugRoutes = require("./src/routes/bug.routes");
app.use("/bugs", bugRoutes);

const executionRoutes = require("./src/routes/execution.routes");
app.use("/executions", executionRoutes);

const dashboardRoutes = require("./src/routes/dashboard.routes");
app.use("/dashboard", dashboardRoutes);

const reportsRoutes = require("./src/routes/reports.routes");
app.use("/reports", reportsRoutes);

const usersRoutes = require("./src/routes/users")
app.use("/users", usersRoutes)

const notificationRoutes = require("./src/routes/notification.routes");
app.use("/notifications", notificationRoutes);

const projectRoutes = require("./src/routes/project.routes");
app.use("/projects", projectRoutes);

const testSuiteRoutes = require("./src/routes/testsuites.routes");
app.use("/test-suites", testSuiteRoutes);

const testRunRoutes = require("./src/routes/testrun.routes");
app.use("/test-runs", testRunRoutes);

const milestoneRoutes = require("./src/routes/milestone.routes");
app.use("/milestones", milestoneRoutes);

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});