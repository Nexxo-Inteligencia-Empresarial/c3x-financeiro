# setup-task.ps1 — Configura o Windows Task Scheduler para rodar o scraper todo dia
# Execute UMA VEZ como Administrador no PowerShell
# Depois gerencie pela Task Scheduler (taskschd.msc)

param(
  [string]$Hora = "07:00"   # Horário de BRT (ajuste se precisar)
)

$taskName  = "C3X Financeiro - Scraper Diario"
$scriptDir = $PSScriptRoot
$batFile   = Join-Path $scriptDir "run-scrape.bat"
$logFile   = Join-Path $scriptDir "scrape.log"

if (-not (Test-Path $batFile)) {
  Write-Error "Arquivo não encontrado: $batFile"
  exit 1
}

# Remove tarefa anterior se existir
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Ação: executar o .bat e salvar log
$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"$batFile`" >> `"$logFile`" 2>&1"

# Trigger: todo dia no horário configurado
$trigger = New-ScheduledTaskTrigger -Daily -At $Hora

# Configurações
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -RunOnlyIfNetworkAvailable `
  -StartWhenAvailable `
  -WakeToRun:$false

# Registra como o usuário atual (não precisa de senha se for conta local)
Register-ScheduledTask `
  -TaskName    $taskName `
  -Action      $action `
  -Trigger     $trigger `
  -Settings    $settings `
  -Description "Renova token Nibo + atualiza dashboard C3X Financeiro" `
  -RunLevel    Limited `
  -Force | Out-Null

Write-Host ""
Write-Host "Tarefa criada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "  Nome   : $taskName"
Write-Host "  Horario: Todo dia as $Hora (BRT)"
Write-Host "  Log    : $logFile"
Write-Host ""
Write-Host "Para testar agora:"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para verificar o resultado:"
Write-Host "  Get-Content '$logFile' -Tail 30" -ForegroundColor Cyan
Write-Host ""
