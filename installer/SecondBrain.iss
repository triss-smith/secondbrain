; installer/SecondBrain.iss
#define AppName "Second Brain"
#define AppVersion "1.0.0"
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
; Embedded Python (set up by build.bat — includes pip)
Source: "..\installer\python-embed\*"; DestDir: "{app}\python"; Flags: recursesubdirs ignoreversion

[Icons]
; Start Menu
Name: "{group}\{#AppName}"; Filename: "{app}\python\{#AppExeName}"; Parameters: """{app}\installer\launcher.py"""; WorkingDir: "{app}"; IconFilename: "{app}\installer\icon.ico"
; Desktop (optional)
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\python\{#AppExeName}"; Parameters: """{app}\installer\launcher.py"""; WorkingDir: "{app}"; IconFilename: "{app}\installer\icon.ico"; Tasks: desktopicon

[Run]
; Install Python dependencies — shown as a status message, runs hidden
Filename: "{app}\python\python.exe"; Parameters: "-m pip install -r ""{app}\requirements.txt"""; WorkingDir: "{app}"; StatusMsg: "Installing dependencies (this may take several minutes)..."; Flags: runhidden waituntilterminated

[UninstallDelete]

[Code]
procedure CreateEnvFile();
var
  EnvFile: string;
  Content: string;
begin
  EnvFile := ExpandConstant('{app}\.env');
  if not FileExists(EnvFile) then
  begin
    Content :=
      'MINIMAX_API_KEY=your_api_key_here' + #13#10;
    SaveStringToFile(EnvFile, Content, False);
  end;
end;

procedure OpenEnvFile();
var
  ResultCode: Integer;
begin
  ShellExec('open', 'notepad.exe',
    ExpandConstant('{app}\.env'), '',
    SW_SHOW, ewNoWait, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CreateEnvFile();
    if MsgBox(
      'Almost done! Second Brain needs an API key to work.' + #13#10 +
      'Your .env file will open now — paste your MINIMAX_API_KEY value and save.',
      mbInformation, MB_OK) = IDOK then
    begin
      OpenEnvFile();
    end;
  end;
end;

function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if DirExists(ExpandConstant('{app}\data')) then
  begin
    if MsgBox(
      'Do you want to delete your Second Brain data (notes, files, and AI memory)?' + #13#10 +
      'Click YES to permanently delete all your data.' + #13#10 +
      'Click NO to keep your data (you can re-import it later).',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      DelTree(ExpandConstant('{app}\data'), True, True, True);
    end;
  end;
end;
