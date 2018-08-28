# convert-three-examples-to-imports

Script for converting the javascript and html files in the examples folder of the [THREE.js](https://github.com/mrdoob/three.js) repo to use es6 imports.

[Remaining Problem Examples](./problem-examples.md)

[Unconverted Files](./unconverted-files.md)

## Assumptions & Exceptions

- Exported objects from a script are added onto the global `THREE` object.
- `RaytraceWorker.js` is excluded from the transformation because it is to be loaded into a web worker.
- Excludes `Nodes`, `SEA3D`, `libs` folders
- `XLoader.js` is ignored

## Final Structure

Every HTML and javascript example file will be converted to a `<name>.module.js` and `<name>.module.html` variant.

The module javascript versions will be converted to UMD versions with the original name.

Some examples will only work in the module-less environment because their scripts will need to be manually converted.

## Process

1. Scrape all javascript files and extract what members are added onto the `THREE` object by looking for a member of `THREE` that is set equal to something. `ColladaExporter.js` is considered to export `ColladaExporter` for example.

```js
THREE.ColladaExporter = function () {};
```

2. Modify the files with `export` statements for the found objects. Declare the exported variable at the top of the script because it may not be modified in the root scope. Exported variable names get two underscores prepended to avoid conflicts with internal variable names.

```js
var __ColladaExporter;

// ...

__ColladaExporter = function () {};

// ...

export { __ColladaExporter as ColladaExporter };
```

3. Traverse all example javascript files and check which of the exported members are used in the file. Add `import` statements for all of the imported objects as well as `THREE` if it's used.

```js
var loader = new THREE.ColladaLoader();
loader.load(...);
```

to

```js
import * as THREE from '../../build/three.module.js';
import { ColladaLoader } from '../exporters/ColladaLoader.js';

// ...

var loader = new ColladaLoader();
loader.load(...);
```

4. Traverse all html example pages and find the script tags which import the javascript files that were convereted to es6 imports. Change the script tags with content to use modules, add the imports at the top, and replace the code with the imported variables

```html
<script src=".../three.min.js"></script>
<script src=".../ColladaLoader.js"></script>
<script>
  var loader = new THREE.ColladaLoader();
  loader.load(...);
</script>
```

to 

```html
<script type="module">
  import * as THREE from '.../three.module.js';
  import { ColladaLoader } from '.../ColladaLoader.js';
  var loader = new THREE.ColladaLoader();
  loader.load(...);
</script>
```

5. Convert global definition references such as `Detector` and `Stats` and `dat` to use `window.*`.
