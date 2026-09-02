param(
  [Parameter(Mandatory = $true)]
  [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'

$keyDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$keyPath = Join-Path $keyDirectory 'labu-loom.key'
$publicKeyPath = "$keyPath.pub"
$passwordBackupPath = Join-Path $keyDirectory 'labu-loom.password.dpapi'

if (Test-Path -LiteralPath $keyDirectory) {
  throw "Refusing to use an existing key directory: $keyDirectory"
}

[System.IO.Directory]::CreateDirectory($keyDirectory) | Out-Null

$passwordBytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$password = [Convert]::ToBase64String($passwordBytes)
$securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
$protectedPassword = ConvertFrom-SecureString -SecureString $securePassword
[System.IO.File]::WriteAllText(
  $passwordBackupPath,
  $protectedPassword,
  [System.Text.UTF8Encoding]::new($false)
)

try {
  & corepack pnpm tauri signer generate --ci --password $password --write-keys $keyPath *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri signer exited with code $LASTEXITCODE"
  }

  if (-not (Test-Path -LiteralPath $keyPath) -or -not (Test-Path -LiteralPath $publicKeyPath)) {
    throw 'Tauri signer did not create both private and public key files.'
  }

  [pscustomobject]@{
    KeyDirectory = $keyDirectory
    PrivateKey = $keyPath
    PublicKey = $publicKeyPath
    PasswordBackup = $passwordBackupPath
  } | Format-List
}
catch {
  if (Test-Path -LiteralPath $keyDirectory) {
    Remove-Item -LiteralPath $keyDirectory -Recurse -Force
  }
  throw
}
finally {
  [System.Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
  $password = $null
  $securePassword.Dispose()
}
