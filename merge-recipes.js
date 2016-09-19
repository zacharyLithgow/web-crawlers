"use strict";

var path = require('path');
var fs = require('fs');
var jsonfile = require("jsonfile");

var recipes = [];
var files = fs.readdirSync(".");

for (var i = 0; i < files.length; i++) {
	var filename = path.join(".", files[i]);
	var stat = fs.lstatSync(filename);
	if (filename.indexOf("recipes-") >= 0 && filename.indexOf(".json") >= 0 && filename.indexOf("recipes-all") < 0) {
		console.log('-- merging: ' + filename);
		var obj = jsonfile.readFileSync(filename);
		for (var o in obj) {
			recipes.push(obj[o]);
		}
	}
}

console.log("end of merging");

fs.openSync("./recipes-all.json", "w");
fs.appendFileSync("./recipes-all.json", JSON.stringify(recipes));