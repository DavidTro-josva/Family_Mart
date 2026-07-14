const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  const original = content;
  
  // Replace ($) -> (₹)
  content = content.replace(/\(\$\)/g, '(₹)');
  
  // Replace >$ -> >₹
  content = content.replace(/>\$/g, '>₹');
  content = content.replace(/> \$/g, '> ₹');
  
  // Replace $${ -> ₹${
  content = content.replace(/\$\$\{/g, '₹${');
  
  // Replace $ followed by digit -> ₹ followed by digit
  content = content.replace(/\$(?=\d)/g, '₹');
  
  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log('Updated', file);
  }
});
console.log('Total files updated:', changedFiles);
