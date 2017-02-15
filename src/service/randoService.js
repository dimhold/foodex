var logger = require("../log/logger");
var config = require("config");
var async = require("async");
var util = require("../util/util");
var mv = require("mv");
var db = require("randoDB");
var mapService = require("./mapService");
var imageService = require("./imageService");
var s3Service = require("./s3Service");
var Errors = require("../error/errors");
var gm = require("gm").subClass({ imageMagick: true });
var fs = require("fs");
var randoRecognition = require("randoRecognition");

function buildPostImageResponseSync (rando) {
  logger.trace("[randoService.buildPostImageResponseSync] rando:", rando);
  return {
    //1.0.15+
    randoId: rando.randoId,
    //1.0.1+
    creation: rando.creation,
    //1.0.1+
    imageURL: rando.imageURL,
    //1.0.15+
    imageSizeURL: {
      small: rando.imageSizeURL.small,
      medium: rando.imageSizeURL.medium,
      large: rando.imageSizeURL.large
    },
    //1.0.15+
    mapURL: null,
    //1.0.15+
    mapSizeURL: {
      small: null,
      medium: null,
      large: null
    },
    //1.0.19+
    detected: Array.isArray(rando.tags) ? rando.tags.map(tag => {
      for (var detectedTag in config.app.detectedTagMap) {
        if (config.app.detectedTagMap[detectedTag].indexOf(tag) !== -1) {
          return detectedTag;
        }
      }
    }).filter(tag => tag) : []
  };
};

