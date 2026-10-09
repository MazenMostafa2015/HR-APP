Unicode True
RequestExecutionLevel admin
Name "ELMS Server Prerequisites"
Caption "ELMS Server Prerequisites"
OutFile "${OUT_FILE}"
InstallDir "$TEMP\ELMS-Server-Prerequisites"
Icon "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"

!include "MUI2.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

SilentInstall normal
ShowInstDetails show

Section "Install prerequisites" SEC01
  SetOutPath "$INSTDIR"
  File "install-server-prerequisites.ps1"
  DetailPrint "Installing Node.js 22 LTS, npm, Git for Windows, and pnpm 10.18.0..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\install-server-prerequisites.ps1"'
  Pop $0
  ${If} $0 == 0
    MessageBox MB_ICONINFORMATION|MB_OK "ELMS server prerequisites were installed successfully.\n\nNext step: install MySQL 8 and run the ELMS server installation guide."
  ${Else}
    MessageBox MB_ICONSTOP|MB_OK "The prerequisite installation failed. Review the installer log, then run the installer again as Administrator."
    Abort
  ${EndIf}
SectionEnd

Section -Cleanup
  RMDir /r "$INSTDIR"
SectionEnd
