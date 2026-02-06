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

