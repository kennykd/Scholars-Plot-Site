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
| Barri Nur Pratama | 2802501142 | developer | Barrizzz |
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
## Registration Process
### (Frontend)
- User fills in the registration form: `display_name`, `email`, `password`, `password confirmation`
- User clicks **Sign Up**
- Firebase SDK calls the function `createUserWithEmailAndPassword()`
- Firebase creates a new user in the Firebase Auth console and returns a JSON web token
- Frontend makes a `POST` request to `api/auth/firebase` (Note: The token is placed in the `Authorization` header as “Bearer <token>”)

### (API)
- The API extracts the JSON web token from the `Authorization` header
- It calls `adminAuth.verifyIdToken()` to ensure that the token is a valid Firebase user
- The API decodes the token and gets the `uid` and `email`

### (Database Layer)
- The API performs an upsert: it creates a new table row using the Firebase `uid` (which becomes the `user_id`), `user_name`, `user_email`, `avatar_url`, and updates the `user_last_login`

### (API)
- The API creates a session cookie to store the Firebase `idToken` to keep the user logged in
- Lastly, it sends a `200 OK` status to the frontend, along with the newly created database user object

### (Frontend)
- Frontend receives the success response
- User is redirected to the dashboard route
- Because the session cookie is set, the function `getSession()` will recognize that the user has already been authenticated

## Login Process

### (Frontend)
- User fills in email and password of an already authenticated account
- User clicks **Sign In**
- Firebase SDK calls the function `signInWithEmailAndPassword()`
- Firebase validates the credentials
- If found, it will return a JSON web token to the client
- Frontend makes a `POST` request to `api/auth/firebase` (Note: The token is placed in the `Authorization` header as “Bearer <token>”)

### (API)
- The API extracts the string after the word “Bearer”
- It calls `adminAuth.verifyIdToken(idToken)`
- The API validates if the token is expired, does not exist, etc.
- The API decodes the token which returns: `uid`, `email`, `profile picture`

### (Database Layer)
- The API looks at the Prisma database to find a matching email with the token
- If it is found: it will update the `user_last_login` data
- If it is not found: it will create a new table row

### (API)
- The API generates a session cookie to save the `idToken`
- API sends a `200 OK` if the whole process is successful, as well as sending some of the user data to be used for the frontend

### (Frontend)
- User page is redirected to dashboard by using `router.push()`

### Authentication:
Our web app handles authentication by keeping it simple and secure with Firebase. When a user logs in or signs up, Firebase handles the heavy lifting of credential validation and hands back a JSON web token. We then pass that token to our API in the `Authorization` header, where we use `adminAuth.verifyIdToken()` to make sure the user is legit. 

From there, we sync with our Prisma database to either update their last login or create a new row. Finally, the API creates a session cookie using Firebase's `createSessionCookie()`, which allows our `getSession()` function to call `verifySessionCookie()` on subsequent requests to keep them securely logged in. It’s a clean loop: authenticate with Firebase, verify at the API, sync with the database, and maintain the session with a secure cookie.

### Authorization
For authorization, we build on our authentication flow to ensure users only access what they are supposed to. Every time a protected route is requested, our API uses `getSession()` to run `verifySessionCookie()`, confirming the user is still valid. Once authenticated, we use the `uid` from that session to fetch the user’s specific roles or permissions from our Prisma database. We then compare those permissions against the requirements for the requested resource; if the user doesn’t have the necessary access, the API blocks the request with a `403 Forbidden` status.

### Input validation
To ensure data integrity and security, our web app uses Zod validation schemas for all incoming requests. This approach guarantees that the input provided by the user is correctly formatted, type-safe, and sanitized before it ever reaches our business logic or database layer. By enforcing these strict schema definitions at the API entry point, we can prevent malicious data from processing, ensuring a reliable and secure user experience.
  
### Protection against: SQL/NoSQL Injection, XSS, and CSRF
#### Security: Injection Protection
To keep our data safe from SQL and NoSQL injection attacks, we rely on **Prisma ORM** as our primary line of defense. By using Prisma’s parameterized queries, we ensure that user input is never executed as code; instead, it is treated strictly as data parameters, which effectively neutralizes injection attempts at the database driver level. Furthermore, our strict **Zod validation schemas** act as a critical gatekeeper, ensuring that any input reaching the database layer is already type-checked, sanitized, and stripped of unexpected characters or structures before it is ever processed.

