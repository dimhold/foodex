var config = require("config");
var crypto = require("crypto");
var fs = require("fs");
var async = require("async");
var logger = require("../log/logger");

module.exports = {
    generateFoodName: function (callback) {
	logger.debug("[util.genereateFoodName]");
	async.waterfall([
	    this.generateUniqueName,
	    function (name, done) {
		var folderName = name.substr(0, config.app.static.folder.length);
		var fullPath = config.app.static.folder.food + "/" + folderName + "/" + name + "." + config.app.static.file.ext;

		logger.debug("fullPath: ", fullPath);
		done(null, name, fullPath);
	    }],
	    function (err, name, fullPath) {
		if (err) {
		    logger.warn("genereFoodName fail with error: ", err);
		    callback(err);
		    return;
		}

		callback(null, name, fullPath);
	    });
    },
    generateUniqueName: function (callback) {
	logger.debug("[util.generateUniqueName]");
	crypto.pseudoRandomBytes(config.app.static.file.length, function(ex, buf) {
	    if (ex) {
		logger.warn("Can't genererateUniqueName: ", ex);
		callback(ex);
		return;
	    }

	    logger.debug("Unique name generated successful");

	    callback(null, buf.toString('hex'));
	});
    }
};

