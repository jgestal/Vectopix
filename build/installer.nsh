; "Open with Vectopix" for images in Windows Explorer, never as the default
; app: a ProgID plus an OpenWithProgids entry per extension.
!macro customInstall
  WriteRegStr SHCTX "Software\Classes\Vectopix.Image" "" "Image"
  WriteRegStr SHCTX "Software\Classes\Vectopix.Image\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\Vectopix.Image\shell\open" "FriendlyAppName" "Vectopix"
  WriteRegStr SHCTX "Software\Classes\Vectopix.Image\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  !insertmacro VectopixOpenWith WriteRegStr
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\Vectopix.Image"
  !insertmacro VectopixOpenWith DeleteRegValue
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro VectopixOpenWith ACTION
  !insertmacro VectopixOpenWithExt ${ACTION} ".png"
  !insertmacro VectopixOpenWithExt ${ACTION} ".jpg"
  !insertmacro VectopixOpenWithExt ${ACTION} ".jpeg"
  !insertmacro VectopixOpenWithExt ${ACTION} ".webp"
  !insertmacro VectopixOpenWithExt ${ACTION} ".gif"
  !insertmacro VectopixOpenWithExt ${ACTION} ".bmp"
  !insertmacro VectopixOpenWithExt ${ACTION} ".tga"
  !insertmacro VectopixOpenWithExt ${ACTION} ".ico"
!macroend

!macro VectopixOpenWithExt ACTION EXT
  !if "${ACTION}" == "WriteRegStr"
    WriteRegStr SHCTX "Software\Classes\${EXT}\OpenWithProgids" "Vectopix.Image" ""
  !else
    DeleteRegValue SHCTX "Software\Classes\${EXT}\OpenWithProgids" "Vectopix.Image"
  !endif
!macroend
