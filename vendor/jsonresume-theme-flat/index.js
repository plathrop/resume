var fs = require("fs");
var Handlebars = require("handlebars");

module.exports = {
	render: render
};

function render(resume) {
	var css = fs.readFileSync(__dirname + "/style.css", "utf-8");
	var template = fs.readFileSync(__dirname + "/resume.template", "utf-8");
	return Handlebars.compile(template)({
		css: css,
		resume: modernize(resume)
	});
}

// This theme predates JSON Resume v1: it reads `company` and `website`
// where the current schema uses `name` and `url`. Shim the legacy fields
// so modern resume data renders correctly.
function modernize(resume) {
	var copy = JSON.parse(JSON.stringify(resume));
	var legacy = function (entry) {
		if (!entry) return;
		if (!entry.company && entry.name) entry.company = entry.name;
		if (!entry.website && entry.url) entry.website = entry.url;
	};
	legacy(copy.basics);
	["work", "volunteer", "education", "projects"].forEach(function (section) {
		(copy[section] || []).forEach(legacy);
	});
	return copy;
}

Handlebars.registerHelper("nl2br", function(value) {
	return (value || "").replace(/\n/g, "</p><p>");
});
