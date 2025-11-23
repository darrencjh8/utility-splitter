# Prerequisite 
# powershell -ExecutionPolicy Bypass -File .\deploy.ps1

# Stop execution if any command fails
$ErrorActionPreference = "Stop"

# 1. Execute the docker build command
docker build -t utility-splitter:latest -f Dockerfile .

# 2. Tag and Push
docker tag utility-splitter:latest chongjinheng/utility-splitter:latest
docker push chongjinheng/utility-splitter:latest

# 3. Deploy
fly auth login
fly deploy --image chongjinheng/utility-splitter:latest