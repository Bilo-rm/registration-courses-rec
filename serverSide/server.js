const express = require("express");
const { setupRoutes } = require("./routes");

const app = express();
const port = 3001;

// Add error handling for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Middleware
app.use(express.json());
app.use(express.static("public")); // Serve static files from public directory

// Create uploads directory if it doesn't exist
const uploadsDir = "./uploads";
if (!require("fs").existsSync(uploadsDir)) {
  require("fs").mkdirSync(uploadsDir);
}

// Create public directory if it doesn't exist
const publicDir = "./public";
if (!require("fs").existsSync(publicDir)) {
  require("fs").mkdirSync(publicDir);
}

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  console.log(`Course Advisor System running at http://localhost:${port}`);
  console.log(
    "Upload your curriculum, transcript, and available courses files to get recommendations"
  );
});
