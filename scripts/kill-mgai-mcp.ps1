# kill-mgai-mcp.ps1
# 终止所有残留的 mgai MCP Server 进程
# 按命令行包含 mcp/run.ts 或 run-mcp.cmd 的 node 进程过滤

$pattern = "mcp[/\\]run\.ts|run-mcp\.cmd"

$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -match $pattern
}

if (-not $procs) {
    Write-Host "No mgai MCP processes found."
    exit 0
}

Write-Host "Found $($procs.Count) mgai MCP process(es):"
foreach ($p in $procs) {
    Write-Host "  PID $($p.ProcessId): $($p.CommandLine)"
}

Write-Host "Terminating..."
foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Done."
