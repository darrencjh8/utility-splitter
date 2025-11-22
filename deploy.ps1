# Prerequisite 
# powershell -ExecutionPolicy Bypass -File .\deploy.ps1

# 1. Define the name of your .env file
$envFile = ".env"

# 2. Define the keys you need to extract
$userKey = "VITE_API_USER"
$passKey = "VITE_API_PASS"

# 3. Function to extract a value for a given key from the .env file
function Get-EnvValue {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Key,
        [Parameter(Mandatory=$true)]
        [string]$FilePath
    )
    # Use Select-String (more robust than findstr for this in PowerShell)
    # The pattern matches the key, followed by '=', then captures the value.
    $pattern = "^$Key=(.*)"
    $match = Select-String -Path $FilePath -Pattern $pattern | Select-Object -First 1

    if ($match) {
        # Extract the captured group (the value)
        return $match.Matches.Groups[1].Value.Trim()
    } else {
        # Handle case where the key is not found
        Write-Error "Key '$Key' not found in $FilePath"
        exit 1
    }
}

# 4. Extract the values
$apiUser = Get-EnvValue -Key $userKey -FilePath $envFile
$apiPass = Get-EnvValue -Key $passKey -FilePath $envFile

# 5. Execute the docker build command using the extracted variables
docker build -t utility-splitter:latest `
    --build-arg "$userKey=$apiUser" `
    --build-arg "$passKey=$apiPass" `
    -f Dockerfile.fly .

docker tag utility-splitter:latest chongjinheng/utility-splitter:latest
docker push chongjinheng/utility-splitter:latest
fly auth login
fly deploy --image chongjinheng/utility-splitter:latest