param(
  [string]$target = 'env_a',
  [int]$users = 10,
  [int]$duration = 120
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$jmx = Join-Path $scriptDir 'todo-load-test.jmx'
$resultsDir = Join-Path $scriptDir 'results'
if(-not (Test-Path $resultsDir)) { New-Item -ItemType Directory -Path $resultsDir | Out-Null }

if($target -eq 'env_a'){
  $base = 'http://localhost:8080'
} else {
  $base = 'http://localhost:8081'
}

$args = @(
  '-n',
  '-t', $jmx,
  '-l', "$resultsDir\results_${target}_u${users}.csv",
  "-JBASE_URL=$base",
  "-Jusers=$users",
  "-Jduration=$duration"
)
Write-Output "Running: jmeter $($args -join ' ')"
Start-Process -FilePath 'jmeter' -ArgumentList $args -NoNewWindow -Wait
