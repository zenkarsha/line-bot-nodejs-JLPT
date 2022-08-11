const fs = require('fs');

function addId(id) {
  return function iter(o) {
    if ('word' in o) {
      id++
      o.id = `${id}` ;
    }
    Object.keys(o).forEach(function(k) {
      Array.isArray(o[k]) && o[k].forEach(iter);
    });
  };
}

var data = [];

data.forEach(addId(0));

path = '';
fs.writeFile(path, JSON.stringify(data), function (error, data) {
  if (error) {
    console.error(error);
  }
});
