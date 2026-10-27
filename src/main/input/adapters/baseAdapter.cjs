/**
 * Base Input Adapter interface for cross-platform remote input injection.
 */
class BaseAdapter {
  ghostClick(x, y, button = 'left') {}
  ghostDoubleClick(x, y) {}
  ghostWheel(x, y, delta) {}
  ghostDown(x, y, button = 'left') {}
  ghostUp(x, y, button = 'left') {}
  ghostDrag(x, y) {}
  move(x, y) {}
  mouseDown(button = 'left') {}
  mouseUp(button = 'left') {}
  click(button = 'left') {}
  doubleClick() {}
  wheel(delta) {}
  dispose() {}
}

module.exports = { BaseAdapter };
