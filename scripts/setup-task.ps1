# setup-task.ps1
# Configura o Windows Task Scheduler para rodar o scraper todo dia às 07:00 BRT
# Execute UMA VEZ como Administrador no PowerShell
#
# COMO FUNCIONA:
#   - Roda às 07:00, ANTES do Edge abrir
#   - Script abre Edge com o perfil existente (já logado no Nibo)
#   - Lê o token do localStorage, salva no KV, aciona scraper Vercel
#   - Fecha o Edge automaticamente
#
# SE O EDGE JÁ ESTIVER ABERTO quando a tarefa rodar:
#   - Script falha com aviso e instrui a usar o bookmarklet
#
# PARA ATUALIZAR MANUALMENTE A QUALQUER HORA:
#   - Se Edge fechado: execute run-scrape.bat
#   - Se Edge aberto: clique no favorito "C3X Atualizar" em empresa.nibo.com.br

param(
  [string]$Hora = "07:00"
)

$taskName  = "C3X Financeiro - Scraper Diario"
$scriptDir = $PSScriptRoot
$batFile   = Join-Path $scriptDir "run-scrape.bat"
$logFile   = Join-Path $scriptDir "scrape.log"

if (-not (Test-Path $batFile)) {
  Write-Error "Arquivo não encontrado: $batFile"
  exit 1
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"$batFile`" >> `"$logFile`" 2>&1"

$trigger = New-ScheduledTaskTrigger -Daily -At $Hora

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -RunOnlyIfNetworkAvailable `
  -StartWhenAvailable `
  -WakeToRun:$false

Register-ScheduledTask `
  -TaskName    $taskName `
  -Action      $action `
  -Trigger     $trigger `
  -Settings    $settings `
  -Description "C3X: renova token Nibo (Edge profile) + atualiza dashboard via Vercel" `
  -RunLevel    Limited `
  -Force | Out-Null

Write-Host ""
Write-Host "Tarefa agendada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "  Nome   : $taskName"
Write-Host "  Horario: Todo dia as $Hora (antes do Edge abrir)"
Write-Host "  Log    : $logFile"
Write-Host ""
Write-Host "Para testar agora (feche o Edge primeiro):"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para ver o log:"
Write-Host "  Get-Content '$logFile' -Tail 30" -ForegroundColor Cyan
