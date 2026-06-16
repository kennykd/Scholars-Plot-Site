# Final Project – Web Application Development and Security

Course Code: COMP6703001<br>
Course Name: Web Application Development and Security<br>
Institution: BINUS University International<br>

## 1. Project Information

Project Title: Scholar's Plan Site<br>
Project Domain: Study Planner & Productivity Tracker

Class:
[Class Code] – L4BC

Group Members (Max 3 – same class only):
| Name | Student ID | Role | GitHub Username |
| :--- | :--- | :--- | :--- |
| Barri Nur Pratama | 2802501142 | | |
| Kenny Krixiadi | 2802529191 | | |
| Rafie Mustika Ramasna | 2802522815 | | |

---

## 2. Instructor & Repository Access
This repository must be shared with:
* **Instructor:** Ida Bagus Kerthyayana Manuaba 
  * Email: imanuaba@binus.edu 
  * GitHub: bagzcode
* **Instructor Assistant:** Juwono 
  * Email: juwono@binus.edu
  * GitHub: Juwono136
 
---

## 3. Project Overview

### 3.1 Problem Statement
Explain:
* What problem does this application solve?
* Who are the target users?

### 3.2 Solution Overview
Briefly describe:
* Main features
* Why this solution is appropriate
* Where AI is used

---

## 4. Tech Stack

Frontend : Next.js<br>
Backend : Node.js or Next.js<br>
API REST : API<br>
Database : PostgreSQL / Firebase (for auth only)<br>
Containerization: Docker<br>
Deployment : University Server<br>
Version Control : GitHub<br>

---

## 5. System Architecture

### 5.1 Architecture Diagram

![alt text](/img/Architecture_d.png)

### 5.2 Architecture Explanation

The features of the web app are still in one codebase and uses postgreSQL with PRISMA for backend database handling, hence it makes our website's architecture type: Monolithic.
We are however using external services for our authentication with Firebase auth and we're using an external API for AI features.

---

## 6. API Design (MANDATORY)

### 6.1 API Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | | | Yes / No |
| POST | | | Yes / No |
| PUT | | | Yes / No |
| DELETE | | | Yes / No |

### 6.2 API Documentation
* Swagger / Postman link 
* Example request & response (JSON)

---

## 7. Database Design

### 7.1 Database Choice
Explain why you chose:
PostgreSQL. We choose this database because it is open source, and a versatile relational database. PostgreSQL is also widely used in many industries as a standard, this would help in us as students to get used to what type of programs are running the tech industry.

### 7.2 Schema / Data Structure
Insert ERD or data structure diagram.

---

## 8. AI Features (MANDATORY)

### 8.1 AI Feature List
Describe at least TWO AI features.
| AI Feature | Purpose | AI Type (NLP / OCR / Rec) |
| :--- | :--- | :--- |
| | | |
| | | |

### 8.2 AI Integration Flow
Explain:
* Input → AI processing → Output
* How AI results are used in the system

---

## 9. Security Implementation (MANDATORY)
Describe how your project handles:
* Authentication (JWT / session)
* Authorization (roles)
* Input validation
* Protection against: SQL/NoSQL Injection, XSS, and CSRF
* Secure API key handling

---

## 10. Testing Documentation (VERY IMPORTANT)

### 10.1 Frontend Testing
| Test Case | Scenario | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| FE-01 | | | Pass / Fail |

### 10.2 Backend & API Testing
| Test Case | Endpoint | Input | Expected Output | Status |
| :--- | :--- | :--- | :--- | :--- |
| API-01 | | | | Pass / Fail |

### 10.3 Security Testing
| Test Case | Attack Type | Expected Behavior | Result |
| :--- | :--- | :--- | :--- |
| SEC-01 | XSS | Input sanitized | Pass / Fail |
| SEC-02 | Injection | Query blocked | Pass / Fail |

### 10.4 AI Functionality Testing (MANDATORY)
**AI Feature: [Name]**
| Test Case | Input | Expected Output | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| AI-01 | Valid input | Correct response | | Pass |
| AI-02 | Invalid input | Error / fallback | | Pass |
| AI-03 | Prompt injection | Sanitized | | Pass |

**Failure Handling:**
* What happens if AI is unavailable?
* How is timeout handled?

---

## 11. Deployment & Production Setup

### 11.1 Docker Setup
* Dockerfile included 
* docker-compose.yml included

### 11.2 Production Environment
* Environment variables:<br>
The application utilizes environment variables to protect secrets such as API keys, database url, and sensitive credentials. We separated the development environment with the production, creating a .env and a .env.production files.
* Secrets handling:<br>
To handle all the secret variables, we implement .gitignore to make sure that any .env* files are not pushed into the internet. We also placed our variables inside github secrets in order to enable github to get the variables it needs to run the cicd (auto deployment).
* HTTPS configuration:<br>
The live deployed web application is served on an HTTPS server. The SSL certificates of this server are managed by cloudflare.

### 11.3 Live Application URL
https://e2526-wads-b4bc-05.csbihub.id

---

## 12. GitHub Contribution Summary (INDIVIDUAL)
### Student Name: Barri Nur Pratama
Features implemented:<br>
Study session, timer, notification, analytics

API endpoints handled:<br>
- /api/study
- /api/study/[id]
- /api/users
- /api/users/me
- /api/web-push/send
- /api/web-push/subscribe
- /api/web-push/unsubscribe
- /api/auth/firebase
- /api/auth/logout
  
Tests written:<br>
- /app/analytics
- /app/calendar
- /app/settings
- /app/study
- /app/study/quicktimer
- /app/study/[id]

Security work:<br>
- Authentication and Authorization (session management & timeout control)
- Encryption of analytcs data
- Protection of notification endpoints

AI-related work:<br>
- Chatbot frontend UI

### Student Name: Kenny Krixiadi
* Features implemented:<br>
* API endpoints handled:<br>
* Tests written:<br>
* Security work:<br>
* AI-related work:<br>

### Student Name: Rafie Mustika Ramasna
* Features implemented:<br>
* API endpoints handled:<br>
* Tests written:<br>
* Security work:<br>
* AI-related work:<br>

---

## 13. AI Usage Disclosure (MANDATORY)
List:
AI tools used: Gemini, Claude, ChatGPT<br>
Purpose of usage:<br>
The purpose of using AI in our project is to accelerate the development cycle, making use of AI in repetitive structural tasks that would normally take hours to finish, but with the help of AI it could be way faster. AI is handling the scaffholding of our application, while we as the developers are solving the high-level business logic while making sure the quality and security of our application is meeting the standards.

Which parts were assisted:
 - Boilerplate UI design
 - Visualization of frontend code using claude
 - Give the basic structure of API design
 - Assisting in creation of zod schemas
 - Giving suggestions on the tests in jest testing
 - Mapping out the swagger UI

---

## 14. Known Limitations & Future Improvements
* Current limitations:<br>

* Possible future enhancements:<br>

* AI limitations and risks:<br>


---

## 15. Final Declaration
We declare that:
* This project is our own work
* AI usage is disclosed honestly
* All group members understand the system

**Signed by Group Members:**
* Barri Nur Pratama
* Kenny Krixiadi
* Rafie Mustika Ramasna

## 16. SETUP

## 17. DEPLOYMENT INSTRUCTIONS
(Instructions on how to deploy the project)
