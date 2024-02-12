// @ts-ignore
const dotenv = require("dotenv");
var jwt = require("jsonwebtoken");

const USER_ID = "65c9454d9221b45fedca52de";

dotenv.config();

const token = jwt.sign({ user_id: USER_ID }, process.env.JWT_SECRET_KEY);

console.log(token);
