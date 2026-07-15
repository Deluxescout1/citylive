# Custom NSIS steps for CityLive.
#
# A Windows screensaver (.scr) is just an .exe with a different extension. On install we
# drop a copy of the app exe named "CityLive.scr" next to it, so Windows can run it as a
# screensaver. The app's "Use CityLive as Screen Saver" menu item then just points the
# registry at this file (HKCU, no elevation). We do NOT force it on at install time.

!macro customInstall
  nsExec::Exec 'cmd /c copy /Y "$INSTDIR\CityLive.exe" "$INSTDIR\CityLive.scr"'
!macroend

!macro customUnInstall
  # Clean up the .scr and stop pointing the screensaver registry at a deleted file.
  Delete "$INSTDIR\CityLive.scr"
  nsExec::Exec 'reg delete "HKCU\Control Panel\Desktop" /v SCRNSAVE.EXE /f'
!macroend
