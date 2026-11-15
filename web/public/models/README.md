# 3D models

| File | What | License | Source |
|---|---|---|---|
| `nasa-astronaut-emu.glb` | NASA astronaut in the EMU (Extravehicular Mobility Unit) spacesuit, about 6,400 triangles, textures embedded. Used for the 3D body map. | NASA 3D Resources: "These assets are free and without copyright." Use follows the NASA media usage guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media | NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources , file `3D Models/Astronaut/Astronaut.glb`, downloaded 2026-11-14. Web interface: https://nasa3d.arc.nasa.gov |

| `nasa-astronaut-emu-front.webp` | Front view of the same model, 1103 x 1200 px, transparent background. Used for the 2D body map, so the 2D view needs no WebGL. | Our render of the NASA model above (same terms). Not a NASA image. | Rendered on 2026-11-15 with three.js from `nasa-astronaut-emu.glb`, orthographic camera, with the lighting in `src/components/BodyMap3D.tsx` (`lightScene`, `LOOK`). The region anchors in `src/components/BodyMap.tsx` were measured in the same render. |

NASA's file is Draco-compressed. The Draco decoder (`public/draco/`, Apache 2.0, copied from `three/examples/jsm/libs/draco/gltf/`) is bundled too, so no CDN is needed.

The file is bundled with the app so the body map works offline. It is a spacesuit model, not a medical or anatomical model: the body regions on it show where each indicator belongs, not anatomy.

Using a NASA model does not mean NASA endorses this project. Do not add NASA logos or the NASA insignia to the app.
