require("dotenv").config();

const express = require("express");
const cors = require('cors')


const app = express();
app.use(cors({
  origin: "http://localhost:5173"
}));

const PORT = 5000;

app.use(express.json());

const healthRoutes = require("./src/routes/health.routes");
app.use("/", healthRoutes);

const authRoutes = require("./src/routes/auth");
app.use("/auth", authRoutes);

const { authenticate, authorizeRole } = require("./src/middleware/auth");

app.get(
  "/tester-only",
  authenticate,
  authorizeRole("TESTER"),
  (req, res) => {
    res.json({ message: "Welcome Tester" });
  }
);

const testcaseRoutes = require('./src/routes/testcase')

app.use('/testcases', testcaseRoutes)


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
