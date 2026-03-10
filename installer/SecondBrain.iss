; installer/SecondBrain.iss
#define AppName "Second Brain"
#define AppExeName "pythonw.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Second Brain
DefaultDirName={autopf}\SecondBrain
DefaultGroupName={#AppName}
OutputDir=..\dist
OutputBaseFilename=SecondBrain-Setup
SetupIconFile=..\installer\icon.ico
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
DisableProgramGroupPage=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checkedonce

[Files]
; App source
Source: "..\backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs ignoreversion
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: recursesubdirs ignoreversion
Source: "..\installer\launcher.py"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "..\installer\icon.ico"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "..\requirements.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\VERSION"; DestDir: "{app}"; Flags: ignoreversion
; Embedded Python (set up by build.bat — includes pip)
Source: "..\installer\python-embed\*"; DestDir: "{app}\python"; Flags: recursesubdirs ignoreversion

[Icons]
; Start Menu
Name: "{group}\{#AppName}"; Filename: "{app}\python\{#AppExeName}"; Parameters: """{app}\installer\launcher.py"""; WorkingDir: "{app}"; IconFilename: "{app}\installer\icon.ico"
; Desktop (optional)
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\python\{#AppExeName}"; Parameters: """{app}\installer\launcher.py"""; WorkingDir: "{app}"; IconFilename: "{app}\installer\icon.ico"; Tasks: desktopicon


[UninstallDelete]

[Code]
function InitializeUninstall(): Boolean;
var
  DataDir: String;
begin
  Result := True;
  DataDir := ExpandConstant('{userappdata}\SecondBrain');
  if DirExists(DataDir) then
  begin
    if MsgBox(
      'Do you want to delete your Second Brain data (notes, files, and AI memory)?' + #13#10 +
      'Click YES to permanently delete all your data.' + #13#10 +
      'Click NO to keep your data (you can re-import it later).',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      DelTree(DataDir, True, True, True);
    end;
  end;
end;
