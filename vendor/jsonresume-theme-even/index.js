const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const micromark = require('micromark')
const striptags = require('striptags')

const extname = '.hbs'
const partialsDir = path.join(__dirname, 'partials')

fs.readdirSync(partialsDir)
  .filter(filename => path.extname(filename) === extname)
  .map(filename => [
    filename,
    fs.readFileSync(path.join(partialsDir, filename), 'utf8'),
  ])
  .forEach(([filename, template]) =>
    Handlebars.registerPartial(path.basename(filename, extname), template),
  )

// Parse YYYY, YYYY-MM, and YYYY-MM-DD as a LOCAL date. Passing the bare
// string to `new Date()` parses it as UTC midnight, which renders as the
// previous month in timezones behind UTC.
Handlebars.registerHelper('formatDate', dateString => {
  if (!dateString) return ''
  const [year, month = 1, day = 1] = String(dateString).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric',
  })
})

Handlebars.registerHelper('formatURL', url =>
  url.replace(/^(https?:|)\/\//, '').replace(/\/$/, ''),
)

Handlebars.registerHelper('join', (arr, separator) =>
  arr.join(typeof separator === 'string' ? separator : ', '),
)

Handlebars.registerHelper('markdown', doc => micromark(doc))

Handlebars.registerHelper('stripTags', html => striptags(html))

exports.pdfRenderOptions = { mediaType: 'print' }

exports.render = resume => {
  const template = fs.readFileSync(path.join(__dirname, 'resume.hbs'), 'utf-8')
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8')

  return Handlebars.compile(template)({ css, resume })
}
