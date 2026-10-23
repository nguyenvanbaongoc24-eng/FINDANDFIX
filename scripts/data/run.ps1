param([switch]$Offline, [switch]$SkipVerify)
$arguments = @("scripts/data/pipeline.py")
if ($Offline) { $arguments += "--offline" }
if ($SkipVerify) { $arguments += "--skip-verify" }
& python @arguments
