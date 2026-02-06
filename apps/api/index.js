require("dotenv").config();

const express = require("express");

const app = express();
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


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
