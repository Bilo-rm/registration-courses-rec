const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const pdf = require('pdf-parse');

class CourseAdvisorSystem {
    constructor() {
        this.curriculum = [];
        this.completedCourses = new Map();
        this.availableCourses = [];
        this.studentInfo = {};
    }

    // Parse curriculum document (Word/PDF/Text)
    async parseCurriculum(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            let content = '';

            if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                content = result.value;
            } else if (ext === '.txt') {
                content = await fs.readFile(filePath, 'utf8');
            } else if (ext === '.pdf') {
                // Parse PDF file
                const dataBuffer = await fs.readFile(filePath);
                const pdfData = await pdf(dataBuffer);
                content = pdfData.text;
            }

            console.log('Curriculum content preview:', content.substring(0, 500));

            // Parse curriculum content with more flexible patterns
            const lines = content.split('\n');
            const curriculum = [];
            let currentSemester = null;

            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Detect semester patterns
                const semesterPatterns = [
                    /^(\d+)\s+/,  // "1 "
                    /semester\s+(\d+)/i,  // "Semester 1"
                    /^(\d+)st|nd|rd|th\s+semester/i,  // "1st Semester"
                    /^year\s+(\d+)/i  // "Year 1"
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
                    /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(\d+)/
                ];

                for (const pattern of coursePatterns) {
                    const courseMatch = trimmedLine.match(pattern);
                    if (courseMatch && currentSemester) {
                        let course;
                        
                        if (pattern === coursePatterns[0]) {
                            const [, code, title, category, lecture, tutorial, lab, totalCredit, prerequisites, ects] = courseMatch;
                            course = {
                                semester: currentSemester,
                                code: code.trim(),
                                title: title.trim(),
                                category: category.trim(),
                                lecture: parseInt(lecture),
                                tutorial: parseInt(tutorial),
                                lab: parseInt(lab),
                                totalCredit: parseInt(totalCredit),
                                prerequisites: prerequisites ? prerequisites.split(',').map(p => p.trim()).filter(p => p && p !== '-') : [],
                                ects: parseInt(ects)
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
                                ects: parseInt(ects)
                            };
                        } else {
                            const [, code, title, credits] = courseMatch;
                            course = {
                                semester: currentSemester,
                                code: code.trim(),
                                title: title.trim(),
                                category: 'UC', // Default category
                                lecture: 0,
                                tutorial: 0,
                                lab: 0,
                                totalCredit: parseInt(credits),
                                prerequisites: [],
                                ects: parseInt(credits) // Assume ECTS = credits if not specified
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
            console.error('Error parsing curriculum:', error);
            throw error;
        }
    }

    // Parse student transcript (PDF/Excel)
    async parseTranscript(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const completedCourses = new Map();
            let studentInfo = {};

            if (ext === '.xlsx' || ext === '.xls') {
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                for (const row of data) {
                    if (row.Code && row.Grade) {
                        completedCourses.set(row.Code, {
                            code: row.Code,
                            title: row['Title of Course'] || row.Title || '',
                            grade: row.Grade,
                            credits: parseFloat(row.Credits) || 0,
                            ects: parseFloat(row['ECTS Credits']) || parseFloat(row.ECTS) || 0,
                            gradePoints: parseFloat(row['Gr.Pts']) || 0,
                            semester: row.Semester || '',
                            passed: this.isPassingGrade(row.Grade)
                        });
                    }
                }
            } else if (ext === '.pdf') {
                // Parse PDF transcript
                const dataBuffer = await fs.readFile(filePath);
                const pdfData = await pdf(dataBuffer);
                const content = pdfData.text;
                
                console.log('Transcript content preview:', content.substring(0, 500));
                
                const lines = content.split('\n');
                
                for (const line of lines) {
                    // Extract student info with more patterns
                    const studentPatterns = [
                        { pattern: /Student No[:\s]+(\d+)/, key: 'studentNo' },
                        { pattern: /Name[:\s]+(.+)/, key: 'name' },
                        { pattern: /Department[:\s-]+Program[:\s]+(.+)/, key: 'program' },
                        { pattern: /Program[:\s]+(.+)/, key: 'program' }
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
                        /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+([A-F][+-]?|W|P|F\*?)\s+(\d+)/
                    ];

                    for (const pattern of coursePatterns) {
                        const courseMatch = line.match(pattern);
                        if (courseMatch) {
                            let courseData;
                            
                            if (pattern === coursePatterns[0]) {
                                const [, code, title, ects, grade, credits, gradePoints] = courseMatch;
                                courseData = {
                                    code: code.trim(),
                                    title: title.trim(),
                                    grade: grade.trim(),
                                    credits: parseFloat(credits),
                                    ects: parseFloat(ects),
                                    gradePoints: parseFloat(gradePoints),
                                    passed: this.isPassingGrade(grade.trim())
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
                                    passed: this.isPassingGrade(grade.trim())
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
                                    passed: this.isPassingGrade(grade.trim())
                                };
                            }
                            
                            completedCourses.set(courseData.code, courseData);
                            console.log(`Parsed completed course: ${courseData.code} - ${courseData.grade}`);
                            break;
                        }
                    }
                }
            }

            this.completedCourses = completedCourses;
            this.studentInfo = studentInfo;
            console.log(`Parsed ${completedCourses.size} completed courses from transcript`);
            return { completedCourses, studentInfo };
        } catch (error) {
            console.error('Error parsing transcript:', error);
            throw error;
        }
    }

    // Parse available courses (Word/Text)
    async parseAvailableCourses(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            let content = '';

            if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                content = result.value;
            } else {
                content = await fs.readFile(filePath, 'utf8');
            }

            console.log('Available courses content preview:', content.substring(0, 500));

            const availableCourses = [];
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                // Match course code and title pattern with more flexibility
                const coursePatterns = [
                    /([A-Z]{2,4}\d{3,4})\s+(.+)/,
                    /([A-Z]{2,4}\s+\d{3,4})\s+(.+)/ // Handle space in course code
                ];

                for (const pattern of coursePatterns) {
                    const courseMatch = trimmedLine.match(pattern);
                    if (courseMatch) {
                        const [, code, title] = courseMatch;
                        availableCourses.push({
                            code: code.trim().replace(/\s+/g, ''), // Remove spaces from code
                            title: title.trim()
                        });
                        console.log(`Parsed available course: ${code.trim()} - ${title.trim()}`);
                        break;
                    }
                }
            }

