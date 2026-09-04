param(
  [string]$ReleaseId = '20260904-RC1',
  [string]$OutputParent = '',
  [string]$PluginRoot = 'C:\Users\lona\Documents\小红书\SketchUp铝型材拆分工具',
  [string]$FixtureRoot = 'G:\2026年倩倩工作文件夹'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputParent) {
  $OutputParent = Split-Path -Parent $repoRoot
}
$packageName = "萌开了官网升级交付包-$ReleaseId"
$packageRoot = Join-Path $OutputParent $packageName
$packageZip = Join-Path $OutputParent "$packageName.zip"
if (Test-Path -LiteralPath $packageRoot) {
  throw "交付目录已经存在，为避免覆盖请更换 ReleaseId：$packageRoot"
}
if (Test-Path -LiteralPath $packageZip) {
  throw "交付压缩包已经存在，为避免覆盖请更换 ReleaseId：$packageZip"
}

$directories = @(
  '00-先看交付说明',
  '01-网站源码',
  '02-网站编译包',
  '03-SketchUp插件',
  '04-浏览器桥',
  '05-测试样例'
)
New-Item -ItemType Directory -Path $packageRoot | Out-Null
foreach ($directory in $directories) {
  New-Item -ItemType Directory -Path (Join-Path $packageRoot $directory) | Out-Null
}

$temporaryRoot = Join-Path $env:TEMP ("alufactory-handoff-" + [guid]::NewGuid().ToString('N'))
$resolvedTempRoot = [IO.Path]::GetFullPath($temporaryRoot)
$resolvedSystemTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
if (-not $resolvedTempRoot.StartsWith($resolvedSystemTemp, [StringComparison]::OrdinalIgnoreCase)) {
  throw "临时目录不在系统临时目录内，已停止：$resolvedTempRoot"
}
New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

function Copy-FilteredTree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $excludedDirectories = @(
    'node_modules', 'dist', 'dist-ssr', '.verify-dist', '.verify-source-dist',
    '.verification', '.git', '.idea', '.vscode', '__pycache__', '.pytest_cache',
    'instance', '.venv', '.venv-local'
  )
  $excludedExtensions = @('.db', '.sqlite', '.sqlite3', '.pyc', '.pyo', '.pem', '.key', '.zip', '.rbz')

  Get-ChildItem -LiteralPath $Source -Recurse -File | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($Source, $_.FullName)
    $segments = $relative -split '[\\/]'
    if ($segments | Where-Object { $excludedDirectories -contains $_ }) { return }
    if ($excludedExtensions -contains $_.Extension.ToLowerInvariant()) { return }
    if ($_.Name -like '.env*' -and $_.Name -ne '.env.example') { return }
    if ($_.Name -match '^payment_credentials(\.local|_local)?\.py$') { return }
    if ($_.Name -match '(?i)private[_-]?key') { return }

    $target = Join-Path $Destination $relative
    $targetDirectory = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $targetDirectory)) {
      New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $_.FullName -Destination $target
  }
}

