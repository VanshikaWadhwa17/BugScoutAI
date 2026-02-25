# PowerShell script to test ingestion API
# Usage: .\test-ingest.ps1 -ApiKey "your-api-key-here"

param(
    [string]$ApiKey = "test-api-key-abc123",
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "🧪 Testing Ingestion API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Simple click event
Write-Host "Test 1: Single click event" -ForegroundColor Yellow
$body = @{
    session_id = "test_session_1"
    events = @(
        @{
            type = "click"
            timestamp = 1730000000000
            meta = @{
                selector = "#button"
            }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/ingest" `
        -Method Post `
        -Headers @{
            "X-API-Key" = $ApiKey
            "Content-Type" = "application/json"
        } `
        -Body $body
    
    Write-Host "✅ Success!" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Rage click detection (4 clicks in < 2 seconds)
Write-Host "Test 2: Rage click detection (4 clicks on same element)" -ForegroundColor Yellow
$body2 = @{
    session_id = "test_session_2"
    events = @(
        @{ type = "click"; timestamp = 1730000000000; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000000500; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000001000; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000001500; meta = @{ selector = "#pricing" } }
    )
} | ConvertTo-Json -Depth 10

try {
    $response2 = Invoke-RestMethod -Uri "$BaseUrl/ingest" `
        -Method Post `
        -Headers @{
            "X-API-Key" = $ApiKey
            "Content-Type" = "application/json"
        } `
        -Body $body2
    
    Write-Host "✅ Success! This should trigger rage click detection" -ForegroundColor Green
    $response2 | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Tests complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now check the dashboard:" -ForegroundColor Cyan
Write-Host "  GET $BaseUrl/dashboard/sessions -H 'X-Auth-Token: YOUR_AUTH_TOKEN'" -ForegroundColor Gray
Write-Host "  GET $BaseUrl/dashboard/issues -H 'X-Auth-Token: YOUR_AUTH_TOKEN'" -ForegroundColor Gray
