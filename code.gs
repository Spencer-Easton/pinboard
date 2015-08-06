// Specify a dev mode so that the correct callback URL are used for Drive sdk. 
var DEV_MODE = false;




var mimeType = "application/drive-pinboard";


if(DEV_MODE){
  var title = "Pinboard_DEV!"}else{
    var title = "Pinboard"
    }

function doGet(e) {
  var noteStack = {};
  noteStack["notes"] = [];
  var htmlOut = 'pinboardUI';
  var activeFile = "";
  var activeFileId = "";
  
  if(e.parameter.code){ // this is a callback from an install to google drive
    getAndStoreAccessToken(e.parameter.code);   
    htmlOut = 'doneInstall';
  } else if (e.parameter.state){ // This is either an open or a create
    var state = JSON.parse(e.parameter.state);
    if(state.action === 'create'){
      
      var folder = DriveApp.getFolderById(state.folderId)
      activeFile = folder.createFile("New Pinboard", "", mimeType);
      
      // Work around for Error and Page Reload File Creation Spam
      var t = HtmlService.createTemplateFromFile('newFile')
      t.folder = folder.getName();
      t.folderId = state.folderId;
      return t.evaluate().setTitle('New File Created');
      // End Work around *************************
      
      
    }
    
    if(state.action === 'open'){ 
      htmlOut = 'pinboardUI';
      activeFile = DriveApp.getFileById(state.ids[0]);
      PropertiesService.getUserProperties().setProperty("currentFileId",  activeFile.getId());
      PropertiesService.getUserProperties().setProperty("docName", activeFile.getName() );
      var fileData = activeFile.getBlob().getDataAsString();
      if(fileData != ""){
        noteStack = JSON.parse(fileData);
        
      }  
    }
    
  }else{ // Are we installing the app 195179456072 to google Drive? 
    //To get this number click 'Resources -> Advanced Google Services -> Google Developers Console Link. It will be in the url.
    if(!Drive.Apps.get("195179456072").installed){
      htmlOut = "install";
    } else { 
      // This means it is a naked call to the app and it has already been installed
      // This will list all your pinboard files in your google drive account render it to a page.
      // This will happen if someone launches your Chrome App
      var pbFiles = DriveApp.getFilesByType(mimeType);
      
      var selectWindow = HtmlService.createTemplateFromFile('selectPinboard');
      var links = [];
      
      
      while(pbFiles.hasNext()){
        var curFile = pbFiles.next();
        var fileObj = {};
        fileObj["folder"] = curFile.get
        fileObj["name"] = curFile.getName();
        fileObj["link"] = REDIRECT_URL + '?state={"ids":["'+ curFile.getId()+'"],"action":"open"}';
        
        links.push(fileObj);
      }
      selectWindow.links = links;
      selectWindow.newLink = REDIRECT_URL + '?state={"folderId":"'+ DriveApp.getRootFolder().getId()+'","action":"create"}';
      
      return selectWindow.evaluate().setWidth(300).setHeight(600).setTitle('Select a Pinboard');
      
    }
    
  }
  // might change this. It requires user to have a setup google+ account
  var t = HtmlService.createTemplateFromFile(htmlOut);
  
  try{
    t.userName = Drive.About.get().user.displayName;
  }catch(e){
    t.username = Session.getActiveUser().getEmail();
  }
  
  try{
    t.userUrl = Drive.About.get().user.picture.url;
  }catch(e){
    t.userUrl = 'https://ssl.gstatic.com/s2/oz/images/sge/silhouette.png';
  }
  
  
  t.data = noteStack.notes;
  
  return t.evaluate().setTitle(title);
}




function removeNote(noteId){
  var curFile = DriveApp.getFileById(PropertiesService.getUserProperties().getProperty("currentFileId"));
  var inJSON = JSON.parse(curFile.getBlob().getDataAsString());
  
  
  for(note in inJSON["notes"]){
    if(noteId == inJSON["notes"][note].id){
      inJSON["notes"].splice(note,1);
    }
  }
  
  curFile.setContent(JSON.stringify(inJSON));
}


function saveToFile(note){
  var lastID = PropertiesService.getUserProperties().getProperty("currentFileId");
  var curFile = DriveApp.getFileById(lastID);
  var infoFile = Drive.Files.get(lastID);
  
  var inJSON = curFile.getBlob().getDataAsString();
  var inNotes = {};
  
  if(inJSON != ""){
    inNotes = JSON.parse(inJSON)
  }else{
    inNotes["notes"] = [];
  } 
  inNotes["notes"].push(note);
  curFile.setContent(JSON.stringify(inNotes));
  return Drive.Files.get(lastID).modifiedDate;
}



function getLastUpdate(){
  var file = Drive.Files.get(PropertiesService.getUserProperties().getProperty("currentFileId"));
  return file.modifiedDate;
}


