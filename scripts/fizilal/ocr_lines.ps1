param([string]$ListFile,[string]$OutFile)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime]
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'})[0]
function Await($op,$t){$task=$asTask.MakeGenericMethod($t).Invoke($null,@($op));$task.Wait()|Out-Null;$task.Result}
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$sb=New-Object System.Text.StringBuilder
foreach($path in Get-Content $ListFile){
 $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
 $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
 $dec=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $bmp=Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $res=Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
 $name=[System.IO.Path]::GetFileNameWithoutExtension($path)
 foreach($l in $res.Lines){ $y=($l.Words|%{$_.BoundingRect.Y}|Measure-Object -Minimum).Minimum; [void]$sb.AppendLine("$name`t$([int]$y)`t$($l.Text)") }
 $stream.Dispose()
}
[System.IO.File]::WriteAllText($OutFile,$sb.ToString(),[System.Text.Encoding]::UTF8)
