# Gera dist\OtimizadorDemanda.zip: o programa + um Python portátil, pronto para
# entregar a quem não programa. Rode de novo sempre que alterar o programa.
#
#   powershell -ExecutionPolicy Bypass -File empacotar.ps1

$ErrorActionPreference = "Stop"
$Projeto = $PSScriptRoot
$VersaoPython = "3.12.10"               # mesma versão do Python usado no desenvolvimento
$Build = Join-Path $env:TEMP "od_build"  # caminho curto: evita o limite de 260 caracteres do Windows
$Pasta = Join-Path $Build "OtimizadorDemanda"
$Zip = Join-Path $Projeto "dist\OtimizadorDemanda.zip"

Write-Host "1/5 Preparando pastas..."
if (Test-Path $Build) { Remove-Item $Build -Recurse -Force }
New-Item -ItemType Directory -Force "$Pasta\python", "$Pasta\app\.streamlit", "$Projeto\dist" | Out-Null

Write-Host "2/5 Baixando Python portatil $VersaoPython (python.org)..."
$Embed = Join-Path $Build "python-embed.zip"
Invoke-WebRequest "https://www.python.org/ftp/python/$VersaoPython/python-$VersaoPython-embed-amd64.zip" -OutFile $Embed -UseBasicParsing
Expand-Archive $Embed "$Pasta\python"
# O Python portátil ignora as bibliotecas instaladas até habilitarmos o "site-packages"
Set-Content "$Pasta\python\python312._pth" "python312.zip`r`n.`r`nLib\site-packages`r`nimport site" -Encoding ascii

Write-Host "3/5 Instalando bibliotecas (streamlit, pandas, plotly...)..."
python -m pip install --quiet --disable-pip-version-check --no-warn-script-location `
    --target "$Pasta\python\Lib\site-packages" -r "$Projeto\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as bibliotecas." }
# Testes internos das bibliotecas não são usados e só deixam o .zip mais lento de extrair
Get-ChildItem "$Pasta\python\Lib\site-packages" -Recurse -Directory -Filter tests |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "4/5 Copiando o programa..."
foreach ($arquivo in "app.py", "calculo.py", "graficos.py", "leitor_pdf.py", "relatorio.py", "iniciar.py") {
    Copy-Item (Join-Path $Projeto $arquivo) "$Pasta\app\"
}
Copy-Item "$Projeto\.streamlit\config.toml" "$Pasta\app\.streamlit\"
Copy-Item "$Projeto\pacote\LEIA-ME.txt" "$Pasta\"
# O .bat precisa de quebras de linha do Windows (CRLF)
$Atalho = "Abrir Otimizador de Demanda.bat"
(Get-Content "$Projeto\pacote\$Atalho") -join "`r`n" | Set-Content "$Pasta\$Atalho" -Encoding ascii

Write-Host "5/5 Compactando..."
if (Test-Path $Zip) { Remove-Item $Zip }
python -c "import shutil, sys; shutil.make_archive(sys.argv[1][:-4], 'zip', sys.argv[2], 'OtimizadorDemanda')" $Zip $Build
if ($LASTEXITCODE -ne 0) { throw "Falha ao compactar." }

$Tamanho = [math]::Round((Get-Item $Zip).Length / 1MB)
Write-Host "`nPronto: $Zip ($Tamanho MB)"
Write-Host "Pasta para testar sem descompactar: $Pasta"
