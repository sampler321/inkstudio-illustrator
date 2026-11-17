#target illustrator
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
var files = arguments[0], outDir = arguments[1], log = [];
for (var i = 0; i < files.length; i++) {
  try {
    var src = new File(files[i]); var d = app.open(src);
    var o = new IllustratorSaveOptions(); o.compatibility = Compatibility.ILLUSTRATOR8; o.compressed = false; o.pdfCompatible = false; o.embedICCProfile = false;
    d.saveAs(new File(outDir + "/" + decodeURI(src.name)), o); d.close(SaveOptions.DONOTSAVECHANGES); log.push("ok " + src.name);
  } catch (e) { log.push("ERR " + files[i] + " " + e); }
}
log.join("\n");
