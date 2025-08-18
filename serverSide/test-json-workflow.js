const CourseAdvisorSystem = require("./server.js");

async function testJSONWorkflow() {
  console.log("=== Testing JSON-based Course Advisor Workflow ===\n");

  const advisor = new CourseAdvisorSystem();

  try {
    // Step 1: Parse documents and save to JSON
    console.log("Step 1: Parsing documents and saving to JSON...");

    // Note: You would need actual file paths here
    // For demonstration, we'll use sample data
    const sampleCurriculum = [
      {
        semester: 1,
        code: "CS101",
        title: "Introduction to Computer Science",
        category: "AC",
        lecture: 3,
        tutorial: 1,
        lab: 2,
        totalCredit: 6,
        prerequisites: [],
        ects: 6,
      },
      {
        semester: 1,
        code: "MATH101",
        title: "Calculus I",
        category: "UC",
        lecture: 3,
        tutorial: 1,
        lab: 0,
        totalCredit: 4,
        prerequisites: [],
        ects: 4,
      },
      {
        semester: 2,
        code: "CS102",
        title: "Data Structures",
        category: "AC",
        lecture: 3,
        tutorial: 1,
        lab: 2,
        totalCredit: 6,
        prerequisites: ["CS101"],
        ects: 6,
      },
    ];

    const sampleCompletedCourses = new Map([
      [
        "CS101",
        {
          code: "CS101",
          title: "Introduction to Computer Science",
          grade: "A",
          credits: 6,
          ects: 6,
          gradePoints: 4.0,
          passed: true,
        },
      ],
      [
        "MATH101",
        {
          code: "MATH101",
          title: "Calculus I",
          grade: "B+",
          credits: 4,
          ects: 4,
          gradePoints: 3.3,
          passed: true,
        },
      ],
    ]);

    const sampleAvailableCourses = [
      { code: "CS102", title: "Data Structures" },
      { code: "CS201", title: "Algorithms" },
      { code: "MATH102", title: "Calculus II" },
    ];

    const sampleStudentInfo = {
      studentNo: "12345",
      name: "John Doe",
      program: "Computer Science",
    };

    // Set the sample data
    advisor.curriculum = sampleCurriculum;
    advisor.completedCourses = sampleCompletedCourses;
    advisor.availableCourses = sampleAvailableCourses;
    advisor.studentInfo = sampleStudentInfo;

    // Save to JSON
    const savedFilePath = await advisor.saveParsedData();
    console.log(`✅ Data saved to: ${savedFilePath}\n`);

    // Step 2: Load data from JSON and generate recommendations
    console.log(
      "Step 2: Loading data from JSON and generating recommendations..."
    );

    // Create a new advisor instance to simulate loading from JSON
    const newAdvisor = new CourseAdvisorSystem();
    const loadResult = await newAdvisor.loadAndRecommend();

    if (loadResult.success) {
      console.log(
        "✅ Successfully loaded data and generated recommendations\n"
      );

      // Display the results
      console.log("📊 Progress Report:");
      console.log(JSON.stringify(loadResult.progressReport, null, 2));

      console.log("\n🎯 Recommendations:");
      console.log(JSON.stringify(loadResult.recommendations, null, 2));

      console.log("\n📄 Parsed Data Summary:");
      const parsedData = loadResult.parsedData;
      console.log(`- Curriculum courses: ${parsedData.curriculum.length}`);
      console.log(`- Completed courses: ${parsedData.completedCourses.length}`);
      console.log(`- Available courses: ${parsedData.availableCourses.length}`);
      console.log(
        `- Student info: ${Object.keys(parsedData.studentInfo).length} fields`
      );
    } else {
      console.log("❌ Failed to load data:", loadResult.error);
    }

    // Step 3: Demonstrate getting parsed data as JSON
    console.log("\nStep 3: Getting parsed data as JSON...");
    const jsonData = advisor.getParsedDataAsJSON();
    console.log("✅ Retrieved parsed data as JSON object");
    console.log(`- Data timestamp: ${jsonData.timestamp}`);
    console.log(`- Data size: ${JSON.stringify(jsonData).length} characters`);
  } catch (error) {
    console.error("❌ Error in workflow:", error);
  }
}

// Run the test
testJSONWorkflow()
  .then(() => {
    console.log("\n=== Test completed ===");
  })
  .catch((error) => {
    console.error("Test failed:", error);
  });