try {
  $handoffDocs = Join-Path $repoRoot 'docs\handoff'
  Copy-Item -LiteralPath (Join-Path $handoffDocs '官网升级交付说明.md') -Destination (Join-Path $packageRoot '00-先看交付说明\01-官网升级交付说明.md')
  Copy-Item -LiteralPath (Join-Path $handoffDocs '官网升级验收清单.md') -Destination (Join-Path $packageRoot '00-先看交付说明\02-官网升级验收清单.md')
  Copy-Item -LiteralPath (Join-Path $handoffDocs '本地候选版测试报告.md') -Destination (Join-Path $packageRoot '00-先看交付说明\03-本地候选版测试报告.md')

  $sourceStage = Join-Path $temporaryRoot 'alufactory-mengkaile'
  New-Item -ItemType Directory -Path $sourceStage | Out-Null
  Copy-FilteredTree -Source $repoRoot -Destination $sourceStage
  Compress-Archive -LiteralPath $sourceStage -DestinationPath (Join-Path $packageRoot '01-网站源码\alufactory-mengkaile-source.zip') -CompressionLevel Optimal

  $distDirectory = Join-Path $repoRoot 'dist'
  if (-not (Test-Path -LiteralPath (Join-Path $distDirectory 'index.html'))) {
    throw '缺少前端正式构建结果，请先执行 npm run build。'
  }
  Compress-Archive -Path (Join-Path $distDirectory '*') -DestinationPath (Join-Path $packageRoot '02-网站编译包\mengkaile-web-dist.zip') -CompressionLevel Optimal

  $pluginRbz = Join-Path $PluginRoot '铝型材DIY设计与拆分工具-v2.43.1.rbz'
  $pluginReadme = Join-Path $PluginRoot 'README.md'
  Copy-Item -LiteralPath $pluginRbz -Destination (Join-Path $packageRoot '03-SketchUp插件')
  Copy-Item -LiteralPath $pluginReadme -Destination (Join-Path $packageRoot '03-SketchUp插件\插件说明.md')
  Copy-Item -LiteralPath (Join-Path $repoRoot 'tools\sketchup\mengkaile-json-exporter.rbz') -Destination (Join-Path $packageRoot '03-SketchUp插件\轻量JSON导出器-v1.1.rbz')

  $pluginSourceStage = Join-Path $temporaryRoot 'SketchUp插件源码-v2.43.1'
  New-Item -ItemType Directory -Path $pluginSourceStage | Out-Null
  Copy-Item -LiteralPath (Join-Path $PluginRoot 'source\aluminum_profile_splitter.rb') -Destination $pluginSourceStage
  Copy-Item -LiteralPath (Join-Path $PluginRoot 'source\aluminum_profile_splitter') -Destination $pluginSourceStage -Recurse
  Compress-Archive -LiteralPath $pluginSourceStage -DestinationPath (Join-Path $packageRoot '03-SketchUp插件\SketchUp插件源码-v2.43.1.zip') -CompressionLevel Optimal

  $bridgeSource = Join-Path $PluginRoot 'source\aluminum_profile_splitter\browser_bridge'
  Copy-Item -LiteralPath (Join-Path $bridgeSource 'README-安装.txt') -Destination (Join-Path $packageRoot '04-浏览器桥')
  Copy-Item -LiteralPath (Join-Path $bridgeSource 'aps-mengkaile-bridge') -Destination (Join-Path $packageRoot '04-浏览器桥') -Recurse
  Compress-Archive -LiteralPath (Join-Path $bridgeSource 'aps-mengkaile-bridge') -DestinationPath (Join-Path $packageRoot '04-浏览器桥\aps-mengkaile-bridge.zip') -CompressionLevel Optimal

  Copy-Item -LiteralPath (Join-Path $handoffDocs 'examples\插件来源凭证示例.json') -Destination (Join-Path $packageRoot '05-测试样例')
  $fixtureFiles = @(
    (Join-Path $FixtureRoot '型材模块展架\叶总展示柜2026.9.1.3.0.skp'),
    (Join-Path $FixtureRoot '型材模块展架\叶总展示柜9.0.json'),
    (Join-Path $FixtureRoot '转换测试\转换测试专用模型.skp'),
    (Join-Path $FixtureRoot '转换测试\展示柜\20240116文定生活抽屉柜(730).pdf'),
    (Join-Path $repoRoot 'verification-display-rack-product.png'),
    (Join-Path $repoRoot 'verification-display-rack-designer.png')
  )
  foreach ($fixtureFile in $fixtureFiles) {
    if (Test-Path -LiteralPath $fixtureFile) {
      Copy-Item -LiteralPath $fixtureFile -Destination (Join-Path $packageRoot '05-测试样例')
    }
  }

  $manifest = [ordered]@{
    packageName = $packageName
    releaseId = $ReleaseId
    createdAt = (Get-Date).ToString('o')
    productionTouched = $false
    databaseMigrationRequiredForProvenance = $false
    webContract = 'mengkaile-diy/schemaVersion:2'
    provenanceContract = 'provenance/schemaVersion:1'
    sketchUpPlugin = '2.43.1'
    lightweightExporter = '1.1'
    sourceRepository = 'https://github.com/yeyixin1993/alufactory-mengkaile'
    securityExclusions = @('.env*', 'database files', 'payment credentials', 'private keys', 'local accounts', 'dependencies', 'test caches')
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $packageRoot '00-先看交付说明\RELEASE-MANIFEST.json') -Encoding utf8

  $checksumPath = Join-Path $packageRoot '00-先看交付说明\SHA256SUMS.txt'
  $checksums = Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
    Where-Object { $_.FullName -ne $checksumPath } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = [IO.Path]::GetRelativePath($packageRoot, $_.FullName).Replace('\', '/')
      $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      "$hash  $relative"
    }
  $checksums | Set-Content -LiteralPath $checksumPath -Encoding utf8

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $packageZip -CompressionLevel Optimal
  Write-Output "PACKAGE_ROOT=$packageRoot"
  Write-Output "PACKAGE_ZIP=$packageZip"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    $verifiedTempRoot = [IO.Path]::GetFullPath($temporaryRoot)
    if ($verifiedTempRoot.StartsWith($resolvedSystemTemp, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $verifiedTempRoot -Recurse -Force
    }
  }
}
