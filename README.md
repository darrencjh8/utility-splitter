# Utility Splitter

A web application for tracking and splitting monthly utility bills among housemates. Built with React, TypeScript, Vite, and Node.js.

# Known issues

- API call to backend is not working
- Password should be stored in session that expires, not local storage

# Future Improvements

- TenantID should be changed to email which can be extracted by Parseur
- Implement automation workflow using Parseur and Google Sheet
- Input field for a google oauth2 in the frontend, to pull data from google sheet
- Extract data from this sheet to display in the frontend
- PUT API has to manage conflict management between user input data or data input by automation workflow
- Protect API with basic auth


## Prerequisites

-   [Node.js](https://nodejs.org/) (v18+)
-   [Docker](https://www.docker.com/)
-   [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)

## Configuration

Create a `.env` file in the root directory. **Do not commit this file.**

```env
# Backend Credentials (for API access)
API_USER=admin
API_PASS=your_secure_password

# Frontend Build Args (must match backend credentials)
VITE_API_USER=admin
VITE_API_PASS=your_secure_password
```

## Local Development

To run the application locally with hot-reloading:

1.  **Install Dependencies**:
    ```bash
    npm install
    cd server && npm install && cd ..
    ```

2.  **Start the Backend**:
    ```bash
    # In a new terminal
    cd server
    # Ensure you have set API_USER and API_PASS environment variables
    # Linux/Mac: export API_USER=admin API_PASS=pass node index.js
    # Windows (PowerShell): $env:API_USER="admin"; $env:API_PASS="pass"; node index.js
    node index.js
    ```

3.  **Start the Frontend**:
    ```bash
    # In a separate terminal
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

## Build & Run Locally (Docker)

To verify the production build locally using Docker:

1.  **Build the Image**:
    ```bash
    docker build -t utility-splitter:local \
      --build-arg VITE_API_USER=admin \
      --build-arg VITE_API_PASS=your_secure_password \
      -f Dockerfile.fly .
    ```

2.  **Run the Container**:
    ```bash
    docker run -p 3000:3000 \
      -e API_USER=admin \
      -e API_PASS=your_secure_password \
      utility-splitter:local
    ```
    Access the app at `http://localhost:3000`.

## Deployment

We use a single-container deployment strategy on Fly.io, pulling the image from Docker Hub.

### 1. Build and Push to Docker Hub

Replace `your-username` with your Docker Hub username.

#### Option 1: run deploy.ps1

```bash
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

#### Option 2: run commands manually

```bash
# Build the image
docker build -t your-username/utility-splitter:latest \
  --build-arg VITE_API_USER=admin \
  --build-arg VITE_API_PASS=your_secure_password \
  -f Dockerfile.fly .

# Push to Docker Hub
docker push your-username/utility-splitter:latest
```

### 2. Deploy to Fly.io

1.  **Create the App** (first time only):
    ```bash
    fly apps create utility-splitter
    ```

2.  **Set Secrets** (Backend):
    ```bash
    fly secrets set API_USER=admin API_PASS=your_secure_password
    ```

3.  **Create Volume** (for persistent data):
    ```bash
    fly volumes create utility_data --region sin --size 1
    ```

4.  **Deploy**:
    ```bash
    fly deploy --image your-username/utility-splitter:latest
    ```
