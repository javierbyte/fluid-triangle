/*
I tweaked the original code quite a bit.

You can find the original here: https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/18-flip.html
And a copy of its license below.

---

Copyright 2022 Matthias Müller - Ten Minute Physics, 
www.youtube.com/c/TenMinutePhysics
www.matthiasMueller.info/tenMinutePhysics

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const TARGET_LONG_SIDE = 128 * 74;
const MIN_GRID_SIZE = 8;
const CELL_CROP_X = 1;
const CELL_CROP_Y = 2;

const BASE = [
  // ["@", 42996],
  // ["&", 35409],
  // ["X", 32454],
  // ["$", 32427],
  // ["=", 19752],
  // ["+", 16884],
  ["~", 12198],
  [":", 6921],
  ["-", 5589],
  ["·", 3267],
  [" ", 0],
  [" ", 0],
];

const RENDER_CHARS = [
  [["F", 26574], ["F", 26574], ["f", 17490], ...BASE],
  [["L", 21327], ["L", 21327], ["l", 14019], ...BASE],
  [["U", 32973], ["U", 32973], ["u", 24093], ...BASE],
  [["I", 14883], ["I", 14883], ["i", 13638], ...BASE],
  [["D", 36198], ["D", 36198], ["d", 30762], ...BASE],
];

// // amount of bright pixels a character shows at 12px font size
// const RENDER_CHAR_B = [
//   [" ", 0],
//   [" ", 0],
//   ["·", 18700 / 4],
//   ["·", 18700 / 4],
//   [":", 35984 / 4],

//   ["-", 30980 / 4],
//   ["-", 30980 / 4],

//   ["~", 41648 / 4],
//   // ["~", 41648 / 4],

//   ["=", 75592 / 4],
//   ["+", 75592 / 4],
//   // ["#", 151600 / 4],
//   ["X", 142104 / 4],

//   // ["@", 175768 / 4],
//   // ["@", 175768 / 4],

//   ["&", 176176 / 4],
//   ["$", 177400 / 4],
// ];

// const RENDER_CHAR_DICTIONARY = RENDER_CHAR_B.sort((a, b) => a[1] - b[1])
//   .map(([char]) => char)
//   .join("");

const canvasEl = document.getElementById("canvas");
const renderEl = document.querySelector(".render");

const GRID_SIZE = Math.max(
  Math.round(
    Math.sqrt(
      (window.innerWidth * window.innerHeight) / TARGET_LONG_SIDE
    )
  ),
  MIN_GRID_SIZE
);

const SPEED_1 = 1.0 / 60.0 / 16;
const SPEED_BASE = 1.0 / 60.0 / 3;
const SPEED_2 = 1.0 / 60.0 / 1.25;

const realWidth =
  Math.ceil(window.innerWidth / GRID_SIZE + CELL_CROP_X * 2) *
  GRID_SIZE;
const realHeight =
  Math.ceil(window.innerHeight / GRID_SIZE + CELL_CROP_Y * 2) *
  GRID_SIZE;

const Y_RESOLUTION = realHeight / GRID_SIZE;
const X_RESOLUTION = realWidth / GRID_SIZE;
const RESOLUTION = Y_RESOLUTION;

const GRAVITY = -9.81;

const extraSized = 0;

canvasEl.width = realWidth;
canvasEl.height = realHeight;
canvasEl.style.width = realWidth + "px";
canvasEl.style.height = realHeight + "px";
renderEl.style.width = realWidth + "px";
renderEl.style.height = realHeight + "px";
document.documentElement.style.setProperty(
  "--cell-size",
  GRID_SIZE + "px"
);

canvasEl.focus();

var simHeight = 2.0;

var cScale = canvasEl.height / simHeight;
var simWidth = canvasEl.width / cScale;

var U_FIELD = 0;
var V_FIELD = 1;

var FLUID_CELL = 0;
var AIR_CELL = 1;
var SOLID_CELL = 2;

var cnt = 0;

function clamp(x, min, max) {
  if (x < min) return min;
  else if (x > max) return max;
  else return x;
}

// ----------------- start of simulator ------------------------------

class FlipFluid {
  constructor(
    density,
    width,
    height,
    spacing,
    particleRadius,
    maxParticles
  ) {
    // fluid

    this.density = density;
    this.fNumX = Math.floor(width / spacing);
    this.fNumY = Math.floor(height / spacing);
    this.h = Math.max(width / this.fNumX, height / this.fNumY);
    this.fInvSpacing = 1.0 / this.h;
    this.fNumCells = this.fNumX * this.fNumY;

    this.u = new Float32Array(this.fNumCells);
    this.v = new Float32Array(this.fNumCells);
    this.du = new Float32Array(this.fNumCells);
    this.dv = new Float32Array(this.fNumCells);
    this.prevU = new Float32Array(this.fNumCells);
    this.prevV = new Float32Array(this.fNumCells);
    this.p = new Float32Array(this.fNumCells);
    this.s = new Float32Array(this.fNumCells);
    this.cellType = new Int32Array(this.fNumCells);
    this.cellColor = new Float32Array(3 * this.fNumCells);

    // particles

    this.maxParticles = maxParticles;

    this.particlePos = new Float32Array(2 * this.maxParticles);
    this.particleColor = new Float32Array(3 * this.maxParticles);
    for (var i = 0; i < this.maxParticles; i++)
      this.particleColor[3 * i + 2] = 1.0;

    this.particleVel = new Float32Array(2 * this.maxParticles);
    this.particleDensity = new Float32Array(this.fNumCells);
    this.particleRestDensity = 0.0;

    this.particleRadius = particleRadius;
    this.pInvSpacing = 1.0 / (2.2 * particleRadius);
    this.pNumX = Math.floor(width * this.pInvSpacing) + 1;
    this.pNumY = Math.floor(height * this.pInvSpacing) + 1;
    this.pNumCells = this.pNumX * this.pNumY;

    this.numCellParticles = new Int32Array(this.pNumCells);
    this.firstCellParticle = new Int32Array(this.pNumCells + 1);
    this.cellParticleIds = new Int32Array(maxParticles);

    this.numParticles = 0;
  }

  integrateParticles(dt) {
    for (var i = 0; i < this.numParticles; i++) {
      let gravityX = 0;
      let gravityY = GRAVITY;

      if (window.gravityVector) {
        gravityX = window.gravityVector.x;
        gravityY = window.gravityVector.y;
      }

      this.particleVel[2 * i] += dt * gravityX;
      this.particleVel[2 * i + 1] += dt * gravityY;
      this.particlePos[2 * i] += this.particleVel[2 * i] * dt;
      this.particlePos[2 * i + 1] += this.particleVel[2 * i + 1] * dt;
    }
  }

  pushParticlesApart(numIters) {
    var colorDiffusionCoeff = 0.001;

    // count particles per cell

    this.numCellParticles.fill(0);

    for (var i = 0; i < this.numParticles; i++) {
      var x = this.particlePos[2 * i];
      var y = this.particlePos[2 * i + 1];

      var xi = clamp(
        Math.floor(x * this.pInvSpacing),
        0,
        this.pNumX - 1
      );
      var yi = clamp(
        Math.floor(y * this.pInvSpacing),
        0,
        this.pNumY - 1
      );
      var cellNr = xi * this.pNumY + yi;
      this.numCellParticles[cellNr]++;
    }

    // partial sums

    var first = 0;

    for (var i = 0; i < this.pNumCells; i++) {
      first += this.numCellParticles[i];
      this.firstCellParticle[i] = first;
    }
    this.firstCellParticle[this.pNumCells] = first; // guard

    // fill particles into cells

    for (var i = 0; i < this.numParticles; i++) {
      var x = this.particlePos[2 * i];
      var y = this.particlePos[2 * i + 1];

      var xi = clamp(
        Math.floor(x * this.pInvSpacing),
        0,
        this.pNumX - 1
      );
      var yi = clamp(
        Math.floor(y * this.pInvSpacing),
        0,
        this.pNumY - 1
      );
      var cellNr = xi * this.pNumY + yi;
      this.firstCellParticle[cellNr]--;
      this.cellParticleIds[this.firstCellParticle[cellNr]] = i;
    }

    // push particles apart

    var minDist = 2.0 * this.particleRadius;
    var minDist2 = minDist * minDist;

    for (var iter = 0; iter < numIters; iter++) {
      for (var i = 0; i < this.numParticles; i++) {
        var px = this.particlePos[2 * i];
        var py = this.particlePos[2 * i + 1];

        var pxi = Math.floor(px * this.pInvSpacing);
        var pyi = Math.floor(py * this.pInvSpacing);
        var x0 = Math.max(pxi - 1, 0);
        var y0 = Math.max(pyi - 1, 0);
        var x1 = Math.min(pxi + 1, this.pNumX - 1);
        var y1 = Math.min(pyi + 1, this.pNumY - 1);

        for (var xi = x0; xi <= x1; xi++) {
          for (var yi = y0; yi <= y1; yi++) {
            var cellNr = xi * this.pNumY + yi;
            var first = this.firstCellParticle[cellNr];
            var last = this.firstCellParticle[cellNr + 1];
            for (var j = first; j < last; j++) {
              var id = this.cellParticleIds[j];
              if (id == i) continue;
              var qx = this.particlePos[2 * id];
              var qy = this.particlePos[2 * id + 1];

              var dx = qx - px;
              var dy = qy - py;
              var d2 = dx * dx + dy * dy;
              if (d2 > minDist2 || d2 == 0.0) continue;
              var d = Math.sqrt(d2);
              var s = (0.5 * (minDist - d)) / d;
              dx *= s;
              dy *= s;
              this.particlePos[2 * i] -= dx;
              this.particlePos[2 * i + 1] -= dy;
              this.particlePos[2 * id] += dx;
              this.particlePos[2 * id + 1] += dy;

              // diffuse colors

              // for (var k = 0; k < 3; k++) {
              //   var color0 = this.particleColor[3 * i + k];
              //   var color1 = this.particleColor[3 * id + k];
              //   var color = (color0 + color1) * 0.5;
              //   this.particleColor[3 * i + k] =
              //     color0 + (color - color0) * colorDiffusionCoeff;
              //   this.particleColor[3 * id + k] =
              //     color1 + (color - color1) * colorDiffusionCoeff;
              // }
            }
          }
        }
      }
    }
  }

  handleParticleCollisions(obstacleX, obstacleY, obstacleRadius) {
    var h = 1.0 / this.fInvSpacing;
    var r = this.particleRadius;

    var minX = h + r;
    var maxX = (this.fNumX - 1) * h - r;
    var minY = h + r;
    var maxY = (this.fNumY - 1) * h - r;

    for (var i = 0; i < this.numParticles; i++) {
      var x = this.particlePos[2 * i];
      var y = this.particlePos[2 * i + 1];

      // Define triangle vertices based on obstacleX, obstacleY and obstacleRadius
      const trianglePoints = [
        {
          x: obstacleX,
          y: obstacleY + obstacleRadius,
        }, // top
        {
          x: obstacleX - obstacleRadius * Math.cos(Math.PI / 6),
          y: obstacleY - obstacleRadius * Math.sin(Math.PI / 6),
        }, // bottom left
        {
          x: obstacleX + obstacleRadius * Math.cos(Math.PI / 6),
          y: obstacleY - obstacleRadius * Math.sin(Math.PI / 6),
        }, // bottom right
      ];

      // Function to check if point is inside triangle
      function pointInTriangle(px, py, v1, v2, v3) {
        let d1 = sign(px, py, v1.x, v1.y, v2.x, v2.y);
        let d2 = sign(px, py, v2.x, v2.y, v3.x, v3.y);
        let d3 = sign(px, py, v3.x, v3.y, v1.x, v1.y);
        let hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        let hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(hasNeg && hasPos);
      }

      function sign(px, py, x1, y1, x2, y2) {
        return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
      }

      // Check collision with triangle
      if (
        pointInTriangle(
          x,
          y,
          trianglePoints[0],
          trianglePoints[1],
          trianglePoints[2]
        )
      ) {
        // Find closest point on triangle and push particle out
        let closestPoint = {
          x: x,
          y: y,
        };
        let minDist = Number.MAX_VALUE;

        // Check against each edge
        for (let i = 0; i < 3; i++) {
          let p1 = trianglePoints[i];
          let p2 = trianglePoints[(i + 1) % 3];

          let edge = {
            x: p2.x - p1.x,
            y: p2.y - p1.y,
          };
          let point = {
            x: x - p1.x,
            y: y - p1.y,
          };

          let len = edge.x * edge.x + edge.y * edge.y;
          let t = Math.max(
            0,
            Math.min(1, (point.x * edge.x + point.y * edge.y) / len)
          );

          let proj = {
            x: p1.x + t * edge.x,
            y: p1.y + t * edge.y,
          };

          let dist = Math.sqrt(
            (x - proj.x) * (x - proj.x) + (y - proj.y) * (y - proj.y)
          );
          if (dist < minDist) {
            minDist = dist;
            closestPoint = proj;
          }
        }

        // Push particle out
        let dx = x - closestPoint.x;
        let dy = y - closestPoint.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) {
          x = closestPoint.x;
          y = closestPoint.y;
        }

        this.particleVel[2 * i] = 0;
        this.particleVel[2 * i + 1] = 0;
      }

      // wall collisions

      if (x < minX) {
        x = minX;
        this.particleVel[2 * i] = 0.0;
      }
      if (x > maxX) {
        x = maxX;
        this.particleVel[2 * i] = 0.0;
      }

      if (y < minY) {
        y = minY;
        this.particleVel[2 * i + 1] = 0.0;
      }
      if (y > maxY) {
        y = maxY;
        this.particleVel[2 * i + 1] = 0.0;
      }
      this.particlePos[2 * i] = x;
      this.particlePos[2 * i + 1] = y;
    }
  }

  updateParticleDensity() {
    var n = this.fNumY;
    var h = this.h;
    var h1 = this.fInvSpacing;
    var h2 = 0.5 * h;

    var d = f.particleDensity;

    d.fill(0.0);

    for (var i = 0; i < this.numParticles; i++) {
      var x = this.particlePos[2 * i];
      var y = this.particlePos[2 * i + 1];

      x = clamp(x, h, (this.fNumX - 1) * h);
      y = clamp(y, h, (this.fNumY - 1) * h);

      var x0 = Math.floor((x - h2) * h1);
      var tx = (x - h2 - x0 * h) * h1;
      var x1 = Math.min(x0 + 1, this.fNumX - 2);

      var y0 = Math.floor((y - h2) * h1);
      var ty = (y - h2 - y0 * h) * h1;
      var y1 = Math.min(y0 + 1, this.fNumY - 2);

      var sx = 1.0 - tx;
      var sy = 1.0 - ty;

      if (x0 < this.fNumX && y0 < this.fNumY) d[x0 * n + y0] += sx * sy;
      if (x1 < this.fNumX && y0 < this.fNumY) d[x1 * n + y0] += tx * sy;
      if (x1 < this.fNumX && y1 < this.fNumY) d[x1 * n + y1] += tx * ty;
      if (x0 < this.fNumX && y1 < this.fNumY) d[x0 * n + y1] += sx * ty;
    }

    if (this.particleRestDensity == 0.0) {
      var sum = 0.0;
      var numFluidCells = 0;

      for (var i = 0; i < this.fNumCells; i++) {
        if (this.cellType[i] == FLUID_CELL) {
          sum += d[i];
          numFluidCells++;
        }
      }

      if (numFluidCells > 0)
        this.particleRestDensity = sum / numFluidCells;
    }
  }

  transferVelocities(toGrid, flipRatio) {
    var n = this.fNumY;
    var h = this.h;
    var h1 = this.fInvSpacing;
    var h2 = 0.5 * h;

    if (toGrid) {
      this.prevU.set(this.u);
      this.prevV.set(this.v);

      this.du.fill(0.0);
      this.dv.fill(0.0);
      this.u.fill(0.0);
      this.v.fill(0.0);

      for (var i = 0; i < this.fNumCells; i++)
        this.cellType[i] = this.s[i] == 0.0 ? SOLID_CELL : AIR_CELL;

      for (var i = 0; i < this.numParticles; i++) {
        var x = this.particlePos[2 * i];
        var y = this.particlePos[2 * i + 1];
        var xi = clamp(Math.floor(x * h1), 0, this.fNumX - 1);
        var yi = clamp(Math.floor(y * h1), 0, this.fNumY - 1);
        var cellNr = xi * n + yi;
        if (this.cellType[cellNr] == AIR_CELL)
          this.cellType[cellNr] = FLUID_CELL;
      }
    }

    for (var component = 0; component < 2; component++) {
      var dx = component == 0 ? 0.0 : h2;
      var dy = component == 0 ? h2 : 0.0;

      var f = component == 0 ? this.u : this.v;
      var prevF = component == 0 ? this.prevU : this.prevV;
      var d = component == 0 ? this.du : this.dv;

      for (var i = 0; i < this.numParticles; i++) {
        var x = this.particlePos[2 * i];
        var y = this.particlePos[2 * i + 1];

        x = clamp(x, h, (this.fNumX - 1) * h);
        y = clamp(y, h, (this.fNumY - 1) * h);

        var x0 = Math.min(Math.floor((x - dx) * h1), this.fNumX - 2);
        var tx = (x - dx - x0 * h) * h1;
        var x1 = Math.min(x0 + 1, this.fNumX - 2);

        var y0 = Math.min(Math.floor((y - dy) * h1), this.fNumY - 2);
        var ty = (y - dy - y0 * h) * h1;
        var y1 = Math.min(y0 + 1, this.fNumY - 2);

        var sx = 1.0 - tx;
        var sy = 1.0 - ty;

        var d0 = sx * sy;
        var d1 = tx * sy;
        var d2 = tx * ty;
        var d3 = sx * ty;

        var nr0 = x0 * n + y0;
        var nr1 = x1 * n + y0;
        var nr2 = x1 * n + y1;
        var nr3 = x0 * n + y1;

        if (toGrid) {
          var pv = this.particleVel[2 * i + component];
          f[nr0] += pv * d0;
          d[nr0] += d0;
          f[nr1] += pv * d1;
          d[nr1] += d1;
          f[nr2] += pv * d2;
          d[nr2] += d2;
          f[nr3] += pv * d3;
          d[nr3] += d3;
        } else {
          var offset = component == 0 ? n : 1;
          var valid0 =
            this.cellType[nr0] != AIR_CELL ||
            this.cellType[nr0 - offset] != AIR_CELL
              ? 1.0
              : 0.0;
          var valid1 =
            this.cellType[nr1] != AIR_CELL ||
            this.cellType[nr1 - offset] != AIR_CELL
              ? 1.0
              : 0.0;
          var valid2 =
            this.cellType[nr2] != AIR_CELL ||
            this.cellType[nr2 - offset] != AIR_CELL
              ? 1.0
              : 0.0;
          var valid3 =
            this.cellType[nr3] != AIR_CELL ||
            this.cellType[nr3 - offset] != AIR_CELL
              ? 1.0
              : 0.0;

          var v = this.particleVel[2 * i + component];
          var d = valid0 * d0 + valid1 * d1 + valid2 * d2 + valid3 * d3;

          if (d > 0.0) {
            var picV =
              (valid0 * d0 * f[nr0] +
                valid1 * d1 * f[nr1] +
                valid2 * d2 * f[nr2] +
                valid3 * d3 * f[nr3]) /
              d;
            var corr =
              (valid0 * d0 * (f[nr0] - prevF[nr0]) +
                valid1 * d1 * (f[nr1] - prevF[nr1]) +
                valid2 * d2 * (f[nr2] - prevF[nr2]) +
                valid3 * d3 * (f[nr3] - prevF[nr3])) /
              d;
            var flipV = v + corr;

            this.particleVel[2 * i + component] =
              (1.0 - flipRatio) * picV + flipRatio * flipV;
          }
        }
      }

      if (toGrid) {
        for (var i = 0; i < f.length; i++) {
          if (d[i] > 0.0) f[i] /= d[i];
        }

        // restore solid cells

        for (var i = 0; i < this.fNumX; i++) {
          for (var j = 0; j < this.fNumY; j++) {
            var solid = this.cellType[i * n + j] == SOLID_CELL;
            if (
              solid ||
              (i > 0 && this.cellType[(i - 1) * n + j] == SOLID_CELL)
            )
              this.u[i * n + j] = this.prevU[i * n + j];
            if (
              solid ||
              (j > 0 && this.cellType[i * n + j - 1] == SOLID_CELL)
            )
              this.v[i * n + j] = this.prevV[i * n + j];
          }
        }
      }
    }
  }

  solveIncompressibility(
    numIters,
    dt,
    overRelaxation,
    compensateDrift = true
  ) {
    this.p.fill(0.0);
    this.prevU.set(this.u);
    this.prevV.set(this.v);

    var n = this.fNumY;
    var cp = (this.density * this.h) / dt;

    for (var i = 0; i < this.fNumCells; i++) {
      var u = this.u[i];
      var v = this.v[i];
    }

    for (var iter = 0; iter < numIters; iter++) {
      for (var i = 1; i < this.fNumX - 1; i++) {
        for (var j = 1; j < this.fNumY - 1; j++) {
          if (this.cellType[i * n + j] != FLUID_CELL) continue;

          var center = i * n + j;
          var left = (i - 1) * n + j;
          var right = (i + 1) * n + j;
          var bottom = i * n + j - 1;
          var top = i * n + j + 1;

          var s = this.s[center];
          var sx0 = this.s[left];
          var sx1 = this.s[right];
          var sy0 = this.s[bottom];
          var sy1 = this.s[top];
          var s = sx0 + sx1 + sy0 + sy1;
          if (s == 0.0) continue;

          var div =
            this.u[right] -
            this.u[center] +
            this.v[top] -
            this.v[center];

          if (this.particleRestDensity > 0.0 && compensateDrift) {
            var k = 1.0;
            var compression =
              this.particleDensity[i * n + j] -
              this.particleRestDensity;
            if (compression > 0.0) div = div - k * compression;
          }

          var p = -div / s;
          p *= overRelaxation;
          this.p[center] += cp * p;

          this.u[center] -= sx0 * p;
          this.u[right] += sx1 * p;
          this.v[center] -= sy0 * p;
          this.v[top] += sy1 * p;
        }
      }
    }
  }

  updateParticleColors() {
    var h1 = this.fInvSpacing;

    for (var i = 0; i < this.numParticles; i++) {
      var s = 0.01;

      this.particleColor[3 * i] = clamp(
        this.particleColor[3 * i] - s,
        0.0,
        1.0
      );
      this.particleColor[3 * i + 1] = clamp(
        this.particleColor[3 * i + 1] - s,
        0.0,
        1.0
      );
      this.particleColor[3 * i + 2] = clamp(
        this.particleColor[3 * i + 2] + s,
        0.0,
        1.0
      );

      var x = this.particlePos[2 * i];
      var y = this.particlePos[2 * i + 1];
      var xi = clamp(Math.floor(x * h1), 1, this.fNumX - 1);
      var yi = clamp(Math.floor(y * h1), 1, this.fNumY - 1);
      var cellNr = xi * this.fNumY + yi;

      var d0 = this.particleRestDensity;

      if (d0 > 0.0) {
        var relDensity = this.particleDensity[cellNr] / d0;
        if (relDensity < 0.7) {
          var s = 0.8;
          this.particleColor[3 * i] = s;
          this.particleColor[3 * i + 1] = s;
          this.particleColor[3 * i + 2] = s;
        }
      }
    }
  }

  setSciColor(cellNr, val, minVal, maxVal) {
    val = Math.min(Math.max(val, minVal), maxVal - 0.0001);
    var d = maxVal - minVal;
    val = d == 0.0 ? 0.5 : (val - minVal) / d;
    var m = 0.25;
    var num = Math.floor(val / m);
    var s = (val - num * m) / m;
    var r, g, b;

    switch (num) {
      case 0:
        r = s;
        g = s;
        b = s;
        break;
      case 1:
        r = 1.0 - s;
        g = 1.0 - s;
        b = 1.0 - s;
        break;
      case 2:
        r = s;
        g = s;
        b = s;
        break;
      case 3:
        r = 1.0 - s;
        g = 1.0 - s;
        b = 1.0 - s;
        break;
    }

    this.cellColor[3 * cellNr] = r;
    this.cellColor[3 * cellNr + 1] = g;
    this.cellColor[3 * cellNr + 2] = b;
  }

  updateCellColors() {
    this.cellColor.fill(0.0);

    for (var i = 0; i < this.fNumCells; i++) {
      if (this.cellType[i] == SOLID_CELL) {
        this.cellColor[3 * i] = 0.5;
        this.cellColor[3 * i + 1] = 0.5;
        this.cellColor[3 * i + 2] = 0.5;
      } else if (this.cellType[i] == FLUID_CELL) {
        var d = this.particleDensity[i];
        if (this.particleRestDensity > 0.0)
          d /= this.particleRestDensity;
        this.setSciColor(i, d, 0.0, 2.0);
      }
    }
  }

  simulate(
    dt,
    gravity,
    flipRatio,
    numPressureIters,
    numParticleIters,
    overRelaxation,
    compensateDrift,
    separateParticles,
    obstacleX,
    abstacleY,
    obstacleRadius
  ) {
    var numSubSteps = 1;
    var sdt = dt / numSubSteps;

    for (var step = 0; step < numSubSteps; step++) {
      this.integrateParticles(sdt, gravity);
      if (separateParticles) {
        this.pushParticlesApart(numParticleIters);
      }
      this.handleParticleCollisions(
        obstacleX,
        abstacleY,
        obstacleRadius
      );
      this.transferVelocities(true);
      this.updateParticleDensity();
      this.solveIncompressibility(
        numPressureIters,
        sdt,
        overRelaxation,
        compensateDrift
      );
      this.transferVelocities(false, flipRatio);
    }

    // We are not rendering particles at the moment
    // this.updateParticleColors();
    this.updateCellColors();
  }
}
// ----------------- end of simulator ------------------------------

var scene = {
  gravity: GRAVITY,
  dt: SPEED_BASE,
  flipRatio: 0.9,
  numPressureIters: 30,
  numParticleIters: 2,
  frameNr: 0,
  overRelaxation: 1.9,
  compensateDrift: true,
  separateParticles: true,
  obstacleX: 0.0,
  obstacleY: 0.0,
  obstacleRadius: 0,
  paused: true,
  showObstacle: true,
  obstacleVelX: 0.0,
  obstacleVelY: 0.0,
  fluid: null,
};

function setupScene() {
  var res = RESOLUTION;

  var tankHeight = 1.0 * simHeight;
  var tankWidth = 1.0 * simWidth;
  var h = tankHeight / res;

  var density = 1000.0;

  var relWaterHeight = 0.618;
  var relWaterWidth = 1;

  // dam break

  // compute number of particles

  var r = 0.3 * h; // particle radius w.r.t. cell size
  var dx = 2.0 * r;
  var dy = (Math.sqrt(3.0) / 2.0) * dx;

  var numX = Math.floor(
    (relWaterWidth * tankWidth - 2.0 * h - 2.0 * r) / dx
  );
  var numY = Math.floor(
    (relWaterHeight * tankHeight - 2.0 * h - 2.0 * r) / dy
  );
  var maxParticles = numX * numY;

  // create fluid

  f = scene.fluid = new FlipFluid(
    density,
    tankWidth,
    tankHeight,
    h,
    r,
    maxParticles
  );

  // create particles

  f.numParticles = numX * numY;
  var p = 0;
  for (var i = 0; i < numX; i++) {
    for (var j = 0; j < numY; j++) {
      // Center horizontally by adding offset to x position
      let xOffset = (tankWidth - numX * dx) / 2;
      // Center vertically by adding offset to y position
      let yOffset = (tankHeight - numY * dy) * -0.5;

      f.particlePos[p++] =
        h + r + dx * i + (j % 2 == 0 ? 0.0 : r) + xOffset;
      f.particlePos[p++] = h + r + dy * j + yOffset;
    }
  }

  // setup grid cells for tank

  var n = f.fNumY;

  for (var i = 0; i < f.fNumX; i++) {
    for (var j = 0; j < f.fNumY; j++) {
      var s = 1.0; // fluid
      if (i == 0 || i == f.fNumX - 1 || j == 0) s = 0.0; // solid
      f.s[i * n + j] = s;
    }
  }
}

function setObstacle(x, y, reset) {
  var vx = 0.0;
  var vy = 0.0;

  if (!reset) {
    vx = (x - scene.obstacleX) / scene.dt;
    vy = (y - scene.obstacleY) / scene.dt;
  }

  scene.obstacleX = x;
  scene.obstacleY = y;
  var r = scene.obstacleRadius;
  var f = scene.fluid;
  var n = f.numY;
  var cd = Math.sqrt(2) * f.h;

  for (var i = 1; i < f.numX - 2; i++) {
    for (var j = 1; j < f.numY - 2; j++) {
      f.s[i * n + j] = 1.0;

      dx = (i + 0.5) * f.h - x;
      dy = (j + 0.5) * f.h - y;

      if (dx * dx + dy * dy < r * r) {
        f.s[i * n + j] = 0.0;
        f.u[i * n + j] = vx;
        f.u[(i + 1) * n + j] = vx;
        f.v[i * n + j] = vy;
        f.v[i * n + j + 1] = vy;
      }
    }
  }

  scene.showObstacle = true;
  scene.obstacleVelX = vx;
  scene.obstacleVelY = vy;
}

// interaction -------------------------------------------------------

var mouseDown = false;

function startDrag(x, y) {
  let bounds = canvasEl.getBoundingClientRect();

  let mx = x - bounds.left - canvasEl.clientLeft;
  let my = y - bounds.top - canvasEl.clientTop;
  mouseDown = true;

  x = mx / cScale;
  y = (canvasEl.height - my) / cScale;

  setObstacle(x, y, true);
  scene.paused = false;
}

function drag(x, y) {
  if (mouseDown) {
    let bounds = canvasEl.getBoundingClientRect();
    let mx = x - bounds.left - canvasEl.clientLeft;
    let my = y - bounds.top - canvasEl.clientTop;
    x = mx / cScale;
    y = (canvasEl.height - my) / cScale;
    setObstacle(x, y, false);
  }
}

function endDrag() {
  mouseDown = false;
  scene.obstacleVelX = 0.0;
  scene.obstacleVelY = 0.0;
}

canvasEl.addEventListener("mousedown", (event) => {
  scene.obstacleRadius = 0.0;
  scene.dt = SPEED_1;
  startDrag(event.x, event.y);
});

canvasEl.addEventListener("mouseup", (event) => {
  scene.dt = SPEED_2;
  endDrag();
});

canvasEl.addEventListener("mousemove", (event) => {
  drag(event.x, event.y);
});

canvasEl.addEventListener("touchstart", (event) => {
  event.preventDefault();
  scene.obstacleRadius = 0.0;
  scene.dt = SPEED_1;
  startDrag(event.touches[0].clientX, event.touches[0].clientY);
});

canvasEl.addEventListener("touchend", (event) => {
  scene.dt = SPEED_2;
  endDrag();
});

canvasEl.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    drag(event.touches[0].clientX, event.touches[0].clientY);
  },
  {
    passive: false,
  }
);

document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "p":
      scene.paused = !scene.paused;
      break;
    case "m":
      scene.paused = false;
      simulate();
      scene.paused = true;
      break;
  }
});

// on window resize, refresh
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    window.location.reload();
  }, 250);
});

// Request device motion permission if available
async function requestDeviceMotion() {
  if (typeof DeviceMotionEvent?.requestPermission === "function") {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission === "granted") {
        setupDeviceMotion();
      }
    } catch (err) {
      console.error("Error requesting device motion permission:", err);
    }
  } else {
    setupDeviceMotion();
  }
}

canvasEl.addEventListener("click", requestDeviceMotion, { once: true });
document.addEventListener("touchend", requestDeviceMotion, {
  once: true,
});
function setupDeviceMotion() {
  window.addEventListener("devicemotion", (event) => {
    console.log("Device motion event:", event);
    let x = event.accelerationIncludingGravity.x;
    let y = event.accelerationIncludingGravity.y;

    if (!x && !y) {
      console.warn("No acceleration data available");
      return;
    }

    // Adjust for screen orientation
    if (window.orientation === 90 || window.orientation === -90) {
      // In landscape mode, swap and invert x and y
      const temp = x;
      x = -y;
      y = temp;
    }

    window.gravityVector = {
      x,
      y,
    };

    scene.gravity = 0;
  });
}

function toggleStart() {
  var button = document.getElementById("startButton");
  if (scene.paused) button.innerHTML = "Stop";
  else button.innerHTML = "Start";
  scene.paused = !scene.paused;
}

// main -------------------------------------------------------

function simulate() {
  if (!scene.paused)
    scene.fluid.simulate(
      scene.dt,
      scene.gravity,
      scene.flipRatio,
      scene.numPressureIters,
      scene.numParticleIters,
      scene.overRelaxation,
      scene.compensateDrift,
      scene.separateParticles,
      scene.obstacleX,
      scene.obstacleY,
      scene.obstacleRadius,
      scene.colorFieldNr
    );
  scene.frameNr++;
}

const ctx = canvasEl.getContext("2d");

function update() {
  const MAX_RADIUS =
    window.innerWidth > window.innerHeight ? 0.47 : 0.37;

  scene.obstacleRadius = (scene.obstacleRadius * 3 + MAX_RADIUS) / 4;
  simulate();

  const renderAscii = scene.paused ? false : true;
  const renderCanvas = scene.paused ? false : false;

  if (renderAscii) {
    let toRender = "";
    for (let i = f.fNumY - CELL_CROP_Y; i > CELL_CROP_Y; i--) {
      let row = "";
      for (let j = CELL_CROP_X; j < f.fNumX - CELL_CROP_X; j++) {
        const CURRENT_RENDER_CHAR =
          RENDER_CHARS[Math.floor((i + j + 1) % RENDER_CHARS.length)];

        const RENDER_CHAR_DICTIONARY = CURRENT_RENDER_CHAR.sort(
          (a, b) => a[1] - b[1]
        )
          .map(([char]) => char)
          .join("");

        const cellColor = f.cellColor[3 * (j * f.fNumY + i)];
        row +=
          RENDER_CHAR_DICTIONARY[
            Math.floor(cellColor * RENDER_CHAR_DICTIONARY.length)
          ];
      }
      toRender += row + "\n";
    }
    renderEl.innerHTML = toRender;
  }

  if (renderCanvas) {
    // Use a single ImageData for better performance
    const imageData = ctx.createImageData(realWidth, realHeight);
    const data = imageData.data;

    // Fill black background directly in ImageData
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0; // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    }

    const cellSize = GRID_SIZE;
    const finalSize = cellSize - 2;
    const squarePadding = Math.floor((cellSize - finalSize) / 2);

    for (let i = f.fNumY - CELL_CROP_Y; i > CELL_CROP_Y; i--) {
      for (let j = CELL_CROP_X; j < f.fNumX - CELL_CROP_X; j++) {
        let cellColor = f.cellColor[3 * (j * f.fNumY + i)];
        let intensity = Math.round(cellColor * 255);

        // Calculate pixel positions once
        const startX = j * cellSize - cellSize * CELL_CROP_X;
        const startY =
          (f.fNumY - i) * cellSize - cellSize * CELL_CROP_Y;
        const width = finalSize - squarePadding;
        const height = finalSize - squarePadding;

        // Fill pixels directly in ImageData
        for (let y = startY; y < startY + height; y++) {
          for (let x = startX; x < startX + width; x++) {
            const index = (y * realWidth + x) * 4;
            data[index] = intensity; // R
            data[index + 1] = intensity; // G
            data[index + 2] = intensity; // B
            data[index + 3] = 255; // A
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  requestAnimationFrame(update);
}

setupScene();
// draw obstacle in the middle
startDrag(window.innerWidth / 2, window.innerHeight * 0.54);
endDrag();
update();
