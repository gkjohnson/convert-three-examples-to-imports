# Remaining Problem Examples

#### SEA3D Issues

- loader / sea3d
- loader / sea3d / hierarchy
- loader / sea3d / keyframe
- loader / sea3d / morph
- loader / sea3d / physics
- loader / sea3d / skinning
- loader / sea3d / sound

#### Node Issues

- loader / nodes (Node is a reserved name)
- materials / compile (Node definition)
- materials / nodes (Node definition)
- mirror / nodes (Node definition)
- postprocessing / nodes (Node definition)
- postprocessing / nodes / pass (Node definition)
- performance / nodes (Node definition)
- sprites / nodes (Node definition)

#### Non Exported Variables

- software / lines / splines (hilbert3D not exported)
- animation / cloth (defines variables in other script)
- lines / colors (hilbert3D not converted)
- lines / dashed (hilbert3D not converted)
- lines / fat (hilbert3D not converted)
- gpgpu / * (GPUComputationRenderer is not exported, not on `THREE`)
- postprocessing / crossfade (scenes.js relies on global THREE and is not converted)

#### Can't Test

- materials / video?
- materials / video / webcam?
- vive / paint?
- vive / sculpt?
- camera / cinematic (relies on global camera definition. fix separately)
- kinect?

#### Code Structure Issues
- gpgpu / birds (modifies THREE. Fix separately)
- loader / x (wrapped in UMD)
- modifier / subdivision (modifies THREE object with model definitions. fix separately)
- postprocessing / dof (using the wrong bokeh shader, should use bokeh2)
- shadowmesh (click button) (button listener expects global function. fix separately)
- raytracing sandbox (button refers to function in module code. fix separately)
