var logger = require("../log/logger");
var crypto = require("crypto");
var config = require("config");

module.exports = {
  generateHashForPassword (email, password, salt) {
    logger.data("[password.generateHashForPassword, ", email, "] Try generate hash.");
    var sha1sum = crypto.createHash("sha1");
    sha1sum.update(password + email + salt);
    return sha1sum.digest("hex");
  },
  isPasswordCorrect (password, user, salt) {
    logger.data("[userService.isPasswordCorrect, ", user.email, "] Try compare passwords: ", user.password, " === ", this.generateHashForPassword(user.email, password, salt));
    return user.password === this.generateHashForPassword(user.email, password, salt);
  }
};
