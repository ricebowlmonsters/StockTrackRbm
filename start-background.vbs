Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Angka 0 di akhir artinya: Jalankan tanpa jendela (Hidden)
WshShell.Run chr(34) & strPath & "\start-server.bat" & chr(34), 0
Set WshShell = Nothing
