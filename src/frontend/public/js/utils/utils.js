function h(tag, attrs, children){
    const el = document.createElement(tag);
  
    Object.keys(attrs).forEach(function(key){
      var val = attrs[key];
  
      el.setAttribute(key, val);
    });
  
    if (children) { 
      children.forEach(function(child){
        el.appendChild(child);
      });
    }
  
    return el;
}
  
function t(text){
    return document.createTextNode(text);
}

const DECIMAL_PLACES = 3;

function fixed(num) {
  if (num === undefined) return;
  return num != 0 ? num.toFixed(DECIMAL_PLACES) : num
}

export { h, t, fixed };