module.exports =  {
  saveImage (lightUser, imagePath, location, callback) {
    logger.debug("[randoService.saveImage, ", lightUser.email, "] Try save image from: ", imagePath, " for: ", lightUser.email, " location: ", location);

    async.waterfall([
      function checkArgs (done) {
        if (!imagePath || !location) {
          logger.warn("[randoService.saveImage, ", lightUser.email, "] Incorect args. user: ", lightUser.email, "; imagePath: ", imagePath, "; location: " , location);
          return done(Errors.IncorrectArgs());
        }
        logger.debug("[randoService.saveImage, ", lightUser.email, "] args validation done");
        return done();
      },
      function generateImageName (done) {
        util.generateImageName(done);
      },
      function prepareUploadedImage (randoId, imagePaths, done) {
        var newRandoPath = config.app.static.folder.name + imagePaths.origin;
        logger.data("[randoService.saveImage, ", lightUser.email, "] move: ", imagePath, " --> ", newRandoPath);
        mv(imagePath, newRandoPath, {mkdirp: true}, function (err) {
          if (err) {
            logger.warn("[randoService.saveImage, ", lightUser.email, "] Can't move  ", imagePath, " to ", newRandoPath, " because: ", err);
            return done(Errors.System(err));
          }

          return done(null, newRandoPath, imagePaths, lightUser, randoId, location);
        });
      },
      function convertToSizes (imagePath, imagePaths, lightUser, randoId, location, done) {
        logger.data("[randoService.saveImage, ", lightUser.email, "] Try resize images to small, medium and large sizes");

        async.parallel({
          small (parallelCallback) {
            imageService.resize("small", imagePaths, randoId, imagePath, parallelCallback);
          },
          medium (parallelCallback) {
            imageService.resize("medium", imagePaths, randoId, imagePath, parallelCallback);
          },
          large (parallelCallback) {
            imageService.resize("large", imagePaths, randoId, imagePath, parallelCallback);
          }
        }, function (err) {
          if (err) {
            logger.error("[randoService.saveImage, ", lightUser.email, "] Can not resize images because: ", err);
            return done(err);
          }

          logger.debug("[randoService.saveImage, ", lightUser.email, "] All images resized successfully. Go to next step");
          return done(null, imagePaths, lightUser, randoId, location);
        });
      },
      function recognizeImage (imagePaths, lightUser, randoId, location, done) {
        randoRecognition.recognizeWithScaners(config.app.static.folder.name + imagePaths.small, config.app.enabledScaners, function (err, tags) {
          if (err) {
            tags = [];
            logger.error("[randoService.recognizeImage, ", lightUser.email, "] Can not recognize image because: ", err, "Skip this step!");
          }

          logger.debug("[randoService.recognizeImage, ", lightUser.email, "] Image recognized successfully. Tags: ", tags);

          return done(null, imagePaths, lightUser, randoId, location, tags);
        });
      },
      function uploadToS3 (imagePaths, lightUser, randoId, location, tags, done) {
          var imageSizeURL = {}; //will be filled after each size upload to S3

          async.parallel({
            uploadSmall (parallelCallback) {
              s3Service.upload(imagePaths, "small", function (err, url) {
                if (err) {
                  return parallelCallback(err);
                }
                imageSizeURL.small = url;
                return parallelCallback();
              });
            },
            uploadMedium (parallelCallback) {
              s3Service.upload(imagePaths, "medium", function (err, url) {
                if (err) {
                  return parallelCallback(err);
                }
                imageSizeURL.medium = url;
                return parallelCallback();
              });
            },
            uploadLarge (parallelCallback) {
              s3Service.upload(imagePaths, "large", function (err, url) {
                if (err) {
                  return parallelCallback(err);
                }
                imageSizeURL.large = url;
                return parallelCallback();
              });
            }
          }, function (err) {
            if (err) {
              logger.error("[randoService.saveImage, ", lightUser.email, "] Can not upload image to S3, because: ", err);
              return done(err);
            }

            logger.debug("[randoService.saveImage, ", lightUser.email, "] All images uploaded to S3 successfully. Go to next step");
            return done(null, imagePaths, lightUser, randoId, imageSizeURL.large, imageSizeURL, location, tags);
          });
      },
      function rmImages (imagePaths, lightUser, randoId, imageURL, imageSizeURL, location, tags, done) {
        async.parallel({
          rmOrigin (parallelCallback) {
            var originFile = config.app.static.folder.name + imagePaths.origin;
            fs.unlink(originFile, function (err) {
              if (err) {
                return parallelCallback(err);
              }
              return parallelCallback();
            });
          },
          rmSmall (parallelCallback) {
            var smallFile = config.app.static.folder.name + imagePaths.small;
            fs.unlink(smallFile, function (err) {
              if (err) {
                return parallelCallback(err);
              }
              return parallelCallback();
            });
          },
          rmMedium (parallelCallback) {
            var mediumFile = config.app.static.folder.name + imagePaths.medium;
            fs.unlink(mediumFile, function (err) {
              if (err) {
                return parallelCallback(err);
              }
              return parallelCallback();
            });
          },
          rmLarge (parallelCallback) {
            var largeFile = config.app.static.folder.name + imagePaths.large;
            fs.unlink(largeFile, function (err) {
              if (err) {
                return parallelCallback(err);
              }
              return parallelCallback();
            });
          }
        }, function (err) {
          if (err) {
            logger.error("[randoService.saveImage, ", lightUser.email, "] Can not remove image from fs, because: ", err);
            return done(err);
          };

          logger.debug("[randoService.saveImage, ", lightUser.email, "] All tmp images deleted from fs. Go to next step");
          return done(null, lightUser, randoId, imageURL, imageSizeURL, location, tags);
        });
      },
      function updateRandoInDB (lightUser, randoId, imageURL, imageSizeURL, location, tags, callback) {
        logger.debug("[randoService.updateRandoInDB,", lightUser.email, "] Try update rando for:", lightUser.email, "location:", location, "randoId:", randoId, "url:", imageURL, "image url:", imageSizeURL);
        var self = this;
        
        var mapSizeURL = {};
        var randoIp = lightUser.ip;

        if (!location || (!location.latitude && !location.longitude)) {
          mapSizeURL = mapService.locationToMapURLSync(location.latitude, location.longitude);
        } else {
          mapSizeURL = mapService.ipToMapURLSync(randoIp);
        }

        var newRando = {
          email: lightUser.email,
          creation: Date.now(),
          randoId,
          imageURL,
          mapURL: mapSizeURL.large,
          location,
          imageSizeURL,
          mapSizeURL,
          ip: randoIp,
          tags,
          delete: 0
        };

        async.parallel({
          addRandoToDBBucket (done) {
            logger.trace("[randoService.updateRandoInDB.addRandoToDBBucket,", lightUser.email, "]");
            db.rando.add(newRando, done);
          },
          addRandoToUserOut (done) {
            logger.trace("[randoService.updateRandoInDB.addRandoToUserOut,", lightUser.email, "]");
            db.user.addRandoToUserOutByEmail(lightUser.email, newRando, done);
          }
        }, function (err) {
          if (err) {
            logger.debug("[randoService.updateRandoInDB, ", lightUser.email, "] async parallel get error:", err);
            return callback(Errors.System(err));
          }
          return callback(null, newRando);
        });
      },
      function buildRando (rando, done) {
        logger.trace("[randoService.buildRando,", lightUser.email, "]");
        var randoForResponse = buildPostImageResponseSync(rando);
        return done(null, randoForResponse);
      }
    ], function (err, rando) {
      if (err) {
        logger.warn("[randoService.saveImage, ", lightUser.email, "] Can't save image, because: ", err);
        return callback(err);
      }
      logger.debug("[randoService.saveImage, ", lightUser.email, "] save done");
      return callback(null, rando);
    });
  }
};
