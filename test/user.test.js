//test file for user functionality
const userService = require("../service/userService");
const dao = require("../repository/userDAO");
const bcrypt = require("bcrypt");
const uuid = require("uuid")
jest.mock("../repository/userDAO");
jest.mock('bcrypt');
jest.mock('uuid');