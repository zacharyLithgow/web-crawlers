"use strict";

var cheerio = require("cheerio");
var fs = require("fs");
var request = require("sync-request");
var lineByLine = require("n-readlines");

var liner = new lineByLine("ingredients.txt");

var ingredients = [];
var commonIngredients = [];

var line;
while (line = liner.next()) {
	ingredients.push(line.toString("ascii").trim());
}

liner = new lineByLine("common-ingredients.txt");
while (line = liner.next()) {
	commonIngredients.push(line.toString("ascii").trim());
}

function isVowel(c) {
	return ['a', 'e', 'i', 'o', 'u'].indexOf(c.toLowerCase()) !== -1;
}

function cleanFromAllNonCharacters(tab) {
	for (var i = 0; i < tab.length; i++) {
		if (!tab[i].charAt(0).match(/[a-zA-Z]/)) {
			tab[i] = tab[i].slice(1);
		}
		if (!tab[i].charAt(tab[i].length - 1).match(/[a-zA-Z]/)) {
			tab[i] = tab[i].slice(0, tab[i].length - 1);
		}
	}

	return tab;
};

function getTime(text) {
	var tab = text.split(" ");
	var str = "";
	for (var i = 2; i < tab.length; i++) {
		str += tab[i] + " ";
	}
	return str.trim();
};

String.prototype.toPlural = function() {
	var plural = this + "s";
	var lastC = this.charAt(this.length - 1);
	var beforeLastC = this.charAt(this.length - 2);
	if (lastC === "y" && !isVowel(beforeLastC)) {
		plural = this.slice(0, this.length - 1) + "ies";
	} else if (lastC === "o" && !isVowel(beforeLastC)) {
		plural = this + "es";
	}

	return plural;
};

String.prototype.in = function(array) {
	for (var i = 0; i < array.length; i++) {
		if (this === array[i])
			return true;
	}
	return false;
};

var recipes = [];

var res = request("GET", "http://iamafoodblog.com/category/recipes/", {
	"headers": {
		"user-agent": "RecipesAppBot"
	},
	"retry": true,
	"retryDelay": 1000
});
var $ = cheerio.load(res.getBody("utf8"), {
	normalizeWhitespace: true,
	decodeEntities: true
});


var nbPages = parseInt($(".page").last().text());

for (var i = 1; i <= nbPages; i++) {
	var res = request("GET", "http://iamafoodblog.com/category/recipes/page/" + i + "/", {
		"headers": {
			"user-agent": "RecipesAppBot"
		},
		"retry": true,
		"retryDelay": 1000
	});
	var $ = cheerio.load(res.getBody("utf8"), {
		normalizeWhitespace: true,
		decodeEntities: true
	});

	var thumbs = $(".thumbnail");
	for (var x = 0; x < thumbs.length; x++) {
		var imageSrc = $(thumbs[x]).css('background-image');
		imageSrc = imageSrc.replace('url(', '').replace(')', '').replace(/\"/gi, "");
		imageSrc = imageSrc.replace(/\'/g, "");

		var res = request("GET", $(thumbs[x]).find("a").attr("href"), {
			"headers": {
				"user-agent": "RecipesAppBot"
			},
			"retry": true,
			"retryDelay": 1000
		});
		var $ = cheerio.load(res.getBody("utf8"), {
			normalizeWhitespace: true,
			decodeEntities: true
		});

		var recipesBlock = $("blockquote[class='recipe']");

		for (var r = 0; r < recipesBlock.length; r++) {
			var recipe = {};
			recipe.title = $(recipesBlock[r]).find(".recipename").text().trim();
			recipe.imageSrc = imageSrc;

			recipe.exactIngredients = [];
			recipe.baseIngredients = [];

			$(recipesBlock[r]).find("strong[class='ingredient']").each(function(e) {
				var exactIng = $(this).text().trim();
				recipe.exactIngredients.push(exactIng);

				var ingTab = cleanFromAllNonCharacters(exactIng.split(" "));
				var resIng = "";
				for (var ele = 0; ele < ingredients.length; ele++) {
					var ing = ingredients[ele];
					var tab = ing.split(" ");

					if (tab.length == 1) {
						for (var x = 0; x < ingTab.length; x++) {
							if (ingTab[x].toLowerCase() === tab[0] || ingTab[x].toLowerCase() === tab[0].toPlural()) {
								if (resIng === "" || resIng.split(" ").length < ing.split(" ").length)
									resIng = ing;
								break;
							}
						}
					} else {
						var a = 0,
							b = 0;
						for (var x = 0; x < ingTab.length; x++) {
							if (ingTab[x].toLowerCase() === tab[a]) {
								a = 1;
								b = x + 1;
								break;
							}
						}
						if (a == 1) {
							// We have found the first element of the ingredients name

							while (a < tab.length - 1 && b < ingTab.length) {
								if (tab[a].trim() !== ingTab[b].toLowerCase()) {
									break;
								}
								a++;
								b++;
							}
							if (a == tab.length - 1 && b < ingTab.length) {
								// There was no break so we have arrived to the last element, we can then test it differently (with plural also)

								if (ingTab[b].toLowerCase() === tab[a] || ingTab[b].toLowerCase() === tab[a].toPlural()) {
									if (resIng === "" || resIng.split(" ").length < ing.split(" ").length)
										resIng = ing;
								}
							}
						}
					}
				}
				if (resIng !== "" && !resIng.in(recipe.baseIngredients) && !resIng.in(commonIngredients))
					recipe.baseIngredients.push(resIng);
			});

			// RECIPE'S DIRECTIONS
			recipe.directions = [];
			$(recipesBlock[r]).find(".instructions").each(function(e) {
				recipe.directions.push($(this).text().trim());
			});

			recipe.totalTime = -1;
			recipe.prepTime = -1;
			recipe.inactiveTime = -1;
			recipe.cookTime = -1;

			if ($(recipesBlock[r]).find("time[class='preptime']").text().trim().length > 0)
				recipe.prepTime = getTime($(recipesBlock[r]).find("time[class='preptime']").text());
			if ($(recipesBlock[r]).find("time[class='cooktime']").text().trim().length > 0)
				recipe.cookTime = getTime($(recipesBlock[r]).find("time[class='cooktime']").text());
			if ($(recipesBlock[r]).find("time[class='totaltime']").text().trim().length > 0)
				recipe.totalTime = getTime($(recipesBlock[r]).find("time[class='totaltime']").text());

			recipes.push(recipe);
		}
	};
}

fs.openSync("./recipes-iamafoodblog.json", "w");
fs.appendFileSync("./recipes-iamafoodblog.json", JSON.stringify(recipes));