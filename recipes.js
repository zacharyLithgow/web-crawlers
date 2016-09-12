var cheerio = require("cheerio");
var fs = require("fs");
var request = require("sync-request");

var values = ["easy", "dinner", "chicken", "gluten-free-recipes"];

var ingredients = fs.readFileSync("ingredients.txt").toString().split("\n");

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

values.forEach(function(val) {
	for (var i = 0; i < 220; i++) {
		var res = request("GET", "http://www.foodnetwork.com/topics/" + val + ".page-" + i + ".html", {
			"headers": {
				"user-agent": "RecipesAppBot"
			},
			"retry": true,
			"retryDelay": 1000
		});
		$ = cheerio.load(res.getBody("utf8"), {
			decodeEntities: true
		});

		var as = $('.ico-wrap.pull-right[href^="/recipes"]');

		as.each(function(e) {
			var res = request("GET", "http://www.foodnetwork.com/" + $(this).attr("href"), {
				"headers": {
					"user-agent": "RecipesAppBot"
				},
				"retry": true,
				"retryDelay": 1000
			});
			$ = cheerio.load(res.getBody("utf8"), {
				decodeEntities: true
			});

			recipe = {};
			recipe.title = $(".title h1").text(); // RECIPE'S NAME

			recipe.imageSrc = $("div[class='ico-wrap'] img").attr("src");

			recipe.totalTime = 0;
			recipe.prepTime = 0;
			recipe.inactiveTime = 0;
			recipe.cookTime = 0;
			var cookingTimesDT = $(".col6.info.collapsed > .cooking-times dt");
			var cookingTimesDD = $(".col6.info.collapsed > .cooking-times dd");

			for (var j = 0; j < cookingTimesDT.length; j++) {
				var splitCT = cookingTimesDD.eq(j).text().split(" ");
				if (cookingTimesDT.eq(j).text().indexOf("Total Time") !== -1) {
					// TOTAL TIME IS ON INDEX j
					if (cookingTimesDD.eq(j).text().indexOf("hr") !== -1) {
						// THERE IS MORE THAN 60 MINUTES
						recipe.totalTime = (splitCT[2]) ? (parseInt(splitCT[0]) * 60) + parseInt(splitCT[2]) : (parseInt(splitCT[0]) * 60);
					} else {
						recipe.totalTime = parseInt(splitCT[0]);
					}
				} else if (cookingTimesDT.eq(j).text().indexOf("Prep") !== -1) {
					// PREP IS ON INDEX j
					if (cookingTimesDD.eq(j).text().indexOf("hr") !== -1) {
						// THERE IS MORE THAN 60 MINUTES
						recipe.prepTime = (splitCT[2]) ? (parseInt(splitCT[0]) * 60) + parseInt(splitCT[2]) : (parseInt(splitCT[0]) * 60);
					} else {
						recipe.prepTime = parseInt(splitCT[0]);
					}
				} else if (cookingTimesDT.eq(j).text().indexOf("Inactive") !== -1) {
					// INACTIVE IS ON INDEX j
					if (cookingTimesDD.eq(j).text().indexOf("hr") !== -1) {
						// THERE IS MORE THAN 60 MINUTES
						recipe.inactiveTime = (splitCT[2]) ? (parseInt(splitCT[0]) * 60) + parseInt(splitCT[2]) : (parseInt(splitCT[0]) * 60);
					} else {
						recipe.inactiveTime = parseInt(splitCT[0]);
					}
				} else if (cookingTimesDT.eq(j).text().indexOf("Cook") !== -1) {
					// COOK IS ON INDEX j
					if (cookingTimesDD.eq(j).text().indexOf("hr") !== -1) {
						// THERE IS MORE THAN 60 MINUTES
						recipe.cookTime = (splitCT[2]) ? (parseInt(splitCT[0]) * 60) + parseInt(splitCT[2]) : (parseInt(splitCT[0]) * 60);
					} else {
						recipe.cookTime = parseInt(splitCT[0]);
					}
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

				for (var ele = 0; ele < ingredients.length; ele++) {
					var ing = ingredients[ele];
					var tab = ing.split(" ");
					if (tab.length == 1) {
						for (var x = 0; x < ingTab.length; x++) {
							if (ingTab[x].toLowerCase() === tab[0] || ingTab[x].toLowerCase() === tab[0].toPlural()) {
								recipe.baseIngredients.push(ing);
								ele = ingredients.length;
								break;
							}
						}
					} else {
						var a = 0,
							b = 0;
						for (var x = 0; x < ingTab.length; x++) {
							if (ingTab[x].toLowerCase() === tab[a]) {
								a = 1
								b = x + 1;
								break;
							}
						}
						if (a == 1) {
							// We have found the first element of the ingredients name

							while (a < tab.length - 1 && b < ingTab.length) {
								if (tab[a] !== ingTab[b].toLowerCase()) {
									break;
								}
								a++;
								b++;
							}
							if (a == tab.length - 1 && b < ingTab.length) {
								// There was no break so we have arrived to the last element, we can then test it differently (with plural also)

								if (ingTab[b].toLowerCase() === tab[a] || ingTab[b].toLowerCase() === tab[a].toPlural()) {
									ele = ingredients.length;
									recipe.baseIngredients.push(ing);
								}
							}
						}
					}
				}
			});

			recipes.push(recipe);
		});
	}
});

fs.openSync("./recipes.json", "w");
fs.appendFileSync("./recipes.json", JSON.stringify(recipes));