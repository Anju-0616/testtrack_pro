\# TestTrack Pro



A software testing platform built as part of Internship Program 2026.



\## Tech Stack (Planned)

\- Frontend: React + TypeScript

\- Backend: Node.js + Express

\- Database: PostgreSQL



\## Project Duration

4 Weeks

Day 1 – Project Setup & Environment Configuration
Understood the project requirements and overall system architecture
Set up the project as a monorepo
Initialized backend using Node.js and Express
Configured folder structure for scalability
Verified server setup with a health check endpoint (/health)

Day 2 – Database & ORM Setup
Chose PostgreSQL as the database
Integrated Prisma ORM with the backend
Designed the initial database schema for User
Ran migrations and connected Prisma Client
Verified database connectivity using Prisma Studio

Day 3 – User Registration (Authentication – Part 1)
Implemented user registration API
Added password hashing using bcryptjs
Ensured unique user registration using email validation
Stored users securely in PostgreSQL
Modularized routes for better project structure

Day 4 – User Login & JWT Authentication (Authentication – Part 2)
Implemented user login API using Express
Verified user credentials against stored database records
Integrated password verification using bcryptjs
Implemented JWT (JSON Web Token) generation on successful login
Configured token expiration for session management
Loaded environment variables securely using dotenv
Tested login functionality using terminal (PowerShell)
Validated token-based access for protected routes

Day 5 – Advanced Authentication & Session Management
Implemented password reset flow with secure reset tokens
Added refresh token–based session management for persistent login
Implemented session refresh API to issue new JWT access tokens
Added logout API to invalidate sessions securely
Implemented password history enforcement to prevent reuse of recent passwords
Enforced role-based access control for protected routes

During Week 1, the foundation of the TestTrack Pro backend was established. The project was set up as a scalable monorepo, the backend server was initialized with Node.js and Express, and PostgreSQL was integrated using Prisma ORM. Core authentication features including user registration, login, JWT-based authentication, session management with refresh tokens, logout, password reset, role-based authorization, and password history enforcement were successfully implemented, resulting in a secure and production-ready authentication system.

Day 6 – Test Case Creation & Secure API Integration

Designed and implemented the TestCase database model using Prisma
Established relationships between users and test cases
Implemented test case creation API (POST /testcases)
Protected test case routes using JWT authentication middleware
Stored metadata including title, description, priority, status, and creator information
Verified end-to-end flow from frontend form submission to database persistence

Day 7 – Test Case Listing & Filtering

Implemented test case listing API (GET /testcases)
Added filtering capabilities based on priority and status
Sorted results by creation date for better visibility
Ensured soft-deleted records were excluded from results
Integrated frontend test case page to dynamically display data
Implemented loading and empty-state handling for improved UX

Day 8 – Update & Soft Delete Implementation

Implemented test case update API (PUT /testcases/:id)
Added validation to prevent modification of deleted records
Replaced hard delete with soft delete using isDeleted flag
Ensured deleted test cases are excluded from list operations
Maintained data integrity and auditability

Day 9 – Test Execution Tracking & Cloning

Designed and implemented TestExecution model for execution tracking
Implemented execution API (POST /testcases/:id/execute) to record PASS/FAIL results
Linked execution records to both test case and executing user
Implemented execution history API (GET /testcases/:id/executions)
Added test case cloning functionality (POST /testcases/:id/clone)
Ensured cloned test cases inherit relevant metadata while maintaining independent lifecycle

Day 10 – Dashboard Analytics & Reporting

Implemented dashboard summary API (GET /testcases/dashboard/summary)
Calculated total test cases, total executions, PASS count, and FAIL count
Implemented pass rate percentage calculation
Integrated frontend dashboard page to display real-time metrics
Verified secure token-based data retrieval for analytics endpoints

During Week 2, the core functionality of the TestTrack Pro platform was developed. The system evolved from a secure authentication backend into a fully functional test case management and execution tracking platform. Complete CRUD operations were implemented for test cases, including filtering, soft deletion, and cloning. A structured execution tracking mechanism was introduced to record PASS/FAIL outcomes along with execution history. Additionally, a dashboard analytics module was developed to provide real-time visibility into testing performance metrics.By the end of Week 2, TestTrack Pro successfully supported secure test case lifecycle management, execution monitoring, and performance reporting, forming the foundation for advanced defect tracking and reporting modules in subsequent phases.
