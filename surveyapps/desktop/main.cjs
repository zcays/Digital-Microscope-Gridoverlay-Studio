/* SUGAR desktop host. Owns local resources, window, IPC and process lifecycle. */
const {app, BrowserWindow, protocol, ipcMain, session, Menu, dialog} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {installProtocol} = require('./protocol.cjs');
const {Backend} = require('./backend.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'surveyapps', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true}}]);
app.setName('SUGAR');
// Keep the profile used by existing installations, including saved Grid Studio chip lists.
const previousProfile = path.join(app.getPath('appData'), 'SurveyApps!');
if (!app.commandLine.hasSwitch('user-data-dir') && fs.existsSync(previousProfile)) {
  app.setPath('userData', previousProfile);
  app.setPath('sessionData', previousProfile);
}
let window, backend, quitting=false;
const root = path.join(__dirname,'..');
const home = 'surveyapps://app/renderer/index.html';
const status = () => ({
  ...backend.status,
  gridUrl: 'surveyapps://app/vendor/grid-studio/index.html',
  segmentUrl: 'surveyapps://app/segment/index.html',
  version: app.getVersion(),
});
function requireDashboard(event) {
  const contents = window?.webContents;
  if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame ||
      event.senderFrame?.url !== home) {
    throw new Error('Denied');
  }
}

function configureSession(desktopSession) {
  desktopSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  desktopSession.setPermissionCheckHandler(()=>false);
  desktopSession.webRequest.onBeforeRequest((details,callback)=>{
    const url = new URL(details.url);
    const allowed = url.protocol === 'surveyapps:' || url.protocol === 'data:' || url.protocol === 'blob:' || (backend.origin && url.origin === backend.origin);
    callback({cancel:!allowed});
  });
  desktopSession.webRequest.onBeforeSendHeaders((details,callback)=>{
    const headers={...details.requestHeaders};
    if(backend.origin && new URL(details.url).origin===backend.origin) headers['X-SurveyApps-Key']=backend.token;
    callback({requestHeaders:headers});
  });
  desktopSession.on('will-download',(_event,item)=>{
    const name=path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_') || 'export';
    item.setSaveDialogOptions({title:'Save SUGAR export',defaultPath:path.join(app.getPath('downloads'),name)});
  });
}

function installBridge() {
  ipcMain.handle('surveyapps:status', event => {
    requireDashboard(event);
    return status();
  });
  ipcMain.handle('surveyapps:retry', event => {
    requireDashboard(event);
    if (backend.status.state === 'error') backend.start();
  });
  backend.on('status', () => {
    if (window && !window.isDestroyed()) window.webContents.send('surveyapps:status', status());
  });
}

function installMenu() {
  app.setAboutPanelOptions({applicationName:'SUGAR', applicationVersion:app.getVersion(), credits:'Super Ultra Gridding Arrays Repo'});
  const menu=[
    ...(process.platform==='darwin'?[{label:'SUGAR',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]}]:[]),
    {label:'File',submenu:[{label:'Home',accelerator:'CmdOrCtrl+1',click:()=>window.webContents.executeJavaScript("document.querySelector('[data-nav=home]').click()")},{type:'separator'},process.platform==='darwin'?{role:'close'}:{role:'quit'}]},
    {role:'editMenu'},
    {label:'View',submenu:[{role:'reload'},{role:'forceReload'},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
    {label:'Help',submenu:[{label:'Help & Reference',click:()=>window.webContents.executeJavaScript("document.querySelector('[data-nav=help]').click()")},{label:'About SUGAR',click:()=>dialog.showMessageBox(window,{type:'info',title:'SUGAR',message:'SUGAR '+app.getVersion(),detail:'Super Ultra Gridding Arrays Repo\n\nOffline Grid Studio, Fluorescence Lab, and Segment. Data remains on this computer. This local build is not Developer ID signed or notarized.'})}]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 800, minHeight: 600,
    title: 'SUGAR', backgroundColor: '#091423',
    icon: path.join(root, 'assets/icon.png'), show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false,
    },
  });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==home)event.preventDefault();});
  window.webContents.on('will-frame-navigate',(event,details)=>{
    // Electron versions expose details either as second arg or on the event.
    const target=typeof details==='string'?details:(details?.url || event.url);
    if(!target)return;
    const url=new URL(target);
    if(url.protocol!=='surveyapps:' && url.origin!==backend.origin && url.protocol!=='about:')event.preventDefault();
  });
  window.once('ready-to-show',()=>window.show());
  window.webContents.on('render-process-gone',()=>dialog.showMessageBox(window,{type:'error',message:'The workspace stopped responding.',detail:'Close and reopen SUGAR to start a fresh session.'}));
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    backend = new Backend({root, resources:process.resourcesPath, packaged:app.isPackaged});
    installProtocol(root);
    configureSession(session.defaultSession);
    installBridge();
    installMenu();
    createWindow();
    await window.loadURL(home);
    backend.start();
  }).catch(error=>{dialog.showErrorBox('SUGAR startup error',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{if(!quitting){quitting=true;backend?.stop();}});
  process.on('exit',()=>backend?.stop());
}
