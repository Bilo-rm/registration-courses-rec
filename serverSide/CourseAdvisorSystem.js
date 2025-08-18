const fs = require("fs").promises;
const path = require("path");
const Papa = require("papaparse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const pdf = require("pdf-parse");

class CourseAdvisorSystem {
  constructor() {
    this.curriculum = [];
    this.completedCourses = new Map();
    this.availableCourses = [];
    this.studentInfo = {};
    this.dataDirectory = "./data";
  }

  // Ensure data directory exists
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDirectory);
    } catch (error) {
      await fs.mkdir(this.dataDirectory, { recursive: true });
    }
  }

  // Save parsed data to JSON files
  async saveParsedData() {
    await this.ensureDataDirectory();

    const dataToSave = {
      curriculum: this.curriculum,
      completedCourses: Array.from(this.completedCourses.entries()),
      availableCourses: this.availableCourses,
      studentInfo: this.studentInfo,
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(this.dataDirectory, "parsed_data.json");
    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
    console.log(`Parsed data saved to ${filePath}`);

    return filePath;
  }

  // Load parsed data from JSON file
  async loadParsedData(filePath = null) {
    if (!filePath) {
      filePath = path.join(this.dataDirectory, "parsed_data.json");
    }

    try {
      const data = await fs.readFile(filePath, "utf8");
      const parsedData = JSON.parse(data);

      this.curriculum = parsedData.curriculum || [];
      this.completedCourses = new Map(parsedData.completedCourses || []);
      this.availableCourses = parsedData.availableCourses || [];
      this.studentInfo = parsedData.studentInfo || {};

      console.log(`Parsed data loaded from ${filePath}`);
      console.log(`Loaded ${this.curriculum.length} curriculum courses`);
      console.log(`Loaded ${this.completedCourses.size} completed courses`);
      console.log(`Loaded ${this.availableCourses.length} available courses`);

      return true;
    } catch (error) {
      console.error("Error loading parsed data:", error);
      return false;
    }
  }

  // Get parsed data as JSON object
  getParsedDataAsJSON() {
    return {
      curriculum: this.curriculum,
      completedCourses: Array.from(this.completedCourses.entries()),
      availableCourses: this.availableCourses,
      studentInfo: this.studentInfo,
      timestamp: new Date().toISOString(),
    };
  }

  // Parse curriculum document (Word/PDF/Text)
  async parseCurriculum(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let content = "";

      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        content = result.value;
      } else if (ext === ".txt") {
        content = await fs.readFile(filePath, "utf8");
      } else if (ext === ".pdf") {
        // Parse PDF file
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        content = pdfData.text;
      }

      console.log("Curriculum content preview:", content.substring(0, 500));

      // Parse curriculum content with more flexible patterns
      const lines = content.split("\n");
      const curriculum = [];
      let currentSemester = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Detect semester patterns
        const semesterPatterns = [
          /^(\d+)\s+/, // "1 "
          /semester\s+(\d+)/i, // "Semester 1"
          /^(\d+)st|nd|rd|th\s+semester/i, // "1st Semester"
          /^year\s+(\d+)/i, // "Year 1"
        ];

        for (const pattern of semesterPatterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            currentSemester = parseInt(match[1]);
            console.log(`Found semester: ${currentSemester}`);
            break;
          }
        }

        // More flexible course parsing patterns
        const coursePatterns = [
          // Standard pattern: CODE TITLE CATEGORY L T P CREDIT PREREQ ECTS
          /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(AC|FC|UC|FE|AE|UE|CORE|ELECTIVE)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(.+?))?\s+(\d+)/i,
          // Alternative pattern: CODE TITLE CREDITS ECTS CATEGORY
          /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(\d+)\s+(\d+)\s+(AC|FC|UC|FE|AE|UE|CORE|ELECTIVE)/i,
          // Simpler pattern: CODE TITLE CREDITS
          /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(\d+)/,
        ];

        for (const pattern of coursePatterns) {
          const courseMatch = trimmedLine.match(pattern);
          if (courseMatch && currentSemester) {
            let course;

            if (pattern === coursePatterns[0]) {
              const [
                ,
                code,
                title,
                category,
                lecture,
                tutorial,
                lab,
                totalCredit,
                prerequisites,
                ects,
              ] = courseMatch;
              course = {
                semester: currentSemester,
                code: code.trim(),
                title: title.trim(),
                category: category.trim(),
                lecture: parseInt(lecture),
                tutorial: parseInt(tutorial),
                lab: parseInt(lab),
                totalCredit: parseInt(totalCredit),
                prerequisites: prerequisites
                  ? prerequisites
                      .split(",")
                      .map((p) => p.trim())
                      .filter((p) => p && p !== "-")
                  : [],
                ects: parseInt(ects),
              };
            } else if (pattern === coursePatterns[1]) {
              const [, code, title, credits, ects, category] = courseMatch;
              course = {
                semester: currentSemester,
                code: code.trim(),
                title: title.trim(),
                category: category.trim(),
                lecture: 0,
                tutorial: 0,
                lab: 0,
                totalCredit: parseInt(credits),
                prerequisites: [],
                ects: parseInt(ects),
              };
            } else {
              const [, code, title, credits] = courseMatch;
              course = {
                semester: currentSemester,
                code: code.trim(),
                title: title.trim(),
                category: "UC", // Default category
                lecture: 0,
                tutorial: 0,
                lab: 0,
                totalCredit: parseInt(credits),
                prerequisites: [],
                ects: parseInt(credits), // Assume ECTS = credits if not specified
              };
            }

            curriculum.push(course);
            console.log(`Parsed course: ${course.code} - ${course.title}`);
            break;
          }
        }
      }

      this.curriculum = curriculum;
      console.log(`Parsed ${curriculum.length} courses from curriculum`);
      return curriculum;
    } catch (error) {
      console.error("Error parsing curriculum:", error);
      throw error;
    }
  }

  // Parse student transcript (PDF/Excel)
  async parseTranscript(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const completedCourses = new Map();
      let studentInfo = {};

      if (ext === ".xlsx" || ext === ".xls") {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        for (const row of data) {
          if (row.Code && row.Grade) {
            completedCourses.set(row.Code, {
              code: row.Code,
              title: row["Title of Course"] || row.Title || "",
              grade: row.Grade,
              credits: parseFloat(row.Credits) || 0,
              ects:
                parseFloat(row["ECTS Credits"]) || parseFloat(row.ECTS) || 0,
              gradePoints: parseFloat(row["Gr.Pts"]) || 0,
              semester: row.Semester || "",
              passed: this.isPassingGrade(row.Grade),
            });
          }
        }
      } else if (ext === ".pdf") {
        // Parse PDF transcript
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        const content = pdfData.text;

        console.log("Transcript content preview:", content.substring(0, 500));

        const lines = content.split("\n");

        for (const line of lines) {
          // Debug: Log lines that might contain course data
          if (line.trim() && /[A-Z]{2,4}\d{3,4}/.test(line)) {
            console.log(`Processing line: "${line.trim()}"`);
          }

          // Extract student info with more patterns
          const studentPatterns = [
            { pattern: /Student No[:\s]+(\d+)/, key: "studentNo" },
            { pattern: /Name[:\s]+(.+)/, key: "name" },
            { pattern: /Department[:\s-]+Program[:\s]+(.+)/, key: "program" },
            { pattern: /Program[:\s]+(.+)/, key: "program" },
          ];

          for (const { pattern, key } of studentPatterns) {
            const match = line.match(pattern);
            if (match) {
              studentInfo[key] = match[1].trim();
              console.log(`Found student info - ${key}: ${studentInfo[key]}`);
            }
          }

          // Parse course lines with multiple patterns
          const coursePatterns = [
            // Pattern 1: CODE TITLE ECTS GRADE CREDITS GRADEPOINTS
            /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(\d+\.\d+)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+\.\d+)\s+(\d+\.\d+)/,
            // Pattern 2: CODE TITLE GRADE CREDITS ECTS
            /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+)\s+(\d+)/,
            // Pattern 3: Simpler format
            /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+)/,
            // Pattern 4: For transcript format like "ENGP030S 0.00 0.00 0,00"
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+,\d+)/,
            // Pattern 5: For courses with grades like "A", "B+", etc.
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+\.\d+)/,
            // Pattern 6: For courses with just code and title
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(.+?)(?=\s+\d|$)/,
            // Pattern 7: For courses with letter grades at the end (like "PHYS121F", "MATH122D")
            /([A-Z]{2,4}\d{3,4}[A-Z])\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+,\d+)/,
            // Pattern 8: For courses with letter grades and titles
            /([A-Z]{2,4}\d{3,4}[A-Z])\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)/,
            // Pattern 9: For courses with just code and letter grade
            /([A-Z]{2,4}\d{3,4}[A-Z])\s+([A-F][+-]?|W|P|F\*?)/,
            // Pattern 10: For courses with code, title, and grade in various formats
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+)/,
            // Pattern 11: For courses with code and numeric values
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/,
            // Pattern 12: For courses in table format with various separators
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s*[|\t]\s*(.+?)\s*[|\t]\s*([A-F][+-]?|W|P|F\*?)\s*[|\t]\s*(\d+\.?\d*)/,
            // Pattern 13: For courses with code and any numeric data
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(\d+\.?\d*)/,
            // Pattern 14: For courses with code and title separated by multiple spaces
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s{2,}(.+?)(?=\s+\d|$)/,
            // Pattern 15: For courses with code, grade, and numeric values (like "ENGL121C+ 4.00 3.00 6,90")
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+([A-F][+-]?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+,\d+)/,
            // Pattern 16: For courses with code, grade, and numeric values (like "ENGR101B- 2.00 2.00 5,40")
            /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+([A-F][+-]?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/,
            // Pattern 17: For courses with grade embedded in code (like "ENGL121C+ 4.00 3.00 6,90")
            /([A-Z]{2,4}\d{3,4})([A-F][+-]?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+,\d+)/,
            // Pattern 18: For courses with grade embedded in code (like "ENGR101B- 2.00 2.00 5,40")
            /([A-Z]{2,4}\d{3,4})([A-F][+-]?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/,
          ];

          for (const pattern of coursePatterns) {
            const courseMatch = line.match(pattern);
            if (courseMatch) {
              let courseData;

              if (pattern === coursePatterns[0]) {
                const [, code, title, ects, grade, credits, gradePoints] =
                  courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[1]) {
                const [, code, title, grade, credits, ects] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(ects),
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[3]) {
                // Pattern 4: For transcript format like "ENGP030S 0.00 0.00 0,00"
                const [, code, ects, gradePoints, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title in this format
                  grade: "P", // Assume passed if no grade
                  credits: parseFloat(credits.replace(",", ".")),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: true, // Assume passed for this format
                };
              } else if (pattern === coursePatterns[4]) {
                // Pattern 5: For courses with grades like "A", "B+", etc.
                const [, code, title, grade, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(credits), // Assume ECTS = credits
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[5]) {
                // Pattern 6: For courses with just code and title
                const [, code, title] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: "P", // Assume passed
                  credits: 3, // Default credits
                  ects: 3, // Default ECTS
                  gradePoints: 0,
                  passed: true,
                };
              } else if (pattern === coursePatterns[6]) {
                // Pattern 7: For courses with letter grades at the end (like "PHYS121F", "MATH122D")
                const [, code, ects, gradePoints, credits] = courseMatch;
                const grade = code.slice(-1); // Extract the letter grade from the end
                courseData = {
                  code: code.slice(0, -1).trim(), // Remove the grade letter from code
                  title: "", // No title in this format
                  grade: grade,
                  credits: parseFloat(credits.replace(",", ".")),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade),
                };
              } else if (pattern === coursePatterns[7]) {
                // Pattern 8: For courses with letter grades and titles
                const [, code, title, grade] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: 3, // Default credits
                  ects: 3, // Default ECTS
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[8]) {
                // Pattern 9: For courses with just code and letter grade
                const [, code, grade] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title
                  grade: grade.trim(),
                  credits: 3, // Default credits
                  ects: 3, // Default ECTS
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[9]) {
                // Pattern 10: For courses with code, title, and grade in various formats
                const [, code, title, grade, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(credits), // Assume ECTS = credits
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[10]) {
                // Pattern 11: For courses with code and numeric values
                const [, code, val1, val2, val3] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title
                  grade: "P", // Assume passed
                  credits: parseFloat(val3) || 3,
                  ects: parseFloat(val1) || 3,
                  gradePoints: parseFloat(val2) || 0,
                  passed: true,
                };
              } else if (pattern === coursePatterns[11]) {
                // Pattern 12: For courses in table format with various separators
                const [, code, title, grade, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits) || 3,
                  ects: parseFloat(credits) || 3,
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[12]) {
                // Pattern 13: For courses with code and any numeric data
                const [, code, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title
                  grade: "P", // Assume passed
                  credits: parseFloat(credits) || 3,
                  ects: parseFloat(credits) || 3,
                  gradePoints: 0,
                  passed: true,
                };
              } else if (pattern === coursePatterns[13]) {
                // Pattern 14: For courses with code and title separated by multiple spaces
                const [, code, title] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: "P", // Assume passed
                  credits: 3, // Default credits
                  ects: 3, // Default ECTS
                  gradePoints: 0,
                  passed: true,
                };
              } else if (pattern === coursePatterns[14]) {
                // Pattern 15: For courses with code, grade, and numeric values (like "ENGL121C+ 4.00 3.00 6,90")
                const [, code, grade, ects, gradePoints, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title in this format
                  grade: grade.trim(),
                  credits: parseFloat(credits.replace(",", ".")),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[15]) {
                // Pattern 16: For courses with code, grade, and numeric values (like "ENGR101B- 2.00 2.00 5,40")
                const [, code, grade, ects, gradePoints, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title in this format
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[16]) {
                // Pattern 17: For courses with grade embedded in code (like "ENGL121C+ 4.00 3.00 6,90")
                const [, code, grade, ects, gradePoints, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title in this format
                  grade: grade.trim(),
                  credits: parseFloat(credits.replace(",", ".")),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else if (pattern === coursePatterns[17]) {
                // Pattern 18: For courses with grade embedded in code (like "ENGR101B- 2.00 2.00 5,40")
                const [, code, grade, ects, gradePoints, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: "", // No title in this format
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(ects),
                  gradePoints: parseFloat(gradePoints),
                  passed: this.isPassingGrade(grade.trim()),
                };
              } else {
                const [, code, title, grade, credits] = courseMatch;
                courseData = {
                  code: code.trim(),
                  title: title.trim(),
                  grade: grade.trim(),
                  credits: parseFloat(credits),
                  ects: parseFloat(credits), // Assume ECTS = credits
                  gradePoints: 0,
                  passed: this.isPassingGrade(grade.trim()),
                };
              }

              completedCourses.set(courseData.code, courseData);
              console.log(
                `Parsed completed course: ${courseData.code} - ${courseData.grade} (${courseData.credits} credits)`
              );
              break;
            }
          }
        }
      }

      this.completedCourses = completedCourses;
      this.studentInfo = studentInfo;
      console.log(
        `Parsed ${completedCourses.size} completed courses from transcript`
      );
      return { completedCourses, studentInfo };
    } catch (error) {
      console.error("Error parsing transcript:", error);
      throw error;
    }
  }

  // Parse available courses (Word/Text)
  async parseAvailableCourses(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let content = "";

      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        content = result.value;
      } else {
        content = await fs.readFile(filePath, "utf8");
      }

      console.log(
        "Available courses content preview:",
        content.substring(0, 500)
      );

      const availableCourses = [];
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Match course code and title pattern with more flexibility
        const coursePatterns = [
          /([A-Z]{2,4}\d{3,4})\s+(.+)/,
          /([A-Z]{2,4}\s+\d{3,4})\s+(.+)/, // Handle space in course code
          /([A-Z]{2,4}\d{3,4}[A-Z]?)\s+(.+)/, // Handle codes with letters at end
          /([A-Z]{2,4}\d{3,4})\s*$/, // Handle codes without titles
        ];

        for (const pattern of coursePatterns) {
          const courseMatch = trimmedLine.match(pattern);
          if (courseMatch) {
            if (pattern === coursePatterns[3]) {
              // Pattern 4: Handle codes without titles
              const [, code] = courseMatch;
              availableCourses.push({
                code: code.trim().replace(/\s+/g, ""), // Remove spaces from code
                title: code.trim(), // Use code as title
              });
              console.log(`Parsed available course: ${code.trim()}`);
            } else {
              const [, code, title] = courseMatch;
              availableCourses.push({
                code: code.trim().replace(/\s+/g, ""), // Remove spaces from code
                title: title.trim(),
              });
              console.log(
                `Parsed available course: ${code.trim()} - ${title.trim()}`
              );
            }
            break;
          }
        }
      }

      this.availableCourses = availableCourses;
      console.log(`Parsed ${availableCourses.length} available courses`);
      return availableCourses;
    } catch (error) {
      console.error("Error parsing available courses:", error);
      throw error;
    }
  }

  // Check if grade is passing
  isPassingGrade(grade) {
    const failingGrades = ["F", "F*", "FF", "FD", "W"];
    const retakeIndicators = ["(rst)"];

    if (failingGrades.includes(grade)) return false;
    if (retakeIndicators.some((indicator) => grade.includes(indicator)))
      return false;

    return true;
  }

  // Check if prerequisites are met
  arePrerequisitesMet(course) {
    if (!course.prerequisites || course.prerequisites.length === 0) {
      return true;
    }

    return course.prerequisites.every((prereq) => {
      const completedCourse = this.completedCourses.get(prereq);
      return completedCourse && completedCourse.passed;
    });
  }

  // Get student's current semester based on completed credits
  getCurrentSemester() {
    const totalCredits = Array.from(this.completedCourses.values())
      .filter((course) => course.passed)
      .reduce((sum, course) => sum + course.credits, 0);

    // Estimate semester based on credits (assuming ~20 credits per semester)
    const estimatedSemester = Math.floor(totalCredits / 20) + 1;

    console.log(`Total completed credits: ${totalCredits}`);
    console.log(`Estimated current semester: ${estimatedSemester}`);

    return estimatedSemester;
  }

  // Get recommended courses
  getRecommendedCourses() {
    const currentSemester = this.getCurrentSemester();
    const recommendations = {
      nextSemesterCourses: [],
      availableElectives: [],
      missedCourses: [],
      futureRecommendations: [],
    };

    console.log(`\n=== RECOMMENDATION ANALYSIS ===`);
    console.log(`Current semester: ${currentSemester}`);
    console.log(`Total curriculum courses: ${this.curriculum.length}`);
    console.log(`Total available courses: ${this.availableCourses.length}`);

    // Get completed course codes (including base codes)
    const completedCourseCodes = new Set();
    const completedCourseBaseCodes = new Set();

    for (const [code, course] of this.completedCourses.entries()) {
      if (course.passed) {
        completedCourseCodes.add(code);

        // Also add base course codes (e.g., "PHYS121" from "PHYS121F")
        const baseCode = code.replace(/[A-Z]$/, ""); // Remove trailing letter
        completedCourseBaseCodes.add(baseCode);

        // Also add the original code as base code
        completedCourseBaseCodes.add(code);
      }
    }

    console.log(
      `Completed course codes: ${Array.from(completedCourseCodes).join(", ")}`
    );
    console.log(
      `Completed base course codes: ${Array.from(completedCourseBaseCodes).join(
        ", "
      )}`
    );

    // Find courses student can take
    for (const course of this.curriculum) {
      // Skip if already completed (check both exact match and base code match)
      if (
        completedCourseCodes.has(course.code) ||
        completedCourseBaseCodes.has(course.code)
      ) {
        console.log(
          `Skipping ${course.code} - already completed (exact or base match)`
        );
        continue;
      }

      // Check if course is available this semester
      const isAvailable = this.availableCourses.some(
        (avail) => avail.code === course.code
      );
      if (!isAvailable) {
        console.log(`Skipping ${course.code} - not available this semester`);
        continue;
      }

      // Check prerequisites
      const canTake = this.arePrerequisitesMet(course);
      if (!canTake) {
        console.log(`Skipping ${course.code} - prerequisites not met`);
        continue;
      }

      console.log(
        `Considering ${course.code} (semester ${course.semester}, category ${course.category})`
      );

      // More intelligent recommendation logic
      if (
        course.semester === currentSemester ||
        course.semester === currentSemester + 1 ||
        // If student is in high semester, also consider courses from lower semesters they haven't taken
        (currentSemester > 8 &&
          course.semester <= 8 &&
          !completedCourseCodes.has(course.code) &&
          !completedCourseBaseCodes.has(course.code)) ||
        // Consider courses within 2 semesters of current level
        (course.semester <= currentSemester + 2 &&
          course.semester >= currentSemester - 2)
      ) {
        console.log(`Adding ${course.code} to next semester courses`);
        recommendations.nextSemesterCourses.push({
          ...course,
          priority: this.calculatePriority(course, currentSemester),
          reason: this.getRecommendationReason(course, currentSemester),
        });
      } else if (
        course.category === "AE" ||
        course.category === "FE" ||
        course.category === "UE"
      ) {
        console.log(`Adding ${course.code} to electives`);
        recommendations.availableElectives.push(course);
      } else if (course.semester < currentSemester) {
        console.log(`Adding ${course.code} to missed courses`);
        recommendations.missedCourses.push(course);
      } else {
        console.log(`Adding ${course.code} to future recommendations`);
        recommendations.futureRecommendations.push(course);
      }
    }

    // Sort by priority
    recommendations.nextSemesterCourses.sort((a, b) => b.priority - a.priority);

    console.log(`\n=== RECOMMENDATION RESULTS ===`);
    console.log(
      `Next semester courses: ${recommendations.nextSemesterCourses.length}`
    );
    console.log(
      `Available electives: ${recommendations.availableElectives.length}`
    );
    console.log(`Missed courses: ${recommendations.missedCourses.length}`);
    console.log(
      `Future recommendations: ${recommendations.futureRecommendations.length}`
    );

    return recommendations;
  }

  // Calculate course priority
  calculatePriority(course, currentSemester) {
    let priority = 0;

    // Higher priority for core courses
    if (course.category === "AC") priority += 10; // Area Core
    if (course.category === "FC") priority += 8; // Faculty Core
    if (course.category === "UC") priority += 6; // University Core

    // Higher priority for courses in expected semester
    if (course.semester === currentSemester) priority += 5;
    if (course.semester === currentSemester + 1) priority += 3;

    // For high-semester students, prioritize courses they haven't taken yet
    if (currentSemester > 8 && course.semester <= 8) {
      priority += 4; // Good priority for foundational courses
    }

    // Lower priority for delayed courses, but not too much for high-semester students
    if (course.semester < currentSemester) {
      priority -= currentSemester > 8 ? 1 : 2; // Less penalty for high-semester students
    }

    // Higher priority for prerequisite courses (courses that unlock others)
    const unlocks = this.curriculum.filter((c) =>
      c.prerequisites.includes(course.code)
    ).length;
    priority += unlocks * 2;

    return priority;
  }

  // Get recommendation reason
  getRecommendationReason(course, currentSemester) {
    const reasons = [];

    if (course.semester === currentSemester) {
      reasons.push("Current semester course");
    } else if (course.semester === currentSemester + 1) {
      reasons.push("Next semester course");
    } else if (course.semester < currentSemester) {
      reasons.push("Delayed from previous semester");
    }

    if (course.category === "AC") reasons.push("Area Core requirement");
    if (course.category === "FC") reasons.push("Faculty Core requirement");

    // Check if it's a prerequisite for other courses
    const unlocks = this.curriculum.filter((c) =>
      c.prerequisites.includes(course.code)
    );
    if (unlocks.length > 0) {
      reasons.push(`Prerequisite for ${unlocks.length} other courses`);
    }

    return reasons.join(", ");
  }

  // Generate student progress report
  generateProgressReport() {
    const completedCourses = Array.from(this.completedCourses.values()).filter(
      (course) => course.passed
    );

    const totalECTS = completedCourses.reduce(
      (sum, course) => sum + course.ects,
      0
    );
    const totalCredits = completedCourses.reduce(
      (sum, course) => sum + course.credits,
      0
    );
    const currentSemester = this.getCurrentSemester();

    // Calculate category completion
    const categoryStats = {};
    for (const course of this.curriculum) {
      if (!categoryStats[course.category]) {
        categoryStats[course.category] = { required: 0, completed: 0 };
      }
      categoryStats[course.category].required++;

      if (
        this.completedCourses.has(course.code) &&
        this.completedCourses.get(course.code).passed
      ) {
        categoryStats[course.category].completed++;
      }
    }

    return {
      studentInfo: this.studentInfo,
      currentSemester,
      totalECTS,
      totalCredits,
      completedCourses: completedCourses.length,
      totalRequiredCourses: this.curriculum.length,
      categoryStats,
      completionPercentage: Math.round(
        (completedCourses.length / this.curriculum.length) * 100
      ),
    };
  }

  // Parse all documents and save to JSON
  async parseAndSaveDocuments(
    curriculumPath,
    transcriptPath,
    availableCoursesPath
  ) {
    try {
      console.log("Parsing documents and saving to JSON...");

      // Parse all documents
      await this.parseCurriculum(curriculumPath);
      await this.parseTranscript(transcriptPath);
      await this.parseAvailableCourses(availableCoursesPath);

      // Save parsed data to JSON
      const savedFilePath = await this.saveParsedData();

      return {
        success: true,
        savedFilePath,
        parsedData: this.getParsedDataAsJSON(),
        message: "Documents parsed and saved to JSON successfully",
      };
    } catch (error) {
      console.error("Error parsing and saving documents:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Load data from JSON and generate recommendations
  async loadAndRecommend(filePath = null) {
    try {
      console.log("Loading data from JSON and generating recommendations...");

      // Load parsed data from JSON
      const loadSuccess = await this.loadParsedData(filePath);
      if (!loadSuccess) {
        throw new Error("Failed to load parsed data from JSON");
      }

      // Generate recommendations
      const recommendations = this.getRecommendedCourses();
      const progressReport = this.generateProgressReport();

      return {
        success: true,
        progressReport,
        recommendations,
        parsedData: this.getParsedDataAsJSON(),
        message: "Recommendations generated successfully from JSON data",
      };
    } catch (error) {
      console.error(
        "Error loading data and generating recommendations:",
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Main method to process all documents and generate recommendations (legacy method)
  async processDocuments(curriculumPath, transcriptPath, availableCoursesPath) {
    try {
      console.log("Processing documents...");

      // Parse all documents
      await this.parseCurriculum(curriculumPath);
      await this.parseTranscript(transcriptPath);
      await this.parseAvailableCourses(availableCoursesPath);

      // Generate recommendations
      const recommendations = this.getRecommendedCourses();
      const progressReport = this.generateProgressReport();

      return {
        success: true,
        progressReport,
        recommendations,
        message: "Documents processed successfully",
      };
    } catch (error) {
      console.error("Error processing documents:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = CourseAdvisorSystem;
