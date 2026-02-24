require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const reportsRoutes = require("./src/routes/reports.routes");

app.use("/reports", reportsRoutes);

app.use(cors({
  origin: "http://localhost:5173"
}));

app.use(express.json());

const PORT = 5000;

// Routes
const healthRoutes = require("./src/routes/health.routes");
app.use("/", healthRoutes);

const authRoutes = require("./src/routes/auth");
app.use("/auth", authRoutes);

const testcaseRoutes = require("./src/routes/testcase");
app.use("/testcases", testcaseRoutes);

const bugRoutes = require("./src/routes/bug.routes");
app.use("/bugs", bugRoutes);

const executionRoutes = require("./src/routes/execution.routes");
app.use("/executions", executionRoutes);


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});