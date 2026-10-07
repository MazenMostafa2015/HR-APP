Unicode true
Name "ELMS Desktop"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\ELMS Desktop"
RequestExecutionLevel user

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "ELMS Desktop" InstallSection
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD_DIR}\*"
  CreateDirectory "$SMPROGRAMS\ELMS Desktop"
  CreateShortcut "$DESKTOP\ELMS Desktop.lnk" "$INSTDIR\ELMS Desktop.exe"
  CreateShortcut "$SMPROGRAMS\ELMS Desktop\ELMS Desktop.lnk" "$INSTDIR\ELMS Desktop.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ELMS Desktop" "DisplayName" "ELMS Desktop"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ELMS Desktop" "UninstallString" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\ELMS Desktop.lnk"
  Delete "$SMPROGRAMS\ELMS Desktop\ELMS Desktop.lnk"
  RMDir "$SMPROGRAMS\ELMS Desktop"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ELMS Desktop"
SectionEnd
