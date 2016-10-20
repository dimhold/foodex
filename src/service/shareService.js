var db = require("randoDB");
var config = require("config");
var logger = require("../log/logger");
var async = require("async");
var Errors = require("../error/errors");
var Bitly = require("bitly");
var gm = require("gm").subClass({ imageMagick: true });
var s3Service = require("./s3Service");
var imageService = require("./imageService");
var fs = require("fs");

var shareRandoHtmlTemplate = fs.readFileSync("static/share.html").toString();

module.exports = {
  generateHtmlWithRando (randoId, callback)  {
    db.user.getLightRandoByRandoId(randoId, function (err, data) {
      logger.debug("[shareService.generateHtmlWithRando]", "Start rendering html");
      if (data && data.out[0]) {
        var html = shareRandoHtmlTemplate.replace("{{RANDO_URL}}", data.out[0].imageURL)
          .replace("{{MAP_URL}}", data.out[0].mapURL);
        callback(null, html);
      } else {
        logger.warn("[shareService.generateHtmlWithRando]", "Cannot render html because rando is empty:", data);
        callback("ERROR");
      }
    });
  }
};
