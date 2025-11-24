# Prerequisite 
# powershell -ExecutionPolicy Bypass -File .\deploy.ps1

$ErrorActionPreference = "Stop"

# Helper function to check exit codes to keep code clean
function Check-Error {
    param([string]$Message)
    if ($LASTEXITCODE -ne 0) {
        Write-Error "$Message (Exit Code: $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

# 1. Execute the docker build command
Write-Output "Building Docker Image..."
docker build -t utility-splitter:latest -f Dockerfile .
Check-Error "Docker build failed"

# 2. Tag and Push
Write-Output "Pushing to Registry..."
docker tag utility-splitter:latest chongjinheng/utility-splitter:latest
Check-Error "Docker tag failed"

docker push chongjinheng/utility-splitter:latest
Check-Error "Docker push failed"

# 3. Deploy
Write-Output "Deploying to Fly.io..."
fly deploy --image chongjinheng/utility-splitter:latest --ha=false
Check-Error "Fly deploy failed"

Write-Output "Deployment Successful!"