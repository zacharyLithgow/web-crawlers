"use strict";

var cheerio = require("cheerio");
var fs = require("fs");
var request = require("sync-request");
var lineByLine = require("n-readlines");

//var values = ["easy", "dinner", "chicken", "gluten-free-recipes"];

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

var recipes = [];
var recipe = {};

function isVowel(c) {
	return ['a', 'e', 'i', 'o', 'u'].indexOf(c.toLowerCase()) !== -1;
}

function isInArray(value, array) {
	return array.indexOf(value) > -1;
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

var res = request("GET", "http://www.foodnetwork.com/topics/easy.html", {
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

var startPage = 1;
if(process.argv[2]){
	startPage = Math.max(startPage,parseInt(process.argv[2]));
}

var lastPage = parseInt($(".pagination").find("li").eq(-2).text().trim());
if(process.argv[3]){
	lastPage = Math.min(lastPage,parseInt(process.argv[3]));
}

for (var i = startPage; i <= lastPage; i++) {
	console.log(i);
	var res = request("GET", "http://www.foodnetwork.com/topics/easy.page-" + i + ".html", {
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

	var as = $('.ico-wrap.pull-right[href^="/recipes"]');

	for (var a = 0; a < as.length; a++) {
		var res = request("GET", "http://www.foodnetwork.com/" + $(as[a]).attr("href"), {
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

		recipe = {};
		recipe.title = $(".title h1").text().trim(); // RECIPE'S NAME

		recipe.imageSrc = $("div[class='ico-wrap'] img").attr("src");

		recipe.totalTime = -1;
		recipe.prepTime = -1;
		recipe.inactiveTime = -1;
		recipe.cookTime = -1;
		var cookingTimesDT = $(".col6.info.collapsed > .cooking-times dt");
		var cookingTimesDD = $(".col6.info.collapsed > .cooking-times dd");

		for (var j = 0; j < cookingTimesDT.length; j++) {
			var splitCT = cookingTimesDD.eq(j).text().split(" ");
			if (cookingTimesDT.eq(j).text().indexOf("Total Time") !== -1) {
				// TOTAL TIME IS ON INDEX j
				recipe.totalTime = cookingTimesDD.eq(j).text().trim();
			} else if (cookingTimesDT.eq(j).text().indexOf("Prep") !== -1) {
				// PREP IS ON INDEX j
				recipe.prepTime = cookingTimesDD.eq(j).text().trim();
			} else if (cookingTimesDT.eq(j).text().indexOf("Inactive") !== -1) {
				// INACTIVE IS ON INDEX j
				recipe.inactiveTime = cookingTimesDD.eq(j).text().trim();
			} else if (cookingTimesDT.eq(j).text().indexOf("Cook") !== -1) {
				// COOK IS ON INDEX j
				recipe.cookTime = cookingTimesDD.eq(j).text().trim();
			}
		}

		recipe.level = $(".col6.info.collapsed > .difficulty dd").eq(1).text().toLowerCase(); // LEVEL OF THE RECIPE

		// RECIPE'S DIRECTIONS
		recipe.directions = [];
		$(".recipe-directions-list li").each(function(e) {
			recipe.directions.push($(this).text());
		});

		// RECIPE'S INGREDIENTS
		recipe.exactIngredients = [];
		recipe.baseIngredients = [];
		$(".col8.ingredients li").each(function(e) {
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

		recipes.push(recipe);
	}
}

fs.openSync("./recipes-foodnetwork-easy-"+startPage+"-to-"+lastPage+".json", "w");
fs.appendFileSync("./recipes-foodnetwork-easy-"+startPage+"-to-"+lastPage+".json", JSON.stringify(recipes));