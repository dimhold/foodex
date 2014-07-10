var fs = require("fs");
var express = require("express");
var config = require("config");
var logger = require("./src/log/logger");
var userService = require("./src/service/userService");
var commentService = require("./src/service/commentService");
var randoService = require("./src/service/randoService");
var logService = require("./src/service/logService");
var mongodbConnection = require("./src/model/db").establishConnection();
var Errors = require("./src/error/errors");
var pairService = require("./src/service/pairService");
var app = express();

(function checkSources() {
    if (!fs.existsSync(config.app.citiesJson)) {
	console.error("File " + config.app.citiesJson + " not found. Did you run map.js script from git@github.com:RandoApp/Map.git repository before start server?\n");
	process.exit(1);
    }
})();


pairService.startDemon();

app.use(express.static(__dirname + '/static', {maxAge: config.app.cacheControl}));
app.use(express.limit(config.app.limit.imageSize));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());

app.post('/image/:token', function (req, res, next) {
    logger.data("Start process user request. POST /image. Token: ", req.params.token);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.forUserWithTokenWithoutSpam(req.params.token, ip, function (err, user) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /image DONE with error: " + response.code);
	    res.send(response);
	    return;
	}

	randoService.saveImage(user, req.files.image.path, {latitude: req.body.latitude, longitude: req.body.longitude},  function (err, response) {
	    if (err) {
		var response = Errors.toResponse(err);
		res.status(response.status);
		logger.data("POST /image DONE with error: ", response.code);
		res.send(response);
		return;
	    }

	    logger.data("POST /image DONE");
	    res.status(200);
	    res.send(response);
	});
    });
});

app.post('/report/:id/:token', function (req, res) {
    logger.data("Start process user request. POST /report. Id:", req.params.id ," Token: ", req.params.token);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.forUserWithToken(req.params.token, ip, function (err, user) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /report DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	commentService.report(user, req.params.id, function (err, response) {
	    if (err) {
		var response = Errors.toResponse(err);
		res.status(response.status);
		logger.data("POST /report DONE with error: ", response.code);
		res.send(response);
		return;
	    }

	    logger.data("POST /report DONE");
	    res.send(response);
	});
    });
});


app.post('/user', function(req, res) {
    logger.data("Start process user request. POST /user. Email: ", req.body.email, " Password length: " , req.body.password.length);
    
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.findOrCreateByLoginAndPassword(req.body.email, req.body.password, ip, function (err, response) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /user DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	logger.data("POST /user DONE");
	res.send(response);
    });
});

app.get('/user/:token', function (req, res) {
    logger.data("Start process user request. GET /user. Token: ", req.params.token);
    
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.forUserWithToken(req.params.token, ip, function (err, user) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("GET /user DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	userService.getUser(user, function (err, user) {
	    if (err) {
		var response = Errors.toResponse(err);
		res.status(response.status);
		logger.data("GET /user DONE with error: ", response.code);
		res.send(response);
		return;
	    }
	    logger.data("GET /user DONE");
	    res.send(user);
	});
    });
});

app.post('/anonymous', function (req, res) {
    logger.data("Start process user request. POST /anonymous. id: ", req.body.id);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.findOrCreateAnonymous(req.body.id, ip, function (err, response) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /anonymous DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	logger.data("POST /anonymous DONE");
	res.status(200);
	res.send(response);
    });
});

app.post('/facebook', function (req, res) {
    logger.data("Start process user request. POST /facebook. Id:", req.body.id ," Email: ", req.body.email, " FB Token length: ", req.body.token.length);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.verifyFacebookAndFindOrCreateUser(req.body.id, req.body.email, req.body.token, ip, function (err, response) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /facebook DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	logger.data("POST /facebook DONE");
	res.status(200);
	res.send(response);
    });
});

app.post('/google', function (req, res) {
    logger.data("Start process user request. POST /google. Email: ", req.body.email, "Family name: ", req.body.family_name, " Google Token length: ", req.body.token.length);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.verifyGoogleAndFindOrCreateUser(req.body.email, req.body.family_name, req.body.token, ip, function (err, response) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /google DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	logger.data("POST /google DONE");
	res.status(200);
	res.send(response);
    });
});

app.post('/logout/:token', function (req, res) {
    logger.data("Start process user request. POST /logout. Token: ", req.params.token);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.forUserWithToken(req.params.token, ip, function (err, user) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /logout DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	userService.destroyAuthToken(user, function (err, response) {
	    if (err) {
		var response = Errors.toResponse(err);
		res.status(response.status);
		logger.data("POST /logout DONE with error: ", response.code);
		res.send(response);
		return;
	    }

	    logger.data("POST /logout DONE");
	    res.status(200);
	    res.send(response);
	});
    });
});

app.post('/log', function (req, res) {
    logger.data("Start process user request. POST /log. Token: ", req.params.token);
    var email = "anonymous";
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    logService.storeLog(email, req.body, function (err, response) {
	if (err) {
	    var response = Errors.toResponse(err);
	    res.status(response.status);
	    logger.data("POST /log DONE with error: ", response.code);
	    res.send(response);
	    return;
	}

	logger.data("POST /log DONE");
	res.status(200);
	res.send(response);
    });
});

app.post('/log/:token', function (req, res) {
    logger.data("Start process user request. POST /log. Token: ", req.params.token);

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    userService.forUserWithToken(req.params.token, ip, function (err, user) {
	var email = "anonymous";
	if (user) {
	    email = user.email;
	}
	logService.storeLog(email, req.body, function (err, response) {
	    if (err) {
		var response = Errors.toResponse(err);
		res.status(response.status);
		logger.data("POST /log DONE with error: ", response.code);
		res.send(response);
		return;
	    }

	    logger.data("POST /log DONE");
	    res.status(200);
	    res.send(response);
	});
    });
});

require("./admin/admin").init(app);

app.listen(config.app.port, function () {
    logger.info('Express server listening on port ' + config.app.port);
});
