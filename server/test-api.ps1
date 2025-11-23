$serverProcess = Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory "c:\Users\darren\OneDrive\Documents\project\utilities\server\generated" -PassThru -NoNewWindow
Start-Sleep -Seconds 5

try {
    # Test Tenant PUT
    $tenantBody = @{ name = "Test Tenant" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:8080/tenant?tenantId=test-tenant" -Method Put -Body $tenantBody -ContentType "application/json"
    Write-Host "Tenant PUT Response: $($response | ConvertTo-Json -Depth 10)"

    # Test Tenant GET
    $response = Invoke-RestMethod -Uri "http://localhost:8080/tenant?tenantId=test-tenant" -Method Get
    Write-Host "Tenant GET Response: $($response | ConvertTo-Json -Depth 10)"

    # Test Tenant Data PUT
    $dataBody = @{ encrypted = "some-encrypted-data" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:8080/tenant/data?tenantId=test-tenant&year=2023" -Method Put -Body $dataBody -ContentType "application/json"
    Write-Host "Tenant Data PUT Response: $($response | ConvertTo-Json -Depth 10)"

    # Test Tenant Data GET
    $response = Invoke-RestMethod -Uri "http://localhost:8080/tenant/data?tenantId=test-tenant&year=2023" -Method Get
    Write-Host "Tenant Data GET Response: $($response | ConvertTo-Json -Depth 10)"

} catch {
    Write-Error "Test failed: $_"
} finally {
    Stop-Process -Id $serverProcess.Id -Force
}