function getNewNotes(){
  var newNotes = "";
  var curNotes = JSON.parse(DriveApp.getFileById(PropertiesService.getUserProperties().getProperty("currentFileId")).getBlob().getDataAsString());
  
  for(note in curNotes["notes"]){
    newNotes += printNote(curNotes["notes"][note]);      
  }
  
  return newNotes;
}


function updateNote(noteId, noteData){
  //{"header":false,"body":false,"items":[{"index":$(this).attr("data-myIndex"),"name":false,"completed":$(this).prop( "checked" )}]}
  
  
  var file = DriveApp.getFileById(PropertiesService.getUserProperties().getProperty("currentFileId"));
  var curFile = JSON.parse(file.getBlob().getDataAsString());
  
  
  for(note in curFile["notes"]){
    if(curFile["notes"][note].id == noteId){
      if(noteData["header"]){Logger.log("saving header"); curFile["notes"][note].Title = noteData.header}
      if(noteData["body"]){Logger.log("Processing Body");}
      if(noteData["items"]){
        Logger.log("Processing Items");
        for(item in noteData["items"]){
          Logger.log("Item #" + item +" :" + noteData["items"][item].index + ":" + noteData["items"][item].completed);
          if(noteData["items"][item].name){Logger.log("ITEM NAME")}
          if(noteData["items"][item].completed){
            Logger.log("ITEM CHECKS!")
            
            Logger.log(noteData["items"][item].index  +"   "+noteData["items"][item].completed)
            curFile["notes"][note].Items[noteData["items"][item].index].completed = noteData["items"][item].completed;
          }
        }
      }     
    }
  }
  
  
  file.setContent(JSON.stringify(curFile));
  return Drive.Files.get(PropertiesService.getUserProperties().getProperty("currentFileId")).modifiedDate;
}



function setDocName(newName){
  var curFile = DriveApp.getFileById(PropertiesService.getUserProperties().getProperty("currentFileId"));
  PropertiesService.getUserProperties().setProperty("docName", newName)
  curFile.setName(newName);
  return Drive.Files.get(PropertiesService.getUserProperties().getProperty("currentFileId")).modifiedDate;
  
}

function getDocName(){
  return DriveApp.getFileById(PropertiesService.getUserProperties().getProperty("currentFileId")).getName();
  
  
}





function include(file){
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function includeT(file){
  
  return HtmlService.createTemplateFromFile(file).evaluate().getContent();
}


function printNote(TaskObject)
{
  var t = HtmlService.createTemplateFromFile('noteTemplate');
  t.data = TaskObject;
  return t.evaluate().getContent();
  
}



function uploadImage(formObject) {
  var isImage = false;
  var formBlob = formObject.fileButton;
  
  switch(formBlob.getContentType())
  {
    case MimeType.BMP:
    case MimeType.GIF:
    case MimeType.JPEG:
    case MimeType.PNG:
      isImage = true;
      break;
      
  }
  
  if(isImage == false)
    throw new Error("Not a valid Image type: bmp, gif, jpg/jpeg, png");
  
  
  var driveFile = DriveApp.createFile(formBlob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
  return  driveFile.getId();
  
}


function getFileId(){
  Logger.log(PropertiesService.getUserProperties().getProperty("currentFileId"));
  
}

function getURLForAuthorization(){
  return AUTHORIZE_URL + '?response_type=code&client_id='+CLIENT_ID+'&redirect_uri='+REDIRECT_URL +'&scope=https://www.googleapis.com/auth/drive.install';  
}


function getAndStoreAccessToken(code){
  var parameters = { method : 'post',
                    payload : 'client_id='+CLIENT_ID+'&client_secret='+CLIENT_SECRET+'&grant_type=authorization_code&redirect_uri='+REDIRECT_URL+'&code=' + code};
  //no need to do anything with the token going forward. 
  var response = UrlFetchApp.fetch(TOKEN_URL,parameters).getContentText();
}


var AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/auth'; 
var TOKEN_URL = 'https://accounts.google.com/o/oauth2/token'; 



if(DEV_MODE)
{
  var REDIRECT_URL = "https://script.google.com/a/macros/ccsknights.org/s/AKfycbzlrWU72XCTXrPuihH1l0elQvvv8tApvlTWZzR9P8E/dev";
  var CLIENT_ID =  PropertiesService.getScriptProperties().getProperty("dev_client_id");
  var CLIENT_SECRET  =  PropertiesService.getScriptProperties().getProperty("dev_client_secret");
}else{
  var REDIRECT_URL= "https://script.google.com/a/macros/ccsknights.org/s/AKfycbyl2VAGtcEbfVkEDG3lfMzWj6CqgTcd1YWGRu-HHBjOUDCo0ic/exec";
  var CLIENT_ID =  PropertiesService.getScriptProperties().getProperty("client_id");
  var CLIENT_SECRET  =  PropertiesService.getScriptProperties().getProperty("client_secret");
}