#### XSS
For XSS, same as protection against SQL/NoSQL injection, we rely on the **Zod validation schemas** in sanitizing incoming data, as well as ensuring that the user requests is never treated as executable code.

#### CSRF
We defend against CSRF by making use of the proxy.ts (middleware). The proxy will check the CORS domain list and blocks any other unauthorized domains which tries to get resources and running malicious scripts.

### Secure API key handling
We kept our secret API keys in environment variables, making sure that it is in the gitignore file, this ensures that our secrets is not pushed to the github repo which lives in the public internet. For cicd deployment process, we added our API keys in github secrets, in order for the automatic github actions to be able to run smoothly and securely.

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
Current limitations:<br>
- Push notifications does not appear when you close the web app
- There is not much things you can change in settings

Possible future enhancements:<br>
- Improve the settings page to add more personalization
- Implement outside app notifications
- Clean up project section

AI limitations and risks:<br>
- Unable to modify or delete tasks/study sessions (create only)

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
Setting up this automated deployment pipeline requires configuring four local configuration files, preparing your remote server, and linking them together via a GitHub Actions self-hosted runner.
<br>
### 1. Required Configuration Files
<br>
First we need to have these files in the github repository:
<br>
* **`.github/workflows/cicd.yml`:** The automated blueprint that coordinates the CI/CD pipeline stages (linting, testing, building, and deploying). It handles the trigger rules and specifies which jobs execute on the GitHub action runners.
* **`Dockerfile`:** A multi-stage Dockerfile that manages our application's environments. It compiles project dependencies, initializes essential build arguments, runs a database migrator step, and defines the lightweight production runtime environment.
* **`docker-compose.yml`:** The configuration file that manages our containers on the target server. It opens network ports (routing traffic to port `3026,` since this is our assigned port), references environment variables, and isolates application runtime layers from database migration states using custom profiles.
* **`.dockerignore`:** Explicitly prevents build overhead and security leaks by ensuring local files like `node_modules`, `.next`, source code test directories, and local `.env` files are not sent to the Docker daemon.
* **`.env.production`:** A file that holds our production secrets (database credentials, Firebase private keys, api endpoints, etc.). This file is **never** committed to Git for security purposes. Instead, it is dynamically generated on the server by the runner during a deployment run.

---

## 17. DEPLOYMENT INSTRUCTIONS
Before the GitHub Actions runner can fully automate your deployments, you must manually log into your production server and prepare the environment. This setup involves prepping the folder structure, verifying system access, and registering the runner application with GitHub.

### SSH Remote Connection
Connect to the secure server using the environment terminal (configured through the Cloudflare Access portal gateway)

### Step 2: Configure & Enable Rootless Docker
#### 1. Initialize rootless Docker setup script
dockerd-rootless-setuptool.sh install

#### 2. Reload and re-execute the user system daemon
systemctl --user daemon-reexec
systemctl --user daemon-reload

#### 3. Enable and start the user-level Docker service
systemctl --user enable --now docker.service

#### 4. Verify Docker engine is running and fully accessible
docker ps

### Step 3: Install & Start the GitHub Actions Self-Hosted Runner
#### 1. Create a dedicated workspace directory and download the runner package
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.324.0.tar.gz -L [https://github.com/actions/runner/releases/download/v2.324.0/actions-runner-linux-x64-2.324.0.tar.gz](https://github.com/actions/runner/releases/download/v2.324.0/actions-runner-linux-x64-2.324.0.tar.gz)

#### 2. Unpack the compressed binaries
tar xzf ./actions-runner-linux-x64-2.324.0.tar.gz

#### 3. Register the runner against your repository using your GitHub configuration token
./config.sh --url [https://github.com/your-username/your-repo](https://github.com/your-username/your-repo) --token YOUR_GITHUB_RUNNER_TOKEN

#### 4. Install and launch the runner to run persistently as a system background service
sudo ./svc.sh install
sudo ./svc.sh start
<br>
Verify that the runner status turns Idle (Green) under your GitHub Repository Settings → Actions → Runners.

### Step 4: Running the runner
Lastly, push the code to `main` or any other branch that is set in the cicd, and the github runner will make a temporary .env.production in the server by looking at the github secrets and it will automatically deploy your latest commit.

