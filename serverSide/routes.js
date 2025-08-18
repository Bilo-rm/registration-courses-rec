const path = require("path");
const CourseAdvisorSystem = require("./CourseAdvisorSystem");

// Configure multer for file uploads
const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// API endpoint for parsing documents and saving to JSON
const parseAndSave = async (req, res) => {
  try {
    console.log("Received files for parsing:", req.files);
    const files = req.files;

    if (
      !files ||
      !files.curriculum ||
      !files.transcript ||
      !files.availableCourses
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload all three required files: curriculum, transcript, and available courses",
      });
    }

    const advisor = new CourseAdvisorSystem();
    const result = await advisor.parseAndSaveDocuments(
      files.curriculum[0].path,
      files.transcript[0].path,
      files.availableCourses[0].path
    );

    res.json(result);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// API endpoint for loading JSON data and generating recommendations
const loadAndRecommend = async (req, res) => {
  try {
    console.log("Loading data from JSON and generating recommendations...");

    const advisor = new CourseAdvisorSystem();
    const result = await advisor.loadAndRecommend();

    res.json(result);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// API endpoint for getting parsed data as JSON
const getParsedData = async (req, res) => {
  try {
    console.log("Retrieving parsed data...");

    const advisor = new CourseAdvisorSystem();
    const loadSuccess = await advisor.loadParsedData();

    if (!loadSuccess) {
      return res.status(404).json({
        success: false,
        message: "No parsed data found. Please parse documents first.",
      });
    }

    const parsedData = advisor.getParsedDataAsJSON();
    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// API endpoint for course recommendation (legacy - direct processing)
const recommendCourses = async (req, res) => {
  try {
    console.log("Received files:", req.files);
    const files = req.files;

    if (
      !files ||
      !files.curriculum ||
      !files.transcript ||
      !files.availableCourses
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload all three required files: curriculum, transcript, and available courses",
      });
    }

    const advisor = new CourseAdvisorSystem();
    const result = await advisor.processDocuments(
      files.curriculum[0].path,
      files.transcript[0].path,
      files.availableCourses[0].path
    );

    res.json(result);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Test endpoint
const testEndpoint = (req, res) => {
  res.json({
    message: "Server is running!",
    timestamp: new Date().toISOString(),
  });
};

// Serve the main HTML page
const serveHomePage = (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
};

// Setup routes
const setupRoutes = (app) => {
  // API endpoint for parsing documents and saving to JSON
  app.post(
    "/api/parse-and-save",
    upload.fields([
      { name: "curriculum", maxCount: 1 },
      { name: "transcript", maxCount: 1 },
      { name: "availableCourses", maxCount: 1 },
    ]),
    parseAndSave
  );

  // API endpoint for loading JSON data and generating recommendations
  app.post("/api/load-and-recommend", loadAndRecommend);

  // API endpoint for getting parsed data as JSON
  app.get("/api/parsed-data", getParsedData);

  // API endpoint for course recommendation (legacy - direct processing)
  app.post(
    "/api/recommend-courses",
    upload.fields([
      { name: "curriculum", maxCount: 1 },
      { name: "transcript", maxCount: 1 },
      { name: "availableCourses", maxCount: 1 },
    ]),
    recommendCourses
  );

  // Test endpoint
  app.get("/test", testEndpoint);

  // Serve the main HTML page
  app.get("/", serveHomePage);
};

module.exports = { setupRoutes };
