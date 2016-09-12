var request = require("request");
var cheerio = require("cheerio");
var fs = require("fs");

fs.openSync("./ingredients.txt", 'w');
var counter = 0;
var ingredients = [];
for (var i = 97; i < 123; i++) {
	request({
		uri: "http://www.bbc.co.uk/food/ingredients/by/letter/" + String.fromCharCode(i),
	}, function(error, response, body) {
		$ = cheerio.load(body, {
			decodeEntities: true
		});
		$(".resource.food").each(function(e) {
			ingredients.push($(this).children().first().text().trim().toLowerCase());
		});
		counter++;
		if (counter == 26) {
			ingredients.sort();
			for (var i = 0; i < ingredients.length - 1; i++) {
				fs.appendFileSync("./ingredients.txt", ingredients[i] + "\n");
			}
			fs.appendFileSync("./ingredients.txt", ingredients[ingredients.length - 1]);
		}
	});
}