            this.availableCourses = availableCourses;
            console.log(`Parsed ${availableCourses.length} available courses`);
            return availableCourses;
        } catch (error) {
            console.error('Error parsing available courses:', error);
            throw error;
        }
    }

    // Check if grade is passing
    isPassingGrade(grade) {
        const failingGrades = ['F', 'F*', 'FF', 'FD', 'W'];
        const retakeIndicators = ['(rst)'];
        
        if (failingGrades.includes(grade)) return false;
        if (retakeIndicators.some(indicator => grade.includes(indicator))) return false;
        
        return true;
    }

    // Check if prerequisites are met
    arePrerequisitesMet(course) {
        if (!course.prerequisites || course.prerequisites.length === 0) {
            return true;
        }

        return course.prerequisites.every(prereq => {
            const completedCourse = this.completedCourses.get(prereq);
            return completedCourse && completedCourse.passed;
        });
    }

    // Get student's current semester based on completed credits
    getCurrentSemester() {
        const totalCredits = Array.from(this.completedCourses.values())
            .filter(course => course.passed)
            .reduce((sum, course) => sum + course.credits, 0);

        // Estimate semester based on credits (assuming ~20 credits per semester)
        return Math.floor(totalCredits / 20) + 1;
    }

    // Get recommended courses
    getRecommendedCourses() {
        const currentSemester = this.getCurrentSemester();
        const recommendations = {
            nextSemesterCourses: [],
            availableElectives: [],
            missedCourses: [],
            futureRecommendations: []
        };

        // Get completed course codes
        const completedCourseCodes = new Set(
            Array.from(this.completedCourses.keys())
                .filter(code => this.completedCourses.get(code).passed)
        );

        // Find courses student can take
        for (const course of this.curriculum) {
            // Skip if already completed
            if (completedCourseCodes.has(course.code)) continue;

            // Check if course is available this semester
            const isAvailable = this.availableCourses.some(avail => avail.code === course.code);
            if (!isAvailable) continue;

            // Check prerequisites
            const canTake = this.arePrerequisitesMet(course);

            if (canTake) {
                if (course.semester === currentSemester || course.semester === currentSemester + 1) {
                    recommendations.nextSemesterCourses.push({
                        ...course,
                        priority: this.calculatePriority(course, currentSemester),
                        reason: this.getRecommendationReason(course, currentSemester)
                    });
                } else if (course.category === 'AE' || course.category === 'FE' || course.category === 'UE') {
                    recommendations.availableElectives.push(course);
                } else if (course.semester < currentSemester) {
                    recommendations.missedCourses.push(course);
                } else {
                    recommendations.futureRecommendations.push(course);
                }
            }
        }

        // Sort by priority
        recommendations.nextSemesterCourses.sort((a, b) => b.priority - a.priority);

        return recommendations;
    }

    // Calculate course priority
    calculatePriority(course, currentSemester) {
        let priority = 0;

        // Higher priority for core courses
        if (course.category === 'AC') priority += 10; // Area Core
        if (course.category === 'FC') priority += 8;  // Faculty Core
        if (course.category === 'UC') priority += 6;  // University Core

        // Higher priority for courses in expected semester
        if (course.semester === currentSemester) priority += 5;
        if (course.semester === currentSemester + 1) priority += 3;

        // Lower priority for delayed courses
        if (course.semester < currentSemester) priority -= 2;

        // Higher priority for prerequisite courses (courses that unlock others)
        const unlocks = this.curriculum.filter(c => 
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

        if (course.category === 'AC') reasons.push("Area Core requirement");
        if (course.category === 'FC') reasons.push("Faculty Core requirement");

        // Check if it's a prerequisite for other courses
        const unlocks = this.curriculum.filter(c => 
            c.prerequisites.includes(course.code)
        );
        if (unlocks.length > 0) {
            reasons.push(`Prerequisite for ${unlocks.length} other courses`);
        }

        return reasons.join(", ");
    }

    // Generate student progress report
    generateProgressReport() {
        const completedCourses = Array.from(this.completedCourses.values())
            .filter(course => course.passed);
        
        const totalECTS = completedCourses.reduce((sum, course) => sum + course.ects, 0);
        const totalCredits = completedCourses.reduce((sum, course) => sum + course.credits, 0);
        const currentSemester = this.getCurrentSemester();

        // Calculate category completion
        const categoryStats = {};
        for (const course of this.curriculum) {
            if (!categoryStats[course.category]) {
                categoryStats[course.category] = { required: 0, completed: 0 };
            }
            categoryStats[course.category].required++;
            
            if (this.completedCourses.has(course.code) && 
                this.completedCourses.get(course.code).passed) {
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
            completionPercentage: Math.round((completedCourses.length / this.curriculum.length) * 100)
        };
    }

    // Main method to process all documents and generate recommendations
    async processDocuments(curriculumPath, transcriptPath, availableCoursesPath) {
        try {
            console.log('Processing documents...');
            
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
                message: 'Documents processed successfully'
            };
        } catch (error) {
            console.error('Error processing documents:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Express.js server setup
const express = require('express');
const multer = require('multer');
const app = express();
const port = 3001;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir);
}

// Create public directory if it doesn't exist
const publicDir = './public';
if (!require('fs').existsSync(publicDir)) {
    require('fs').mkdirSync(publicDir);
}

// API endpoint for course recommendation
app.post('/api/recommend-courses', upload.fields([
    { name: 'curriculum', maxCount: 1 },
    { name: 'transcript', maxCount: 1 },
    { name: 'availableCourses', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('Received files:', req.files);
        const files = req.files;
        
        if (!files || !files.curriculum || !files.transcript || !files.availableCourses) {
            return res.status(400).json({
                success: false,
                message: 'Please upload all three required files: curriculum, transcript, and available courses'
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
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Course Advisor System running at http://localhost:${port}`);
    console.log('Upload your curriculum, transcript, and available courses files to get recommendations');
});

module.exports = CourseAdvisorSystem;